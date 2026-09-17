import { Request, Response } from "express";
import { merchantService } from "../services/merchantService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const merchantController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, size } = req.query as unknown as { page: number; size: number };
    const { rows, total } = await merchantService.list({ page, size });
    res.json(success(rows, { total, page, size }));
  }),
};
