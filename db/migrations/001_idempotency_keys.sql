-- =====================================================================
-- Bảng hạ tầng cho Idempotency-Key (api-design.md mục 1) — bản Postgres.
-- Không thuộc 11 bảng nghiệp vụ gốc trong db/schema.postgres.sql — cần
-- thiết để service layer lưu lại response đã xử lý cho mỗi (endpoint, key),
-- tránh double-post khi client retry POST /transactions hoặc
-- POST /loans/{id}/payments/{paymentId}/pay.
-- Chạy sau db/schema.postgres.sql.
-- =====================================================================
CREATE TABLE IF NOT EXISTS idempotency_keys (
    idempotency_key   VARCHAR(100) NOT NULL,
    endpoint          VARCHAR(150) NOT NULL,
    request_hash      CHAR(64) NOT NULL,
    status_code       SMALLINT NOT NULL,
    response_body     JSONB NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (idempotency_key, endpoint)
);
