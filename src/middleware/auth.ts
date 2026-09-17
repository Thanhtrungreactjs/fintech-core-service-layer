import { NextFunction, Request, Response } from "express";
import { authService, AuthTokenPayload } from "../services/authService";
import { Errors } from "../utils/errors";
import { asyncHandler } from "../utils/asyncHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/** Bắt buộc header Authorization: Bearer <token> hợp lệ — gắn req.user, dùng làm nguồn
 * duy nhất cho maker_id/checker_id (không còn nhận từ request body). */
export function requireAuth() {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      throw Errors.unauthorized("Thiếu header Authorization: Bearer <token>");
    }
    const token = header.slice("Bearer ".length);
    req.user = authService.verifyToken(token);
    next();
  });
}
