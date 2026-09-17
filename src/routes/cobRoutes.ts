import { Router } from "express";
import { cobController } from "../controllers/cobController";
import { validate } from "../middleware/validate";
import { idParam } from "../validators/common";
import { runCobBody, listCobRunsQuery } from "../validators/cobSchemas";

export const cobRoutes = Router();

cobRoutes.post("/run", validate({ body: runCobBody }), cobController.run);
cobRoutes.get("/runs", validate({ query: listCobRunsQuery }), cobController.history);
cobRoutes.get("/runs/:id", validate({ params: idParam("id") }), cobController.getById);
