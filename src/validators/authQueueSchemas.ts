import { z } from "zod";
import { paginationSchema } from "../utils/pagination";
import { createTransactionBody } from "./transactionSchemas";
import { updateAccountStatusBody } from "./accountSchemas";
import { openTermDepositBody } from "./termDepositSchemas";

const updateAccountStatusPayload = updateAccountStatusBody.extend({
  account_id: z.coerce.number().int().positive(),
});

const termDepositActionPayload = z.object({
  term_deposit_id: z.coerce.number().int().positive(),
  value_date: z.string().date().optional(),
});

/**
 * Mỗi nhánh khớp đúng 1 operation_type trong OPERATION_EXECUTORS (authQueueService) —
 * payload được validate NGAY LÚC MAKER NHẬP LỆNH, không phải chờ tới lúc checker duyệt
 * mới phát hiện lỗi. maker_id KHÔNG còn là field của body — lấy từ req.user (JWT đã xác
 * thực qua requireAuth), tránh giả mạo danh tính.
 */
export const enqueueBody = z.discriminatedUnion("operation_type", [
  z.object({ operation_type: z.literal("CREATE_TRANSACTION"), payload: createTransactionBody }),
  z.object({ operation_type: z.literal("UPDATE_ACCOUNT_STATUS"), payload: updateAccountStatusPayload }),
  z.object({ operation_type: z.literal("OPEN_TERM_DEPOSIT"), payload: openTermDepositBody }),
  z.object({ operation_type: z.literal("WITHDRAW_TERM_DEPOSIT_EARLY"), payload: termDepositActionPayload }),
  z.object({ operation_type: z.literal("MATURE_TERM_DEPOSIT"), payload: termDepositActionPayload }),
]);

export const rejectBody = z.object({ reason: z.string().min(1).max(255) });

export const listAuthQueueQuery = paginationSchema.extend({
  status: z.enum(["pending", "authorized", "rejected"]).optional(),
});
