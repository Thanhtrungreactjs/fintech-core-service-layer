-- =====================================================================
-- Đăng nhập thật cho app_users (Maker-Checker) — bản Postgres.
-- Trước migration này, danh tính maker/checker chỉ là user_id client tự
-- khai trong request body — AI CŨNG GIẢ MẠO ĐƯỢC, phá vỡ hoàn toàn ý nghĩa
-- kiểm soát kép. Thêm password_hash (bcrypt) để xác thực thật bằng JWT;
-- từ nay maker_id/checker_id trong auth_queue LUÔN lấy từ token đã xác
-- thực (middleware requireAuth), không còn nhận trực tiếp từ request body.
-- Mật khẩu demo cho cả 5 user: "Demo@123" (chỉ dùng cho môi trường demo).
-- An toàn để chạy lại nhiều lần.
-- Chạy sau db/migrations/006_close_of_business.sql:
--   psql "$DATABASE_URL" -f db/migrations/007_auth_login.sql
-- =====================================================================

ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(100);

UPDATE app_users
SET password_hash = '$2b$10$VJTF9c2wYDPRXIFBap68eepx.EJLxHnbw3070w84QT0NhPAajwjH.'
WHERE password_hash IS NULL;

ALTER TABLE app_users ALTER COLUMN password_hash SET NOT NULL;
