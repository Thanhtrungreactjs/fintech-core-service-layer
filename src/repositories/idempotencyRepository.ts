import { pool } from "../db/pool";

interface IdempotencyRow {
  idempotency_key: string;
  endpoint: string;
  request_hash: string;
  status_code: number | null;
  response_body: unknown;
}

export const idempotencyRepository = {
  async find(key: string, endpoint: string) {
    const { rows } = await pool.query<IdempotencyRow>(
      `SELECT * FROM idempotency_keys WHERE idempotency_key = :key AND endpoint = :endpoint`,
      { key, endpoint }
    );
    return rows[0] ?? null;
  },

  /**
   * Giữ chỗ (key, endpoint) một cách ATOMIC bằng INSERT — PRIMARY KEY của bảng tự đảm
   * bảo chỉ đúng 1 request "thắng" khi có 2 request đồng thời cùng key. Trả về true nếu
   * request này giữ được chỗ (được phép chạy business logic); false nếu đã có request
   * khác (đang xử lý hoặc đã xong) giữ chỗ trước.
   */
  async tryClaim(key: string, endpoint: string, requestHash: string): Promise<boolean> {
    const { rows } = await pool.query(
      `INSERT INTO idempotency_keys (idempotency_key, endpoint, request_hash, status_code, response_body)
       VALUES (:key, :endpoint, :requestHash, NULL, NULL)
       ON CONFLICT (idempotency_key, endpoint) DO NOTHING
       RETURNING idempotency_key`,
      { key, endpoint, requestHash }
    );
    return rows.length > 0;
  },

  /** Điền kết quả thật vào chỗ đã giữ trước đó — gọi sau khi request xử lý xong (thành công hoặc lỗi). */
  async complete(key: string, endpoint: string, statusCode: number, responseBody: unknown) {
    await pool.query(
      `UPDATE idempotency_keys SET status_code = :statusCode, response_body = :responseBody::jsonb
       WHERE idempotency_key = :key AND endpoint = :endpoint`,
      { key, endpoint, statusCode, responseBody: JSON.stringify(responseBody) }
    );
  },
};
