-- =====================================================================
-- Fintech Core DB Schema — bản Postgres (dùng cho Supabase)
-- Dịch lại từ db/schema.sql (MySQL) do người dùng cung cấp; giữ nguyên
-- 11 bảng, PK/FK, index, constraint. Enum của MySQL -> CREATE TYPE ... ENUM
-- của Postgres; AUTO_INCREMENT -> GENERATED ALWAYS AS IDENTITY;
-- "ON UPDATE CURRENT_TIMESTAMP" (chỉ customers.updated_at) -> trigger.
-- Chạy trong Supabase SQL Editor hoặc `psql "$DATABASE_URL" -f db/schema.postgres.sql`.
-- =====================================================================

CREATE TYPE kyc_status_t AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE account_status_t AS ENUM ('active', 'dormant', 'frozen', 'closed');
CREATE TYPE card_type_t AS ENUM ('debit', 'credit', 'prepaid');
CREATE TYPE card_status_t AS ENUM ('active', 'blocked', 'expired');
CREATE TYPE category_group_t AS ENUM ('income', 'spending', 'transfer', 'fee');
CREATE TYPE txn_type_t AS ENUM ('deposit', 'withdrawal', 'transfer', 'payment', 'fee', 'interest');
CREATE TYPE txn_status_t AS ENUM ('pending', 'completed', 'failed', 'reversed');
CREATE TYPE loan_status_t AS ENUM ('active', 'closed', 'defaulted');
CREATE TYPE fraud_alert_status_t AS ENUM ('open', 'reviewing', 'closed_fp', 'closed_confirmed');

-- Dùng chung cho mọi bảng có updated_at (hiện chỉ customers).
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. customers — Khách hàng (bảng gốc / Party)
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    customer_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    phone           VARCHAR(20),
    dob             DATE,
    country         VARCHAR(50),
    kyc_status      kyc_status_t NOT NULL DEFAULT 'pending',
    referred_by     BIGINT NULL REFERENCES customers(customer_id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_customers_email UNIQUE (email)
);

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 2. account_types — Danh mục loại tài khoản
-- ---------------------------------------------------------------------
CREATE TABLE account_types (
    account_type_id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type_name       VARCHAR(50) NOT NULL,
    interest_rate   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT uq_account_types_name UNIQUE (type_name)
);

-- ---------------------------------------------------------------------
-- 3. accounts — Tài khoản (Arrangement)
-- ---------------------------------------------------------------------
CREATE TABLE accounts (
    account_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id     BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    account_type_id INTEGER NOT NULL REFERENCES account_types(account_type_id) ON DELETE RESTRICT,
    account_number  VARCHAR(30) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'VND',
    balance         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    status          account_status_t NOT NULL DEFAULT 'active',
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ NULL,
    CONSTRAINT uq_accounts_number UNIQUE (account_number)
);
CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_accounts_type ON accounts(account_type_id);

