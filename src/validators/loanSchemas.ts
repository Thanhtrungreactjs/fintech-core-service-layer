import { z } from "zod";

const amountString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "phải là số dương, tối đa 2 chữ số thập phân");

export const createLoanBody = z.object({
  account_id: z.coerce.number().int().positive(),
  loan_type: z.string().max(50).nullable().optional(),
  principal_amount: amountString,
  interest_rate: z.coerce.number().min(0).max(999.99),
  term_months: z.coerce.number().int().positive(),
  disbursed_date: z.string().date(),
});

export const payLoanInstallmentBody = z.object({
  amount_paid: amountString,
  paid_date: z.string().date(),
});
