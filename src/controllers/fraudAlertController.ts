import { Request, Response } from "express";
import { fraudAlertService } from "../services/fraudAlertService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const fraudAlertController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, size, status, min_risk_score } = req.query as unknown as {
      page: number;
      size: number;
      status?: "open" | "reviewing" | "closed_fp" | "closed_confirmed";
      min_risk_score?: number;
    };
    const { rows, total } = await fraudAlertService.list(
      { status, minRiskScore: min_risk_score },
      { page, size }
    );
    res.json(success(rows, { total, page, size }));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const alert = await fraudAlertService.getById(Number(req.params.id));
    res.json(success(alert));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const alert = await fraudAlertService.create(
      req.body.transaction_id,
      req.body.risk_score,
      req.body.alert_type
    );
    res.status(201).json(success(alert));
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const alert = await fraudAlertService.updateStatus(Number(req.params.id), req.body.status);
    res.json(success(alert));
  }),
};
