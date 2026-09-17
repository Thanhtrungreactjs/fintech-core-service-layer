import { Router } from "express";
import { cardController } from "../controllers/cardController";
import { validate } from "../middleware/validate";
import { idParam } from "../validators/common";
import { updateCardStatusBody } from "../validators/cardSchemas";

export const cardRoutes = Router();

cardRoutes.get("/:id", validate({ params: idParam("id") }), cardController.getById);
cardRoutes.patch(
  "/:id/status",
  validate({ params: idParam("id"), body: updateCardStatusBody }),
  cardController.updateStatus
);
