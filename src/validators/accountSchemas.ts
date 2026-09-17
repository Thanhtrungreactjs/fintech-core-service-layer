import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

export const createAccountBody = z.object({
  customer_id: z.coerce.number().int().positive(),
  account_type_id: z.coerce.number().int().positive(),
  currency: z.string().length(3).optional(),
});

export const updateAccountStatusBody = z.object({
  status: z.enum(["active", "dormant", "frozen", "closed"]),
});

export const listAccountsQuery = paginationSchema;

export const createAccountTypeBody = z.object({
  type_name: z.string().min(1).max(50),
  interest_rate: z.coerce.number().min(0),
});
