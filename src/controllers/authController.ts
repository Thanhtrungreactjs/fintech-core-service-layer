import { Request, Response } from "express";
import { authService } from "../services/authService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const authController = {
  login: asyncHandler(async (req: Request, res: Response) => {
    const { token, user } = await authService.login(req.body.username, req.body.password);
    res.json(success({ token, user }));
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    res.json(success(req.user));
  }),
};
