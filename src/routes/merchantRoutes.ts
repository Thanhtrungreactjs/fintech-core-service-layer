import { Router } from "express";
import { merchantController } from "../controllers/merchantController";
import { validate } from "../middleware/validate";
import { paginationSchema } from "../utils/pagination";

export const merchantRoutes = Router();

merchantRoutes.get("/", validate({ query: paginationSchema }), merchantController.list);
