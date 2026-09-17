import { Router } from "express";
import { authController } from "../controllers/authController";
import { validate } from "../middleware/validate";
import { requireAuth } from "../middleware/auth";
import { loginBody } from "../validators/authSchemas";

export const authRoutes = Router();

authRoutes.post("/login", validate({ body: loginBody }), authController.login);
authRoutes.get("/me", requireAuth(), authController.me);
