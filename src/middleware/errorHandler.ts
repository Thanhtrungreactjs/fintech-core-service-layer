import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
import { failure } from "../utils/envelope";

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json(failure("ROUTE_NOT_FOUND", "Endpoint không tồn tại"));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(failure(err.code, err.message));
    return;
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    res.status(422).json(failure("VALIDATION_ERROR", message));
    return;
  }
  console.error(err);
  res.status(500).json(failure("INTERNAL_ERROR", "Lỗi hệ thống"));
}
