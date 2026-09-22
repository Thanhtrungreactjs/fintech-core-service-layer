-- =====================================================================
-- Bổ sung cột address cho customers — lưu địa chỉ liên hệ/thường trú của
-- khách hàng. Schema gốc chỉ có country (tên quốc gia), không đủ chi tiết
-- để tra cứu/gửi thư từ, đối chiếu hồ sơ KYC như ngân hàng thật cần.
-- An toàn để chạy lại nhiều lần.
-- =====================================================================
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address VARCHAR(255);
