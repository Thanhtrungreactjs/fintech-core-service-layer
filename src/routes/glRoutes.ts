import { Router } from "express";
import { glController } from "../controllers/glController";
import { validate } from "../middleware/validate";
import { idParam } from "../validators/common";
import { glAccountCodeParam, listGlEntriesQuery } from "../validators/glSchemas";

export const glRoutes = Router();

glRoutes.get("/accounts", glController.listAccounts);
glRoutes.get("/trial-balance", glController.trialBalance);
glRoutes.get(
  "/accounts/:code/entries",
  validate({ params: glAccountCodeParam, query: listGlEntriesQuery }),
  glController.accountLedger
);
glRoutes.get(
  "/transactions/:id/entries",
  validate({ params: idParam("id") }),
  glController.transactionEntries
);
