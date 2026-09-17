import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

const amountString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "phải là số dương, tối đa 2 chữ số thập phân");

const rateString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,3})?$/.test(v), "phải là số không âm, tối đa 3 chữ số thập phân");

export const openTermDepositBody = z.object({
  account_id: z.coerce.number().int().positive(),
  principal_amount: amountString,
  interest_rate: rateString,
  term_months: z.coerce.number().int().positive(),
  interest_method: z.enum(["simple", "compound"]).optional(),
  payout_method: z.enum(["maturity", "monthly"]).optional(),
  day_count_convention: z.enum(["actual_365", "actual_360"]).optional(),
  early_withdrawal_rate: rateString.optional(),
  auto_renewal: z.coerce.boolean().optional(),
  start_date: z.string().date().optional(),
});

export const listTermDepositsQuery = paginationSchema;

export const settlementDateBody = z.object({
  value_date: z.string().date().optional(),
});
