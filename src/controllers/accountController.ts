import { Request, Response } from "express";
import { accountService } from "../services/accountService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const accountController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const account = await accountService.create(req.body);
    res.status(201).json(success(account));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const account = await accountService.getById(Number(req.params.id));
    res.json(success(account));
  }),

  listByCustomer: asyncHandler(async (req: Request, res: Response) => {
    const { page, size } = req.query as unknown as { page: number; size: number };
    const { rows, total } = await accountService.listByCustomer(Number(req.params.id), {
      page,
      size,
    });
    res.json(success(rows, { total, page, size }));
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const account = await accountService.updateStatus(Number(req.params.id), req.body.status);
    res.json(success(account));
  }),

  balanceHistory: asyncHandler(async (req: Request, res: Response) => {
    const history = await accountService.getBalanceHistory(Number(req.params.id));
    res.json(success(history));
  }),
};
