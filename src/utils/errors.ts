/** Lỗi nghiệp vụ có mã code (khớp envelope.error.code trong api-design.md). */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const Errors = {
  notFound: (resource: string, id: string | number) =>
    new AppError(
      `${resource.toUpperCase()}_NOT_FOUND`,
      `${resource} ${id} không tồn tại`,
      404
    ),
  validation: (message: string) => new AppError("VALIDATION_ERROR", message, 422),
  conflict: (code: string, message: string) => new AppError(code, message, 409),
  business: (code: string, message: string) => new AppError(code, message, 400),
  unauthorized: (message: string) => new AppError("UNAUTHORIZED", message, 401),
  forbidden: (message: string) => new AppError("FORBIDDEN", message, 403),
};
