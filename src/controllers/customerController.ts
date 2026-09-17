import { Request, Response } from "express";
import { customerService } from "../services/customerService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const customerController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const customer = await customerService.create(req.body);
    res.status(201).json(success(customer));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const customer = await customerService.getById(Number(req.params.id));
    res.json(success(customer));
  }),

  search: asyncHandler(async (req: Request, res: Response) => {
    const { page, size, email, kyc_status, referred_by } = req.query as unknown as {
      page: number;
      size: number;
      email?: string;
      kyc_status?: "pending" | "verified" | "rejected";
      referred_by?: number;
    };
    const { rows, total } = await customerService.search(
      { email, kycStatus: kyc_status, referredBy: referred_by },
      { page, size }
    );
    res.json(success(rows, { total, page, size }));
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const customer = await customerService.update(Number(req.params.id), req.body);
    res.json(success(customer));
  }),

  updateKyc: asyncHandler(async (req: Request, res: Response) => {
    const customer = await customerService.updateKyc(Number(req.params.id), req.body.kyc_status);
    res.json(success(customer));
  }),

  referrals: asyncHandler(async (req: Request, res: Response) => {
    const referrals = await customerService.getReferrals(Number(req.params.id));
    res.json(success(referrals));
  }),
};
