import { Request, Response } from "express";
import { accountTypeService } from "../services/accountTypeService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const accountTypeController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const types = await accountTypeService.list();
    res.json(success(types));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const type = await accountTypeService.create(req.body.type_name, req.body.interest_rate);
    res.status(201).json(success(type));
  }),
};
