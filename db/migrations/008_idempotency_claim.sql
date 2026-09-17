-- =====================================================================
-- Vá race condition trong middleware Idempotency-Key: implementation cũ
-- SELECT-rồi-INSERT-ở-cuối khiến 2 request đồng thời CÙNG 1 KEY đều đọc
-- "chưa tồn tại" và đều chạy trọn business logic -> tạo 2 bản ghi thật
-- (đã tái hiện được bằng test: 2 request cùng key tạo transaction #87 và
-- #88 thay vì chỉ 1). Cách vá: INSERT placeholder NGAY ĐẦU request để
-- "giữ chỗ" key một cách atomic (PRIMARY KEY hiện có tự chặn request thứ 2),
-- rồi UPDATE lại đúng response khi xử lý xong — thay vì INSERT-ở-cuối.
-- Cần status_code/response_body nullable để lưu placeholder trước khi có
-- kết quả thật.
-- =====================================================================
ALTER TABLE idempotency_keys ALTER COLUMN status_code DROP NOT NULL;
ALTER TABLE idempotency_keys ALTER COLUMN response_body DROP NOT NULL;
