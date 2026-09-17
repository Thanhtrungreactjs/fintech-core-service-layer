import { z } from "zod";

export const issueCardBody = z.object({
  card_type: z.enum(["debit", "credit", "prepaid"]),
  expiry_date: z.string().date(),
});

export const updateCardStatusBody = z.object({
  status: z.enum(["active", "blocked", "expired"]),
});
