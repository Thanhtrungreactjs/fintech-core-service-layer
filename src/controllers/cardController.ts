import { Request, Response } from "express";
import { cardService } from "../services/cardService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const cardController = {
  issue: asyncHandler(async (req: Request, res: Response) => {
    const card = await cardService.issue(
      Number(req.params.id),
      req.body.card_type,
      req.body.expiry_date
    );
    res.status(201).json(success(card));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const card = await cardService.getById(Number(req.params.id));
    res.json(success(card));
  }),

  listByAccount: asyncHandler(async (req: Request, res: Response) => {
    const cards = await cardService.listByAccount(Number(req.params.id));
    res.json(success(cards));
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const card = await cardService.updateStatus(Number(req.params.id), req.body.status);
    res.json(success(card));
  }),
};
