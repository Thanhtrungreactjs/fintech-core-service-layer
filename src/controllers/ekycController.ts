import { Request, Response } from "express";
import multer from "multer";
import { ekycService } from "../services/ekycService";
import { success } from "../utils/envelope";
import { asyncHandler } from "../utils/asyncHandler";
import { Errors } from "../utils/errors";

export const ekycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
}).single("id_image");

export const ekycController = {
  verify: asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      throw Errors.validation("Thiếu ảnh giấy tờ (field 'id_image')");
    }
    const faceMatchScoreRaw = req.body.face_match_score;
    const faceMatchScore =
      faceMatchScoreRaw !== undefined && faceMatchScoreRaw !== "" ? Number(faceMatchScoreRaw) : null;
    if (faceMatchScore !== null && (!Number.isFinite(faceMatchScore) || faceMatchScore < 0 || faceMatchScore > 100)) {
      throw Errors.validation("face_match_score phải là số từ 0 đến 100");
    }
    const result = await ekycService.verify(Number(req.params.id), req.file.buffer, faceMatchScore);
    res.status(201).json(success(result));
  }),

  listByCustomer: asyncHandler(async (req: Request, res: Response) => {
    const rows = await ekycService.listByCustomer(Number(req.params.id));
    res.json(success(rows));
  }),
};
