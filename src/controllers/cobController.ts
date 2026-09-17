import { Request, Response } from "express";
import { cobService } from "../services/cobService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const cobController = {
  run: asyncHandler(async (req: Request, res: Response) => {
    const run = await cobService.run(req.body.as_of_date);
    res.status(201).json(success(run));
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    const { page, size } = req.query as unknown as { page: number; size: number };
    const { rows, total } = await cobService.history(size, (page - 1) * size);
    res.json(success(rows, { total, page, size }));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const run = await cobService.getById(Number(req.params.id));
    res.json(success(run));
  }),
};
