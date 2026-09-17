import { Router } from "express";
import { accountController } from "../controllers/accountController";
import { cardController } from "../controllers/cardController";
import { transactionController } from "../controllers/transactionController";
import { termDepositController } from "../controllers/termDepositController";
import { validate } from "../middleware/validate";
import { idParam } from "../validators/common";
import { createAccountBody, updateAccountStatusBody } from "../validators/accountSchemas";
import { issueCardBody } from "../validators/cardSchemas";
import { listAccountTransactionsQuery } from "../validators/transactionSchemas";
import { listTermDepositsQuery } from "../validators/termDepositSchemas";

export const accountRoutes = Router();

accountRoutes.post("/", validate({ body: createAccountBody }), accountController.create);
accountRoutes.get("/:id", validate({ params: idParam("id") }), accountController.getById);
accountRoutes.patch(
  "/:id/status",
  validate({ params: idParam("id"), body: updateAccountStatusBody }),
  accountController.updateStatus
);
accountRoutes.get(
  "/:id/balance-history",
  validate({ params: idParam("id") }),
  accountController.balanceHistory
);
accountRoutes.post(
  "/:id/cards",
  validate({ params: idParam("id"), body: issueCardBody }),
  cardController.issue
);
accountRoutes.get(
  "/:id/cards",
  validate({ params: idParam("id") }),
  cardController.listByAccount
);
accountRoutes.get(
  "/:id/transactions",
  validate({ params: idParam("id"), query: listAccountTransactionsQuery }),
  transactionController.listByAccount
);
accountRoutes.get(
  "/:id/term-deposits",
  validate({ params: idParam("id"), query: listTermDepositsQuery }),
  termDepositController.listByAccount
);
