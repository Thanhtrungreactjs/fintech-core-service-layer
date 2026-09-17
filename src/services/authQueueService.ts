import { withTransaction, pool } from "../db/pool";
import { authQueueRepository } from "../repositories/authQueueRepository";
import { appUserRepository } from "../repositories/appUserRepository";
import { transactionService, CreateTransactionRequest } from "./transactionService";
import { accountService } from "./accountService";
import { termDepositService, OpenTermDepositRequest } from "./termDepositService";
import { AuthQueueEntry, AuthQueueOperationType, AuthQueueStatus, AccountStatus, AppUserRole } from "../types/domain";
import { Errors } from "../utils/errors";
import { Pagination, toLimitOffset } from "../utils/pagination";

// Vai trò 'maker' chỉ được nộp lệnh, 'checker' chỉ được duyệt/từ chối — 'both'/'admin' làm được
// cả hai. Trước đây role chỉ là dữ liệu hiển thị, không ai kiểm tra thật: 1 user role 'maker'
// (không phải 'both') vẫn tự do authorize miễn không phải chính họ nộp lệnh — sai nguyên tắc
// phân quyền theo chức danh của maker-checker thật.
const MAKER_ROLES: AppUserRole[] = ["maker", "both", "admin"];
const CHECKER_ROLES: AppUserRole[] = ["checker", "both", "admin"];

/**
 * Registry ánh xạ operation_type -> hàm thực thi nghiệp vụ THẬT (gọi thẳng service layer
 * sẵn có, không viết lại business rule). Chỉ chạy khi checker đã authorize — trước đó
 * payload chỉ nằm im trong auth_queue, KHÔNG có hiệu lực (tiền chưa di chuyển).
 */
const OPERATION_EXECUTORS: Record<AuthQueueOperationType, (payload: Record<string, unknown>) => Promise<unknown>> = {
  CREATE_TRANSACTION: (p) => transactionService.create(p as unknown as CreateTransactionRequest),
  UPDATE_ACCOUNT_STATUS: (p) =>
    accountService.updateStatus(Number(p.account_id), p.status as AccountStatus),
  OPEN_TERM_DEPOSIT: (p) => termDepositService.open(p as unknown as OpenTermDepositRequest),
  WITHDRAW_TERM_DEPOSIT_EARLY: (p) =>
    termDepositService.withdrawEarly(Number(p.term_deposit_id), p.value_date as string | undefined),
  MATURE_TERM_DEPOSIT: (p) =>
    termDepositService.mature(Number(p.term_deposit_id), p.value_date as string | undefined),
};

export const authQueueService = {
  async listUsers() {
    return appUserRepository.list();
  },

  /** Maker nộp 1 yêu cầu nghiệp vụ vào hàng đợi chờ duyệt — CHƯA thực thi. */
  async enqueue(
    operationType: AuthQueueOperationType,
    payload: Record<string, unknown>,
    makerId: number
  ): Promise<AuthQueueEntry> {
    const maker = await appUserRepository.findById(makerId);
    if (!maker) throw Errors.notFound("app_user", makerId);
    if (!MAKER_ROLES.includes(maker.role)) {
      throw Errors.forbidden(`Người dùng '${maker.username}' (role '${maker.role}') không có quyền nhập lệnh (maker)`);
    }
    return authQueueRepository.create({ operation_type: operationType, payload, maker_id: makerId });
  },

  async getById(id: number): Promise<AuthQueueEntry> {
    const entry = await authQueueRepository.findById(id);
    if (!entry) throw Errors.notFound("auth_queue", id);
    return entry;
  },

  async list(status: AuthQueueStatus | undefined, pagination: Pagination) {
    const { limit, offset } = toLimitOffset(pagination);
    return authQueueRepository.list(status, limit, offset);
  },

  /**
   * Checker phê duyệt — thực thi payload đã lưu bằng đúng service layer thật (transaction,
   * đổi trạng thái tài khoản, mở/rút/đáo hạn sổ tiết kiệm...). "Claim" (chuyển pending ->
   * authorized) chạy trong 1 transaction ngắn trước, khoá row + chặn tự duyệt, để 2 checker
   * không thể cùng duyệt trùng 1 yêu cầu. Nếu executor lỗi, claim bị hoàn tác về 'pending'
   * để checker thử lại thay vì để hàng đợi kẹt ở trạng thái sai sự thật.
   */
  async authorize(queueId: number, checkerId: number): Promise<AuthQueueEntry> {
    const checker = await appUserRepository.findById(checkerId);
    if (!checker) throw Errors.notFound("app_user", checkerId);
    if (!CHECKER_ROLES.includes(checker.role)) {
      throw Errors.forbidden(`Người dùng '${checker.username}' (role '${checker.role}') không có quyền phê duyệt (checker)`);
    }

    await withTransaction(async (conn) => {
      const entry = await authQueueRepository.findByIdForUpdate(queueId, conn);
      if (!entry) throw Errors.notFound("auth_queue", queueId);
      if (entry.status !== "pending") {
        throw Errors.business(
          "AUTH_QUEUE_NOT_PENDING",
          `Yêu cầu #${queueId} đã ở trạng thái '${entry.status}', không thể duyệt lại`
        );
      }
      if (entry.maker_id === checkerId) {
        throw Errors.business(
          "AUTH_QUEUE_SELF_AUTHORIZATION",
          `Người nhập lệnh (maker #${entry.maker_id}) không được tự phê duyệt yêu cầu của chính mình`
        );
      }
      await authQueueRepository.claimForAuthorization(queueId, checkerId, conn);
    });

    const claimed = (await authQueueRepository.findById(queueId))!;
    const executor = OPERATION_EXECUTORS[claimed.operation_type];
    try {
      const result = await executor(claimed.payload);
      await authQueueRepository.attachResult(queueId, result);
    } catch (err) {
      await authQueueRepository.revertClaim(queueId, pool);
      throw err;
    }

    return (await authQueueRepository.findById(queueId))!;
  },

  async reject(queueId: number, checkerId: number, reason: string): Promise<AuthQueueEntry> {
    const checker = await appUserRepository.findById(checkerId);
    if (!checker) throw Errors.notFound("app_user", checkerId);
    if (!CHECKER_ROLES.includes(checker.role)) {
      throw Errors.forbidden(`Người dùng '${checker.username}' (role '${checker.role}') không có quyền từ chối (checker)`);
    }

    return withTransaction(async (conn) => {
      const entry = await authQueueRepository.findByIdForUpdate(queueId, conn);
      if (!entry) throw Errors.notFound("auth_queue", queueId);
      if (entry.status !== "pending") {
        throw Errors.business(
          "AUTH_QUEUE_NOT_PENDING",
          `Yêu cầu #${queueId} đã ở trạng thái '${entry.status}', không thể từ chối`
        );
      }
      if (entry.maker_id === checkerId) {
        throw Errors.business(
          "AUTH_QUEUE_SELF_AUTHORIZATION",
          `Người nhập lệnh (maker #${entry.maker_id}) không được tự từ chối yêu cầu của chính mình`
        );
      }
      await authQueueRepository.reject(queueId, checkerId, reason, conn);
      return (await authQueueRepository.findById(queueId, conn))!;
    });
  },
};
