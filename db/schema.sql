-- =====================================================================
-- Fintech Core DB Schema (mô phỏng phong cách core-banking như T24)
-- 11 bảng, đầy đủ PK/FK, index, constraint
-- Engine: MySQL 8+
-- =====================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. customers — Khách hàng (bảng gốc / Party)
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    customer_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL,
    phone           VARCHAR(20),
    dob             DATE,
    country         VARCHAR(50),
    kyc_status      ENUM('pending','verified','rejected') NOT NULL DEFAULT 'pending',
    referred_by     BIGINT UNSIGNED NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_customers_email (email),
    CONSTRAINT fk_customers_referrer
        FOREIGN KEY (referred_by) REFERENCES customers(customer_id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. account_types — Danh mục loại tài khoản
-- ---------------------------------------------------------------------
CREATE TABLE account_types (
    account_type_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    type_name       VARCHAR(50) NOT NULL,
    interest_rate   DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    UNIQUE KEY uq_account_types_name (type_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. accounts — Tài khoản (Arrangement)
-- ---------------------------------------------------------------------
CREATE TABLE accounts (
    account_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id     BIGINT UNSIGNED NOT NULL,
    account_type_id INT UNSIGNED NOT NULL,
    account_number  VARCHAR(30) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'VND',
    balance         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    status          ENUM('active','dormant','frozen','closed') NOT NULL DEFAULT 'active',
    opened_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at       TIMESTAMP NULL,
    UNIQUE KEY uq_accounts_number (account_number),
    KEY idx_accounts_customer (customer_id),
    KEY idx_accounts_type (account_type_id),
    CONSTRAINT fk_accounts_customer
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_accounts_type
        FOREIGN KEY (account_type_id) REFERENCES account_types(account_type_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. cards — Thẻ ngân hàng
-- ---------------------------------------------------------------------
CREATE TABLE cards (
    card_id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id          BIGINT UNSIGNED NOT NULL,
    card_number_masked  VARCHAR(25) NOT NULL,
    card_type           ENUM('debit','credit','prepaid') NOT NULL,
    status              ENUM('active','blocked','expired') NOT NULL DEFAULT 'active',
    expiry_date         DATE NOT NULL,
    issued_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_cards_account (account_id),
    CONSTRAINT fk_cards_account
        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. merchants — Điểm bán
-- ---------------------------------------------------------------------
CREATE TABLE merchants (
    merchant_id     BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    merchant_name   VARCHAR(150) NOT NULL,
    category        VARCHAR(50),
    country         VARCHAR(50)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. transaction_categories — Danh mục giao dịch
-- ---------------------------------------------------------------------
CREATE TABLE transaction_categories (
    category_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    category_name   VARCHAR(50) NOT NULL,
    category_group  ENUM('income','spending','transfer','fee') NOT NULL,
    UNIQUE KEY uq_categories_name (category_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. transactions — Bảng trung tâm
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
    transaction_id      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    account_id          BIGINT UNSIGNED NOT NULL,
    related_account_id  BIGINT UNSIGNED NULL,
    card_id             BIGINT UNSIGNED NULL,
    merchant_id         BIGINT UNSIGNED NULL,
    category_id         INT UNSIGNED NOT NULL,
    txn_type            ENUM('deposit','withdrawal','transfer','payment','fee','interest') NOT NULL,
    status               ENUM('pending','completed','failed','reversed') NOT NULL DEFAULT 'completed',
    amount               DECIMAL(18,2) NOT NULL,
    currency             CHAR(3) NOT NULL DEFAULT 'VND',
    description          VARCHAR(255),
    txn_timestamp        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_txn_account (account_id),
    KEY idx_txn_related_account (related_account_id),
    KEY idx_txn_card (card_id),
    KEY idx_txn_merchant (merchant_id),
    KEY idx_txn_category (category_id),
    KEY idx_txn_timestamp (txn_timestamp),
    CONSTRAINT fk_txn_account
        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_txn_related_account
        FOREIGN KEY (related_account_id) REFERENCES accounts(account_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_txn_card
        FOREIGN KEY (card_id) REFERENCES cards(card_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_txn_merchant
        FOREIGN KEY (merchant_id) REFERENCES merchants(merchant_id)
        ON DELETE SET NULL,
    CONSTRAINT fk_txn_category
        FOREIGN KEY (category_id) REFERENCES transaction_categories(category_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. loans — Khoản vay
-- ---------------------------------------------------------------------
CREATE TABLE loans (
    loan_id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id       BIGINT UNSIGNED NOT NULL,
    loan_type         VARCHAR(50),
    principal_amount  DECIMAL(18,2) NOT NULL,
    interest_rate     DECIMAL(5,2) NOT NULL,
    term_months       INT NOT NULL,
    disbursed_date    DATE,
    status            ENUM('active','closed','defaulted') NOT NULL DEFAULT 'active',
    KEY idx_loans_customer (customer_id),
    CONSTRAINT fk_loans_customer
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. loan_payments — Lịch trả nợ
-- ---------------------------------------------------------------------
CREATE TABLE loan_payments (
    payment_id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    loan_id               BIGINT UNSIGNED NOT NULL,
    installment_no        INT NOT NULL,
    due_date              DATE NOT NULL,
    amount_due            DECIMAL(18,2) NOT NULL,
    principal_component   DECIMAL(18,2) NOT NULL,
    interest_component    DECIMAL(18,2) NOT NULL,
    paid_date             DATE NULL,
    amount_paid           DECIMAL(18,2) NULL,
    KEY idx_loan_payments_loan (loan_id),
    UNIQUE KEY uq_loan_installment (loan_id, installment_no),
    CONSTRAINT fk_loan_payments_loan
        FOREIGN KEY (loan_id) REFERENCES loans(loan_id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 10. fraud_alerts — Cảnh báo gian lận
-- ---------------------------------------------------------------------
CREATE TABLE fraud_alerts (
    alert_id        BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transaction_id  BIGINT UNSIGNED NOT NULL,
    risk_score      TINYINT UNSIGNED NOT NULL,
    alert_type      VARCHAR(50),
    status          ENUM('open','reviewing','closed_fp','closed_confirmed') NOT NULL DEFAULT 'open',
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_fraud_transaction (transaction_id),
    CONSTRAINT fk_fraud_transaction
        FOREIGN KEY (transaction_id) REFERENCES transactions(transaction_id)
        ON DELETE CASCADE,
    CONSTRAINT chk_fraud_risk_score CHECK (risk_score BETWEEN 0 AND 100)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 11. exchange_rates — Tỷ giá (độc lập, dùng cho as-of join)
-- ---------------------------------------------------------------------
CREATE TABLE exchange_rates (
    rate_id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    currency_from   CHAR(3) NOT NULL,
    currency_to     CHAR(3) NOT NULL,
    rate            DECIMAL(18,6) NOT NULL,
    rate_date       DATE NOT NULL,
    UNIQUE KEY uq_rate_pair_date (currency_from, currency_to, rate_date)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
