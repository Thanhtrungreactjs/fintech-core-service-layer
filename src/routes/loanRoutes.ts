import { Router } from "express";
import { loanController } from "../controllers/loanController";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { idParam } from "../validators/common";
import { payLoanInstallmentBody } from "../validators/loanSchemas";

export const loanRoutes = Router();

loanRoutes.get("/:id", validate({ params: idParam("id") }), loanController.getById);
loanRoutes.get(
  "/:id/payments",
  validate({ params: idParam("id") }),
  loanController.listPayments
);
loanRoutes.post(
  "/:id/payments/:paymentId/pay",
  requireIdempotencyKey(),
  validate({ params: idParam("id").extend(idParam("paymentId").shape), body: payLoanInstallmentBody }),
  loanController.payInstallment
);
