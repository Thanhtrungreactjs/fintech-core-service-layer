import { Request, Response } from "express";
import { creditScoreService } from "../services/creditScoreService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const creditScoreController = {
  assess: asyncHandler(async (req: Request, res: Response) => {
    const result = await creditScoreService.assess(Number(req.params.id));
    res.json(success(result));
  }),
};
