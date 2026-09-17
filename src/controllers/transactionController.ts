import { Request, Response } from "express";
import { transactionService } from "../services/transactionService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";
import { TxnStatus, TxnType } from "../types/domain";

export const transactionController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const txn = await transactionService.create(req.body);
    res.status(201).json(success(txn));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const txn = await transactionService.getById(Number(req.params.id));
    res.json(success(txn));
  }),

  listByAccount: asyncHandler(async (req: Request, res: Response) => {
    const { page, size, txn_type, category_id, status, from, to } = req.query as unknown as {
      page: number;
      size: number;
      txn_type?: TxnType;
      category_id?: number;
      status?: TxnStatus;
      from?: string;
      to?: string;
    };
    const { rows, total } = await transactionService.listByAccount(
      Number(req.params.id),
      { txnType: txn_type, categoryId: category_id, status, from, to },
      { page, size }
    );
    res.json(success(rows, { total, page, size }));
  }),

  reverse: asyncHandler(async (req: Request, res: Response) => {
    const reversal = await transactionService.reverse(Number(req.params.id));
    res.status(201).json(success(reversal));
  }),
};
