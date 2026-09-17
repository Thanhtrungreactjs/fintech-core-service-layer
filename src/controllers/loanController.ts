import { Request, Response } from "express";
import { loanService } from "../services/loanService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const loanController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const loan = await loanService.create(Number(req.params.id), req.body);
    res.status(201).json(success(loan));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const loan = await loanService.getById(Number(req.params.id));
    res.json(success(loan));
  }),

  listPayments: asyncHandler(async (req: Request, res: Response) => {
    const payments = await loanService.listPayments(Number(req.params.id));
    res.json(success(payments));
  }),

  payInstallment: asyncHandler(async (req: Request, res: Response) => {
    const payment = await loanService.payInstallment(
      Number(req.params.id),
      Number(req.params.paymentId),
      req.body.amount_paid,
      req.body.paid_date
    );
    res.json(success(payment));
  }),
};
