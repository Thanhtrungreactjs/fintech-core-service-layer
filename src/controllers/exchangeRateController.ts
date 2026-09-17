import { Request, Response } from "express";
import { exchangeRateService } from "../services/exchangeRateService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const exchangeRateController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const { from, to, date } = req.query as unknown as { from: string; to: string; date: string };
    const rate = await exchangeRateService.getAsOf(from, to, date);
    res.json(success(rate));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const rate = await exchangeRateService.create(req.body);
    res.status(201).json(success(rate));
  }),
};
