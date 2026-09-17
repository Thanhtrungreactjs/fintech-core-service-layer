-- =====================================================================
-- Module "Close of Business" (COB — batch xử lý cuối ngày) — bản Postgres.
-- T24 thật chạy COB mỗi đêm để: tự động đáo hạn tiền gửi tới hạn, phân
-- loại nợ quá hạn (NPL — Non-Performing Loan, chuẩn Basel: quá hạn > 90
-- ngày -> defaulted), và ghi log lại toàn bộ lần chạy để audit. Ở đây COB
-- được trigger thủ công qua API/nút bấm (không có scheduler thật), nhưng
-- logic xử lý giống hệt batch thật.
-- An toàn để chạy lại nhiều lần.
-- Chạy sau db/migrations/005_loan_account_link.sql:
--   psql "$DATABASE_URL" -f db/migrations/006_close_of_business.sql
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE cob_run_status_t AS ENUM ('completed', 'completed_with_errors');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS cob_runs (
    cob_run_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    run_date                  DATE NOT NULL,
    started_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at                   TIMESTAMPTZ NULL,
    term_deposits_matured          INTEGER NOT NULL DEFAULT 0,
    loans_marked_defaulted           INTEGER NOT NULL DEFAULT 0,
    errors_count                       INTEGER NOT NULL DEFAULT 0,
    status                               cob_run_status_t NOT NULL DEFAULT 'completed',
    details                               JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_cob_runs_date ON cob_runs(run_date);
