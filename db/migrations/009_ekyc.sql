-- =====================================================================
-- Module eKYC: xác minh danh tính bằng OCR (đọc giấy tờ) + đối chiếu
-- khuôn mặt (selfie vs ảnh trên giấy tờ), chạy thật bằng thư viện mã
-- nguồn mở (tesseract.js cho OCR ở backend, @vladmandic/face-api tự host
-- ở frontend cho face matching) — không dùng vendor eKYC thương mại nào.
-- Bảng này lưu LẠI TOÀN BỘ kết quả mỗi lần xác minh (kể cả lần fail) làm
-- bằng chứng đối soát — đúng thực tế compliance ngân hàng thật luôn phải
-- lưu vết hồ sơ xác minh, không chỉ lưu mỗi kết quả cuối (kyc_status).
-- An toàn để chạy lại nhiều lần.
-- =====================================================================
CREATE TABLE IF NOT EXISTS ekyc_verifications (
    verification_id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id           BIGINT NOT NULL REFERENCES customers(customer_id),
    extracted_full_name   VARCHAR(150),
    extracted_id_number   VARCHAR(30),
    extracted_dob         DATE,
    ocr_confidence        NUMERIC(5,2),
    name_match_score      NUMERIC(5,2),
    face_match_score      NUMERIC(5,2),
    decision              VARCHAR(20) NOT NULL,
    reason                VARCHAR(255),
    kyc_status_applied    BOOLEAN NOT NULL DEFAULT false,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ekyc_verifications_customer ON ekyc_verifications(customer_id);
