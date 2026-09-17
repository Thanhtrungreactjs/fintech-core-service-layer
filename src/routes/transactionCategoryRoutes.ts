import { Router } from "express";
import { transactionCategoryController } from "../controllers/transactionCategoryController";

export const transactionCategoryRoutes = Router();

transactionCategoryRoutes.get("/", transactionCategoryController.list);
