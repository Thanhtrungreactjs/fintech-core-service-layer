-- =====================================================================
-- Module "Tiền gửi có kỳ hạn" (Term Deposit / Sổ tiết kiệm) — bản Postgres.
-- Không thuộc 11 bảng nghiệp vụ gốc — bổ sung để hỗ trợ các case tính lãi
-- khó của ngân hàng lõi: lãi đơn, lãi kép, lãi dự thu, rút trước hạn (phạt
-- lãi không kỳ hạn), đáo hạn tái tục gốc+lãi hoặc tất toán.
-- An toàn để chạy lại nhiều lần: CREATE TYPE bọc DO-block bắt lỗi
-- duplicate_object, CREATE TABLE dùng IF NOT EXISTS.
-- Chạy sau db/schema.postgres.sql và db/migrations/001_idempotency_keys.sql:
--   psql "$DATABASE_URL" -f db/migrations/002_term_deposits.sql
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE term_deposit_status_t AS ENUM ('active', 'matured', 'withdrawn', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE interest_method_t AS ENUM ('simple', 'compound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE td_payout_method_t AS ENUM ('maturity', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE day_count_t AS ENUM ('actual_365', 'actual_360');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE td_posting_type_t AS ENUM ('monthly_payout', 'maturity_settlement', 'early_withdrawal_settlement');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- term_deposits — Sổ tiết kiệm / tiền gửi có kỳ hạn.
-- account_id: tài khoản thanh toán dùng để trích nộp gốc lúc mở sổ và
-- nhận lại gốc/lãi lúc tất toán (bản thân sổ không phải 1 "account" có
-- balance riêng, giống cách loans không phải account trong schema gốc).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS term_deposits (
    term_deposit_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id              BIGINT NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    principal_amount        DECIMAL(18,2) NOT NULL CHECK (principal_amount > 0),
    interest_rate           DECIMAL(6,3) NOT NULL CHECK (interest_rate >= 0),
    term_months              INTEGER NOT NULL CHECK (term_months > 0),
    interest_method          interest_method_t NOT NULL DEFAULT 'simple',
    payout_method             td_payout_method_t NOT NULL DEFAULT 'maturity',
    day_count_convention      day_count_t NOT NULL DEFAULT 'actual_365',
    early_withdrawal_rate     DECIMAL(6,3) NOT NULL DEFAULT 0.20 CHECK (early_withdrawal_rate >= 0),
    auto_renewal              BOOLEAN NOT NULL DEFAULT false,
    start_date                DATE NOT NULL,
    maturity_date             DATE NOT NULL,
    status                    term_deposit_status_t NOT NULL DEFAULT 'active',
    renewed_from_id           BIGINT NULL REFERENCES term_deposits(term_deposit_id) ON DELETE SET NULL,
    closed_date               DATE NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_term_deposits_account ON term_deposits(account_id);
CREATE INDEX IF NOT EXISTS idx_term_deposits_status ON term_deposits(status);

-- ---------------------------------------------------------------------
-- term_deposit_postings — lịch sử ghi nhận lãi (trả lãi tháng / tất toán
-- đáo hạn / tất toán rút trước hạn), mỗi dòng khớp với 1 transaction thực
-- tế trên account (transaction_id) để truy vết đầy đủ.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS term_deposit_postings (
    posting_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    term_deposit_id      BIGINT NOT NULL REFERENCES term_deposits(term_deposit_id) ON DELETE CASCADE,
    posting_type          td_posting_type_t NOT NULL,
    period_from            DATE NOT NULL,
    period_to              DATE NOT NULL,
    days                   INTEGER NOT NULL CHECK (days >= 0),
    interest_amount        DECIMAL(18,2) NOT NULL,
    transaction_id          BIGINT NULL REFERENCES transactions(transaction_id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_td_postings_deposit ON term_deposit_postings(term_deposit_id);

-- Danh mục giao dịch dùng cho lãi tiền gửi (txn_type='interest' đã có sẵn trong
-- txn_type_t nhưng schema gốc chưa từng seed category cho nó).
INSERT INTO transaction_categories (category_name, category_group) VALUES
    ('Interest', 'income')
ON CONFLICT (category_name) DO NOTHING;
