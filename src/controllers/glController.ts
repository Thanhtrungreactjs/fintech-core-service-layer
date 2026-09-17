import { Request, Response } from "express";
import { glService } from "../services/glService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const glController = {
  listAccounts: asyncHandler(async (_req: Request, res: Response) => {
    const accounts = await glService.listAccounts();
    res.json(success(accounts));
  }),

  trialBalance: asyncHandler(async (_req: Request, res: Response) => {
    const tb = await glService.trialBalance();
    res.json(success(tb));
  }),

  accountLedger: asyncHandler(async (req: Request, res: Response) => {
    const { page, size } = req.query as unknown as { page: number; size: number };
    const { rows, total } = await glService.accountLedger(req.params.code, { page, size });
    res.json(success(rows, { total, page, size }));
  }),

  transactionEntries: asyncHandler(async (req: Request, res: Response) => {
    const entries = await glService.transactionEntries(Number(req.params.id));
    res.json(success(entries));
  }),
};
