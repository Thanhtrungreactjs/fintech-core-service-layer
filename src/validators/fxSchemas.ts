import { z } from "zod";

const amountString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "phải là số dương, tối đa 2 chữ số thập phân");

export const fxConvertBody = z.object({
  from_account_id: z.coerce.number().int().positive(),
  to_account_id: z.coerce.number().int().positive(),
  from_amount: amountString,
  rate_date: z.string().date().optional(),
});
