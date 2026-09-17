import crypto from "node:crypto";
import { NextFunction, Request, Response } from "express";
import { idempotencyRepository } from "../repositories/idempotencyRepository";
import { AppError, Errors } from "../utils/errors";
import { asyncHandler } from "../utils/asyncHandler";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const WAIT_ATTEMPTS = 10;
const WAIT_INTERVAL_MS = 150;

/**
 * Bắt buộc header Idempotency-Key cho các POST tạo giao dịch tài chính
 * (api-design.md mục 1). Request thứ 2 trở đi với cùng key + cùng endpoint
 * trả lại y nguyên response đã lưu thay vì ghi dữ liệu lần nữa; nếu key
 * trùng nhưng body khác thì coi là lỗi (tránh client tái sử dụng key sai).
 *
 * Giữ chỗ bằng INSERT ngay ĐẦU request (trước khi chạy business logic), không
 * phải check-rồi-lưu-ở-cuối như bản trước — bản trước có race: 2 request đồng
 * thời cùng key đều SELECT ra "chưa có" rồi đều chạy trọn business logic, tạo
 * 2 bản ghi thật (tái hiện được bằng test: cùng 1 key gửi đồng thời vẫn ra 2
 * transaction_id khác nhau). PRIMARY KEY (idempotency_key, endpoint) của bảng
 * khiến INSERT giữ chỗ chỉ 1 request "thắng" được — atomic ở tầng DB, không
 * phụ thuộc timing của Node.
 */
export function requireIdempotencyKey() {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const key = req.header("Idempotency-Key");
    if (!key) {
      throw new AppError("IDEMPOTENCY_KEY_REQUIRED", "Header Idempotency-Key là bắt buộc", 400);
    }

    const endpoint = `${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;
    const requestHash = crypto.createHash("sha256").update(JSON.stringify(req.body ?? {})).digest("hex");

    const claimed = await idempotencyRepository.tryClaim(key, endpoint, requestHash);

    if (!claimed) {
      // Không giữ được chỗ -> đã có request khác (đang xử lý hoặc đã xong) đứng trước.
      // Poll ngắn chờ request đó hoàn tất rồi trả lại đúng response của nó.
      for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt++) {
        const existing = await idempotencyRepository.find(key, endpoint);
        if (existing && existing.status_code !== null) {
          if (existing.request_hash !== requestHash) {
            throw Errors.conflict(
              "IDEMPOTENCY_KEY_CONFLICT",
              "Idempotency-Key đã được dùng với nội dung request khác"
            );
          }
          res.status(existing.status_code).json(existing.response_body);
          return;
        }
        await sleep(WAIT_INTERVAL_MS);
      }
      throw Errors.conflict(
        "IDEMPOTENCY_KEY_IN_PROGRESS",
        "Request với Idempotency-Key này đang được xử lý ở nơi khác, vui lòng thử lại sau giây lát"
      );
    }

    // Giữ chỗ thành công -> request này được chạy business logic. Điền kết quả thật vào
    // chỗ đã giữ khi response rời server (đúng cho cả nhánh thành công lẫn lỗi nghiệp vụ,
    // vì error handler toàn cục cũng gọi res.json trên cùng object này).
    const originalJson = res.json.bind(res);
    res.json = (async (body: unknown) => {
      try {
        await idempotencyRepository.complete(key, endpoint, res.statusCode, body);
      } catch (err) {
        console.error("Failed to persist idempotency record", err);
      }
      return originalJson(body);
    }) as unknown as Response["json"];

    next();
  });
}
