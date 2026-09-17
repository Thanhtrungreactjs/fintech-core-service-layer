-- =====================================================================
-- Module "General Ledger" (Sổ cái kế toán kép) — bản Postgres.
-- Đây là phần lõi thật sự phân biệt 1 core banking system (T24, Finacle...)
-- với 1 app CRUD thông thường: MỌI giao dịch tiền phải hạch toán thành 1
-- cặp bút toán Nợ/Có cân bằng vào sổ cái (gl_entries), không chỉ cộng/trừ
-- balance trực tiếp trên accounts như trước đây. Cho phép chạy báo cáo
-- "Bảng cân đối thử" (Trial Balance): tổng Nợ luôn = tổng Có toàn hệ thống.
-- An toàn để chạy lại nhiều lần.
-- Chạy sau db/migrations/002_term_deposits.sql:
--   psql "$DATABASE_URL" -f db/migrations/003_general_ledger.sql
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE gl_account_class_t AS ENUM ('asset', 'liability', 'equity', 'income', 'expense');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE gl_normal_balance_t AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE gl_entry_side_t AS ENUM ('debit', 'credit');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- gl_accounts — Hệ thống tài khoản kế toán (Chart of Accounts) rút gọn.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gl_accounts (
    gl_account_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code               VARCHAR(10) NOT NULL,
    name                VARCHAR(150) NOT NULL,
    account_class        gl_account_class_t NOT NULL,
    normal_balance        gl_normal_balance_t NOT NULL,
    CONSTRAINT uq_gl_accounts_code UNIQUE (code)
);

-- ---------------------------------------------------------------------
-- gl_entries — Bút toán sổ cái. Mỗi transactions/nghiệp vụ tiền tạo ra
-- ĐÚNG 1 cặp dòng (1 debit + 1 credit) cùng amount, cùng transaction_id,
-- đảm bảo bất biến kế toán kép: SUM(debit) luôn = SUM(credit) toàn hệ thống.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gl_entries (
    gl_entry_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id       BIGINT NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    gl_account_id         INTEGER NOT NULL REFERENCES gl_accounts(gl_account_id) ON DELETE RESTRICT,
    entry_side              gl_entry_side_t NOT NULL,
    amount                   DECIMAL(18,2) NOT NULL CHECK (amount > 0),
    entry_date                 DATE NOT NULL,
    description                 VARCHAR(255),
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gl_entries_transaction ON gl_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_gl_entries_account ON gl_entries(gl_account_id);
CREATE INDEX IF NOT EXISTS idx_gl_entries_date ON gl_entries(entry_date);

-- ---------------------------------------------------------------------
-- gl_posting_rules — Ánh xạ txn_type -> cặp tài khoản Nợ/Có mặc định,
-- dùng cho các giao dịch tài khoản thông thường (không thuộc tiền gửi có
-- kỳ hạn — sổ tiết kiệm hạch toán qua cặp TK 2000/2100 riêng, xem
-- termDepositService, vì đó là chuyển loại tiền gửi chứ không phát sinh
-- tiền mặt như rút/nộp thường).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gl_posting_rules (
    txn_type            txn_type_t NOT NULL PRIMARY KEY,
    debit_account_code    VARCHAR(10) NOT NULL REFERENCES gl_accounts(code),
    credit_account_code    VARCHAR(10) NOT NULL REFERENCES gl_accounts(code)
);

-- Chart of accounts rút gọn cho 1 ngân hàng bán lẻ đơn giản.
INSERT INTO gl_accounts (code, name, account_class, normal_balance) VALUES
    ('1000', 'Tiền mặt và ngân quỹ',                 'asset',     'debit'),
    ('1100', 'Dư nợ cho vay khách hàng',               'asset',     'debit'),
    ('2000', 'Tiền gửi thanh toán khách hàng',          'liability', 'credit'),
    ('2100', 'Tiền gửi có kỳ hạn khách hàng',            'liability', 'credit'),
    ('4000', 'Thu nhập lãi cho vay',                      'income',    'credit'),
    ('4100', 'Thu nhập phí dịch vụ',                        'income',    'credit'),
    ('5000', 'Chi phí lãi tiền gửi',                          'expense',   'debit')
ON CONFLICT (code) DO NOTHING;

-- Quy tắc hạch toán mặc định theo txn_type cho giao dịch tài khoản thông thường.
INSERT INTO gl_posting_rules (txn_type, debit_account_code, credit_account_code) VALUES
    ('deposit',    '1000', '2000'),  -- Nộp tiền: Nợ Tiền mặt / Có Tiền gửi thanh toán
    ('withdrawal', '2000', '1000'),  -- Rút tiền: Nợ Tiền gửi thanh toán / Có Tiền mặt
    ('transfer',   '2000', '2000'),  -- Chuyển khoản nội bộ: Nợ/Có cùng TK 2000 (không phát sinh tiền mặt)
    ('payment',    '2000', '1000'),  -- Thanh toán merchant: Nợ Tiền gửi thanh toán / Có Tiền mặt
    ('fee',        '2000', '4100'),  -- Phí dịch vụ: Nợ Tiền gửi thanh toán / Có Thu nhập phí
    ('interest',   '5000', '2000')   -- Trả lãi: Nợ Chi phí lãi / Có Tiền gửi thanh toán
ON CONFLICT (txn_type) DO NOTHING;
