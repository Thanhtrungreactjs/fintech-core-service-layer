import { Request, Response } from "express";
import { authQueueService } from "../services/authQueueService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const authQueueController = {
  listUsers: asyncHandler(async (_req: Request, res: Response) => {
    const users = await authQueueService.listUsers();
    res.json(success(users));
  }),

  enqueue: asyncHandler(async (req: Request, res: Response) => {
    const { operation_type, payload } = req.body;
    const entry = await authQueueService.enqueue(operation_type, payload, req.user!.user_id);
    res.status(201).json(success(entry));
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const { page, size, status } = req.query as unknown as {
      page: number;
      size: number;
      status?: "pending" | "authorized" | "rejected";
    };
    const { rows, total } = await authQueueService.list(status, { page, size });
    res.json(success(rows, { total, page, size }));
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const entry = await authQueueService.getById(Number(req.params.id));
    res.json(success(entry));
  }),

  authorize: asyncHandler(async (req: Request, res: Response) => {
    const entry = await authQueueService.authorize(Number(req.params.id), req.user!.user_id);
    res.json(success(entry));
  }),

  reject: asyncHandler(async (req: Request, res: Response) => {
    const entry = await authQueueService.reject(Number(req.params.id), req.user!.user_id, req.body.reason);
    res.json(success(entry));
  }),
};
