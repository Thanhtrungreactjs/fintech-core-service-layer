import { Router } from "express";
import { accountTypeController } from "../controllers/accountTypeController";
import { validate } from "../middleware/validate";
import { createAccountTypeBody } from "../validators/accountSchemas";

export const accountTypeRoutes = Router();

accountTypeRoutes.get("/", accountTypeController.list);
accountTypeRoutes.post("/", validate({ body: createAccountTypeBody }), accountTypeController.create);
