import crypto from "node:crypto";
import { accountRepository } from "../repositories/accountRepository";
import { accountTypeService } from "./accountTypeService";
import { customerService } from "./customerService";
import { transactionRepository } from "../repositories/transactionRepository";
import { Account, AccountStatus } from "../types/domain";
import { Errors } from "../utils/errors";
import { Pagination, toLimitOffset } from "../utils/pagination";
import { signedDelta } from "./transactionMath";

function generateAccountNumber(): string {
  return `VN${Date.now().toString().slice(-8)}${crypto.randomInt(1000, 9999)}`;
}

// Trạng thái tài khoản là terminal: một khi 'closed' thì không mở lại được.
const ALLOWED_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  active: ["dormant", "frozen", "closed"],
  dormant: ["active", "frozen", "closed"],
  frozen: ["active", "dormant", "closed"],
  closed: [],
};

export const accountService = {
  async create(input: { customer_id: number; account_type_id: number; currency?: string }): Promise<Account> {
    await customerService.getById(input.customer_id);
    await accountTypeService.getById(input.account_type_id);
    return accountRepository.create({
      customer_id: input.customer_id,
      account_type_id: input.account_type_id,
      account_number: generateAccountNumber(),
      currency: input.currency,
    });
  },

  async getById(id: number): Promise<Account> {
    const account = await accountRepository.findById(id);
    if (!account) throw Errors.notFound("account", id);
    return account;
  },

  async listByCustomer(customerId: number, pagination: Pagination) {
    await customerService.getById(customerId);
    const { limit, offset } = toLimitOffset(pagination);
    return accountRepository.findByCustomer(customerId, limit, offset);
  },

  async updateStatus(id: number, status: AccountStatus): Promise<Account> {
    const account = await this.getById(id);
    if (account.status === status) return account;
    if (!ALLOWED_TRANSITIONS[account.status].includes(status)) {
      throw Errors.business(
        "ACCOUNT_STATUS_TRANSITION_INVALID",
        `Không thể chuyển tài khoản ${id} từ '${account.status}' sang '${status}'`
      );
    }
    await accountRepository.updateStatus(id, status);
    return this.getById(id);
  },

  /**
   * Lịch sử số dư suy diễn từ transactions (api-design.md mục "Accounts").
   * Vì schema không lưu snapshot balance theo thời điểm, số dư chạy được
   * tính từ 0 theo thứ tự thời gian tăng dần — phản ánh biến động tương đối,
   * không phải số dư tuyệt đối tại các thời điểm trong quá khứ.
   */
  async getBalanceHistory(id: number) {
    await this.getById(id);
    const { rows } = await transactionRepository.findByAccount(id, {}, 100000, 0);
    // rows đã DESC (mới nhất trước) — đảo sang ASC chỉ để dồn running_balance đúng thứ tự
    // thời gian, rồi đảo lại DESC trước khi trả về (giống mọi danh sách khác trong hệ thống).
    const chronological = [...rows].reverse();
    let running = 0;
    const withRunningBalance = chronological.map((txn) => {
      const change = signedDelta(txn, id);
      running += change;
      return {
        transaction_id: txn.transaction_id,
        txn_timestamp: txn.txn_timestamp,
        txn_type: txn.txn_type,
        amount: txn.amount,
        change: (change >= 0 ? "+" : "-") + Math.abs(change).toFixed(2),
        running_balance: running.toFixed(2),
      };
    });
    return withRunningBalance.reverse();
  },
};
