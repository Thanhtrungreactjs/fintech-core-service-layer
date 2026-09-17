import { Request, Response } from "express";
import { transactionCategoryService } from "../services/transactionCategoryService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const transactionCategoryController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const categories = await transactionCategoryService.list();
    res.json(success(categories));
  }),
};
