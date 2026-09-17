import { Request, Response } from "express";
import { fxService } from "../services/fxService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";

export const fxController = {
  convert: asyncHandler(async (req: Request, res: Response) => {
    const result = await fxService.convert(req.body);
    res.status(201).json(success(result));
  }),
};
