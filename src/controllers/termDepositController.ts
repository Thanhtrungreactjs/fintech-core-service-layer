import { Request, Response } from "express";
import { termDepositService } from "../services/termDepositService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const termDepositController = {
  open: asyncHandler(async (req: Request, res: Response) => {
    const deposit = await termDepositService.open(req.body);
    res.status(201).json(success(deposit));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const deposit = await termDepositService.getById(Number(req.params.id));
    res.json(success(deposit));
  }),

  listByAccount: asyncHandler(async (req: Request, res: Response) => {
    const { page, size } = req.query as unknown as { page: number; size: number };
    const { rows, total } = await termDepositService.listByAccount(Number(req.params.id), { page, size });
    res.json(success(rows, { total, page, size }));
  }),

  listByCustomer: asyncHandler(async (req: Request, res: Response) => {
    const { page, size } = req.query as unknown as { page: number; size: number };
    const { rows, total } = await termDepositService.listByCustomer(Number(req.params.id), { page, size });
    res.json(success(rows, { total, page, size }));
  }),

  accruedInterest: asyncHandler(async (req: Request, res: Response) => {
    const info = await termDepositService.accruedInterestToDate(Number(req.params.id));
    res.json(success(info));
  }),

  listPostings: asyncHandler(async (req: Request, res: Response) => {
    const postings = await termDepositService.listPostings(Number(req.params.id));
    res.json(success(postings));
  }),

  postMonthlyInterest: asyncHandler(async (req: Request, res: Response) => {
    const posting = await termDepositService.postMonthlyInterest(Number(req.params.id), req.body.value_date);
    res.json(success(posting));
  }),

  withdrawEarly: asyncHandler(async (req: Request, res: Response) => {
    const result = await termDepositService.withdrawEarly(Number(req.params.id), req.body.value_date);
    res.json(success(result));
  }),

  mature: asyncHandler(async (req: Request, res: Response) => {
    const result = await termDepositService.mature(Number(req.params.id), req.body.value_date);
    res.json(success(result));
  }),
};