-- ---------------------------------------------------------------------
-- 4. cards — Thẻ ngân hàng
-- ---------------------------------------------------------------------
CREATE TABLE cards (
    card_id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id          BIGINT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
    card_number_masked  VARCHAR(25) NOT NULL,
    card_type           card_type_t NOT NULL,
    status              card_status_t NOT NULL DEFAULT 'active',
    expiry_date         DATE NOT NULL,
    issued_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cards_account ON cards(account_id);

-- ---------------------------------------------------------------------
-- 5. merchants — Điểm bán
-- ---------------------------------------------------------------------
CREATE TABLE merchants (
    merchant_id     BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    merchant_name   VARCHAR(150) NOT NULL,
    category        VARCHAR(50),
    country         VARCHAR(50)
);

-- ---------------------------------------------------------------------
-- 6. transaction_categories — Danh mục giao dịch
-- ---------------------------------------------------------------------
CREATE TABLE transaction_categories (
    category_id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_name   VARCHAR(50) NOT NULL,
    category_group  category_group_t NOT NULL,
    CONSTRAINT uq_categories_name UNIQUE (category_name)
);

-- ---------------------------------------------------------------------
-- 7. transactions — Bảng trung tâm
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
    transaction_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    account_id          BIGINT NOT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT,
    related_account_id  BIGINT NULL REFERENCES accounts(account_id) ON DELETE SET NULL,
    card_id             BIGINT NULL REFERENCES cards(card_id) ON DELETE SET NULL,
    merchant_id         BIGINT NULL REFERENCES merchants(merchant_id) ON DELETE SET NULL,
    category_id         INTEGER NOT NULL REFERENCES transaction_categories(category_id) ON DELETE RESTRICT,
    txn_type             txn_type_t NOT NULL,
    status                txn_status_t NOT NULL DEFAULT 'completed',
    amount                DECIMAL(18,2) NOT NULL,
    currency              CHAR(3) NOT NULL DEFAULT 'VND',
    description           VARCHAR(255),
    txn_timestamp          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_txn_account ON transactions(account_id);
CREATE INDEX idx_txn_related_account ON transactions(related_account_id);
CREATE INDEX idx_txn_card ON transactions(card_id);
CREATE INDEX idx_txn_merchant ON transactions(merchant_id);
CREATE INDEX idx_txn_category ON transactions(category_id);
CREATE INDEX idx_txn_timestamp ON transactions(txn_timestamp);

-- ---------------------------------------------------------------------
-- 8. loans — Khoản vay
-- ---------------------------------------------------------------------
CREATE TABLE loans (
    loan_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id       BIGINT NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    loan_type         VARCHAR(50),
    principal_amount  DECIMAL(18,2) NOT NULL,
    interest_rate     DECIMAL(5,2) NOT NULL,
    term_months       INTEGER NOT NULL,
    disbursed_date    DATE,
    status            loan_status_t NOT NULL DEFAULT 'active'
);
CREATE INDEX idx_loans_customer ON loans(customer_id);

-- ---------------------------------------------------------------------
-- 9. loan_payments — Lịch trả nợ
-- ---------------------------------------------------------------------
CREATE TABLE loan_payments (
    payment_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    loan_id               BIGINT NOT NULL REFERENCES loans(loan_id) ON DELETE CASCADE,
    installment_no        INTEGER NOT NULL,
    due_date              DATE NOT NULL,
    amount_due            DECIMAL(18,2) NOT NULL,
    principal_component   DECIMAL(18,2) NOT NULL,
    interest_component    DECIMAL(18,2) NOT NULL,
    paid_date             DATE NULL,
    amount_paid           DECIMAL(18,2) NULL,
    CONSTRAINT uq_loan_installment UNIQUE (loan_id, installment_no)
);
CREATE INDEX idx_loan_payments_loan ON loan_payments(loan_id);

-- ---------------------------------------------------------------------
-- 10. fraud_alerts — Cảnh báo gian lận
-- ---------------------------------------------------------------------
CREATE TABLE fraud_alerts (
    alert_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    transaction_id  BIGINT NOT NULL REFERENCES transactions(transaction_id) ON DELETE CASCADE,
    risk_score      SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
    alert_type      VARCHAR(50),
    status          fraud_alert_status_t NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fraud_transaction ON fraud_alerts(transaction_id);

-- ---------------------------------------------------------------------
-- 11. exchange_rates — Tỷ giá (độc lập, dùng cho as-of join)
-- ---------------------------------------------------------------------
CREATE TABLE exchange_rates (
    rate_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    currency_from   CHAR(3) NOT NULL,
    currency_to     CHAR(3) NOT NULL,
    rate            DECIMAL(18,6) NOT NULL,
    rate_date       DATE NOT NULL,
    CONSTRAINT uq_rate_pair_date UNIQUE (currency_from, currency_to, rate_date)
);
