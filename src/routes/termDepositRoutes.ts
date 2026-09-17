import { Router } from "express";
import { termDepositController } from "../controllers/termDepositController";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { idParam } from "../validators/common";
import { openTermDepositBody, settlementDateBody } from "../validators/termDepositSchemas";

export const termDepositRoutes = Router();

termDepositRoutes.post(
  "/",
  requireIdempotencyKey(),
  validate({ body: openTermDepositBody }),
  termDepositController.open
);
termDepositRoutes.get("/:id", validate({ params: idParam("id") }), termDepositController.getById);
termDepositRoutes.get(
  "/:id/accrued-interest",
  validate({ params: idParam("id") }),
  termDepositController.accruedInterest
);
termDepositRoutes.get("/:id/postings", validate({ params: idParam("id") }), termDepositController.listPostings);
termDepositRoutes.post(
  "/:id/interest-postings/monthly",
  requireIdempotencyKey(),
  validate({ params: idParam("id"), body: settlementDateBody }),
  termDepositController.postMonthlyInterest
);
termDepositRoutes.post(
  "/:id/withdraw-early",
  requireIdempotencyKey(),
  validate({ params: idParam("id"), body: settlementDateBody }),
  termDepositController.withdrawEarly
);
termDepositRoutes.post(
  "/:id/mature",
  requireIdempotencyKey(),
  validate({ params: idParam("id"), body: settlementDateBody }),
  termDepositController.mature
);
