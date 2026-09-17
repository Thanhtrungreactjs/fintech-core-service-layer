import { Router } from "express";
import { customerController } from "../controllers/customerController";
import { accountController } from "../controllers/accountController";
import { loanController } from "../controllers/loanController";
import { termDepositController } from "../controllers/termDepositController";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { idParam } from "../validators/common";
import {
  createCustomerBody,
  searchCustomerQuery,
  updateCustomerBody,
  updateKycBody,
} from "../validators/customerSchemas";
import { listAccountsQuery } from "../validators/accountSchemas";
import { createLoanBody } from "../validators/loanSchemas";
import { listTermDepositsQuery } from "../validators/termDepositSchemas";

export const customerRoutes = Router();

customerRoutes.post("/", validate({ body: createCustomerBody }), customerController.create);
customerRoutes.get("/", validate({ query: searchCustomerQuery }), customerController.search);
customerRoutes.get("/:id", validate({ params: idParam("id") }), customerController.getById);
customerRoutes.patch(
  "/:id",
  validate({ params: idParam("id"), body: updateCustomerBody }),
  customerController.update
);
customerRoutes.patch(
  "/:id/kyc",
  validate({ params: idParam("id"), body: updateKycBody }),
  customerController.updateKyc
);
customerRoutes.get(
  "/:id/referrals",
  validate({ params: idParam("id") }),
  customerController.referrals
);
customerRoutes.get(
  "/:id/accounts",
  validate({ params: idParam("id"), query: listAccountsQuery }),
  accountController.listByCustomer
);
customerRoutes.get(
  "/:id/term-deposits",
  validate({ params: idParam("id"), query: listTermDepositsQuery }),
  termDepositController.listByCustomer
);
customerRoutes.post(
  "/:id/loans",
  requireIdempotencyKey(),
  validate({ params: idParam("id"), body: createLoanBody }),
  loanController.create
);
