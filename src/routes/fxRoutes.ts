import { Router } from "express";
import { fxController } from "../controllers/fxController";
import { validate } from "../middleware/validate";
import { requireIdempotencyKey } from "../middleware/idempotency";
import { fxConvertBody } from "../validators/fxSchemas";

export const fxRoutes = Router();

fxRoutes.post("/", requireIdempotencyKey(), validate({ body: fxConvertBody }), fxController.convert);
