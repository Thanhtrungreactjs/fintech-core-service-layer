import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

export const listFraudAlertsQuery = paginationSchema.extend({
  status: z.enum(["open", "reviewing", "closed_fp", "closed_confirmed"]).optional(),
  min_risk_score: z.coerce.number().int().min(0).max(100).optional(),
});

export const createFraudAlertBody = z.object({
  transaction_id: z.coerce.number().int().positive(),
  risk_score: z.coerce.number().int().min(0).max(100),
  alert_type: z.string().max(50).nullable().optional(),
});

export const updateFraudAlertStatusBody = z.object({
  status: z.enum(["reviewing", "closed_fp", "closed_confirmed"]),
});
