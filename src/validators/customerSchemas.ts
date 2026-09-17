import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

export const createCustomerBody = z.object({
  full_name: z.string().min(1).max(150),
  email: z.string().email().max(150),
  phone: z.string().max(20).nullable().optional(),
  dob: z.string().date().nullable().optional(),
  country: z.string().max(50).nullable().optional(),
  referred_by: z.coerce.number().int().positive().nullable().optional(),
});

export const updateCustomerBody = z.object({
  full_name: z.string().min(1).max(150).optional(),
  phone: z.string().max(20).nullable().optional(),
  dob: z.string().date().nullable().optional(),
  country: z.string().max(50).nullable().optional(),
});

export const updateKycBody = z.object({
  kyc_status: z.enum(["verified", "rejected", "pending"]),
});

export const searchCustomerQuery = paginationSchema.extend({
  email: z.string().email().optional(),
  kyc_status: z.enum(["pending", "verified", "rejected"]).optional(),
  referred_by: z.coerce.number().int().positive().optional(),
});
