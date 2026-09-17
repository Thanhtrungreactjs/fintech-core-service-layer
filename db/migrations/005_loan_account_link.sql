-- =====================================================================
-- Nối module Vay (loans) vào dòng tiền thật + Sổ cái — bản Postgres.
-- Trước migration này, loans/loan_payments hoàn toàn "lơ lửng": tạo khoản
-- vay không giải ngân vào đâu, trả góp không trừ tiền tài khoản nào, không
-- có bút toán GL — chỉ là dữ liệu lịch trả nợ, không phải nghiệp vụ ngân
-- hàng thật. Thêm account_id (tài khoản giải ngân + nhận trả góp) và liên
-- kết transaction_id cho từng kỳ trả để có đầy đủ dấu vết như mọi giao dịch
-- tiền khác trong hệ thống.
-- An toàn để chạy lại nhiều lần (ADD COLUMN IF NOT EXISTS).
-- Chạy sau db/migrations/004_maker_checker.sql:
--   psql "$DATABASE_URL" -f db/migrations/005_loan_account_link.sql
-- =====================================================================

ALTER TABLE loans ADD COLUMN IF NOT EXISTS account_id BIGINT NULL REFERENCES accounts(account_id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_loans_account ON loans(account_id);

ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS transaction_id BIGINT NULL REFERENCES transactions(transaction_id) ON DELETE SET NULL;
