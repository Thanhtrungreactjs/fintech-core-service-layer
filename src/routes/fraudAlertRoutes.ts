import { Router } from "express";
import { fraudAlertController } from "../controllers/fraudAlertController";
import { validate } from "../middleware/validate";
import { idParam } from "../validators/common";
import {
  createFraudAlertBody,
  listFraudAlertsQuery,
  updateFraudAlertStatusBody,
} from "../validators/fraudAlertSchemas";

export const fraudAlertRoutes = Router();

fraudAlertRoutes.get("/", validate({ query: listFraudAlertsQuery }), fraudAlertController.list);
fraudAlertRoutes.get("/:id", validate({ params: idParam("id") }), fraudAlertController.getById);
fraudAlertRoutes.post("/", validate({ body: createFraudAlertBody }), fraudAlertController.create);
fraudAlertRoutes.patch(
  "/:id/status",
  validate({ params: idParam("id"), body: updateFraudAlertStatusBody }),
  fraudAlertController.updateStatus
);
