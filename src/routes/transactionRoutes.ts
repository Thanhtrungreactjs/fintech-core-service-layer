import { Router } from "express";
import { transactionController } from "../controllers/transactionController";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { idParam } from "../validators/common";
import { createTransactionBody } from "../validators/transactionSchemas";

export const transactionRoutes = Router();

transactionRoutes.post(
  "/",
  requireIdempotencyKey(),
  validate({ body: createTransactionBody }),
  transactionController.create
);
transactionRoutes.get("/:id", validate({ params: idParam("id") }), transactionController.getById);
transactionRoutes.post(
  "/:id/reverse",
  requireIdempotencyKey(),
  validate({ params: idParam("id") }),
  transactionController.reverse
);
