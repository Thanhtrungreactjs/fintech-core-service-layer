-- =====================================================================
-- Module "Maker-Checker" (kiểm soát kép / dual authorisation) — bản Postgres.
-- Đây là đặc trưng nhận diện #1 của core banking system thật (T24 gọi là
-- AUTHORISE queue / NAU - Not Authorised): người NHẬP lệnh (maker) không
-- bao giờ được tự PHÊ DUYỆT (checker) lệnh của chính mình — nghiệp vụ tiền
-- chỉ thực sự có hiệu lực sau khi 1 người KHÁC xác nhận.
-- An toàn để chạy lại nhiều lần.
-- Chạy sau db/migrations/003_general_ledger.sql:
--   psql "$DATABASE_URL" -f db/migrations/004_maker_checker.sql
-- =====================================================================

DO $$ BEGIN
    CREATE TYPE app_user_role_t AS ENUM ('maker', 'checker', 'both', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE auth_queue_status_t AS ENUM ('pending', 'authorized', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------
-- app_users — người dùng vận hành (teller/supervisor), KHÔNG phải customers
-- (customers là khách hàng ngân hàng, app_users là nhân sự nội bộ thao tác
-- hệ thống). Không có mật khẩu/đăng nhập thật — demo dùng header X-User-Id
-- để giả lập danh tính người gọi API, tương tự khái niệm OPERATOR trong T24.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
    user_id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username         VARCHAR(50) NOT NULL,
    display_name      VARCHAR(150) NOT NULL,
    role               app_user_role_t NOT NULL DEFAULT 'maker',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_users_username UNIQUE (username)
);

-- ---------------------------------------------------------------------
-- auth_queue — hàng đợi chờ duyệt. Mỗi dòng là 1 yêu cầu nghiệp vụ đã được
-- maker nhập nhưng CHƯA có hiệu lực (tiền chưa di chuyển) cho tới khi 1
-- checker khác authorize. payload lưu nguyên request body để executor dùng
-- lại khi authorize; result lưu response sau khi thực thi thành công.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auth_queue (
    queue_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    operation_type      VARCHAR(50) NOT NULL CHECK (operation_type IN (
                           'CREATE_TRANSACTION', 'UPDATE_ACCOUNT_STATUS', 'OPEN_TERM_DEPOSIT',
                           'WITHDRAW_TERM_DEPOSIT_EARLY', 'MATURE_TERM_DEPOSIT'
                         )),
    payload               JSONB NOT NULL,
    status                 auth_queue_status_t NOT NULL DEFAULT 'pending',
    maker_id                INTEGER NOT NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
    checker_id               INTEGER NULL REFERENCES app_users(user_id) ON DELETE RESTRICT,
    input_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at                 TIMESTAMPTZ NULL,
    reject_reason                VARCHAR(255) NULL,
    result                         JSONB NULL,
    CONSTRAINT chk_auth_queue_no_self_check CHECK (checker_id IS NULL OR checker_id <> maker_id)
);
CREATE INDEX IF NOT EXISTS idx_auth_queue_status ON auth_queue(status);
CREATE INDEX IF NOT EXISTS idx_auth_queue_maker ON auth_queue(maker_id);

-- Người dùng demo: 2 maker (teller), 2 checker (supervisor), 1 admin gộp cả hai vai.
INSERT INTO app_users (username, display_name, role) VALUES
    ('teller1',     'Nguyễn Thị Teller 1',   'maker'),
    ('teller2',     'Trần Văn Teller 2',      'maker'),
    ('supervisor1', 'Lê Thị Supervisor 1',    'checker'),
    ('supervisor2', 'Phạm Văn Supervisor 2',  'checker'),
    ('admin1',      'Quản trị viên',           'both')
ON CONFLICT (username) DO NOTHING;
