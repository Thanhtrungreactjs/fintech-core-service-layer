import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

const amountString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "amount phải là số dương, tối đa 2 chữ số thập phân");

export const createTransactionBody = z.object({
  account_id: z.coerce.number().int().positive(),
  related_account_id: z.coerce.number().int().positive().nullable().optional(),
  card_id: z.coerce.number().int().positive().nullable().optional(),
  merchant_id: z.coerce.number().int().positive().nullable().optional(),
  category_id: z.coerce.number().int().positive(),
  txn_type: z.enum(["deposit", "withdrawal", "transfer", "payment", "fee", "interest"]),
  amount: amountString,
  currency: z.string().length(3).optional(),
  description: z.string().max(255).nullable().optional(),
});

export const listAccountTransactionsQuery = paginationSchema.extend({
  txn_type: z
    .enum(["deposit", "withdrawal", "transfer", "payment", "fee", "interest"])
    .optional(),
  category_id: z.coerce.number().int().positive().optional(),
  status: z.enum(["pending", "completed", "failed", "reversed"]).optional(),
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});
