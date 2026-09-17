import { Router } from "express";
import { authQueueController } from "../controllers/authQueueController";

export const appUserRoutes = Router();

appUserRoutes.get("/", authQueueController.listUsers);
