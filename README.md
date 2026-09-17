# Fintech Core — Service Layer

Node.js + TypeScript, 3 tầng Controller → Service → Repository, dựng theo
`db/schema.postgres.sql` (bản Postgres của `schema.sql` gốc) và `../api-design.md`.
Kết nối trực tiếp Postgres (Supabase) qua `pg`, không dùng ORM.

## Chạy

```bash
npm install
npm run dev        # tsx watch, http://localhost:3000
```

`.env` đã trỏ tới project Supabase "T24" của bạn (`DATABASE_URL`). Nếu đổi
project/password, cập nhật lại biến này.

## Khởi tạo schema trên Supabase

```bash
node scripts/migrate.mjs   # chạy db/schema.postgres.sql + db/migrations/001_idempotency_keys.sql
node scripts/seed.mjs      # seed transaction_categories mẫu (Deposit/Withdrawal/Transfer)
```

An toàn để chạy lại nhiều lần (idempotent — `IF NOT EXISTS` / `ON CONFLICT`).

## Cấu trúc

```
db/schema.postgres.sql     11 bảng nghiệp vụ (dịch từ schema.sql MySQL gốc)
db/migrations/              bảng hạ tầng bổ sung (idempotency_keys)
src/repositories/           1 file / bảng — SQL thuần qua pg, named placeholder ":name"
src/services/                business rules (api-design.md mục 3): validate balance,
                             transition trạng thái, amortization, fraud rule, reversal
src/controllers/ + routes/  khớp từng endpoint trong api-design.md
src/middleware/              envelope lỗi, validate (zod), Idempotency-Key
```

## Module eKYC

`POST /customers/:id/ekyc/verify` (multipart: `id_image` + `face_match_score` tùy chọn) — xác
minh danh tính chạy thật bằng thư viện mã nguồn mở, không dùng vendor eKYC thương mại:
- OCR đọc giấy tờ: `tesseract.js`, chạy ở backend (`src/services/ekycService.ts`).
- Đối chiếu khuôn mặt: `face-api.js` (`@vladmandic/face-api`), tự host ở `public/vendor/face-api/`,
  chạy ngay tại trình duyệt — client tự tính `face_match_score` (0-100) rồi gửi kèm lên.

Kết quả (kể cả lần fail) được lưu vào `ekyc_verifications` làm bằng chứng đối soát; nếu quyết
định là `verified`/`rejected` và khách hàng đang `pending`, tự động gọi `customerService.updateKyc()`
để cập nhật `kyc_status` (tái dùng đúng rule 1 chiều đã có, không bypass).

**Giới hạn cố ý (khác eKYC ngân hàng thật)**: không chống giả mạo/liveness thật (chỉ so 1 ảnh
tĩnh), không đọc chip NFC, không tra cứu CSDL dân cư — thực tế T24 thật cũng không tự làm các
phần này, luôn gọi ra 1 nhà cung cấp eKYC chuyên biệt bên ngoài rồi nhận kết quả về.

## Điểm khác với schema.sql gốc (MySQL → Postgres)

- `AUTO_INCREMENT` → `GENERATED ALWAYS AS IDENTITY`
- `ENUM(...)` inline → `CREATE TYPE ... AS ENUM` riêng
- `ON UPDATE CURRENT_TIMESTAMP` (customers.updated_at) → trigger `set_updated_at()`
- `KEY idx_...` inline → `CREATE INDEX` riêng (Postgres không hỗ trợ index inline)
- Thêm bảng `idempotency_keys` (không có trong 11 bảng gốc) để lưu response
  cho `Idempotency-Key`, tránh double-post khi client retry
  `POST /transactions` hoặc `POST /loans/{id}/payments/{paymentId}/pay`.

## Business rules đã enforce ở service layer

Xem `../api-design.md` mục 3. Cài trong:

- `services/transactionService.ts` — account phải `active`, không cho âm số dư,
  `related_account_id` bắt buộc/cấm đúng theo `txn_type`, tự gọi fraud check
- `services/fraudAlertService.ts` — amount > `FRAUD_AMOUNT_THRESHOLD` (mặc định
  50,000,000 VND, cấu hình qua `.env`) → tự tạo `fraud_alerts`
- `services/loanService.ts` + `services/amortization.ts` — tạo loan tự sinh
  N kỳ `loan_payments` (amortization dư nợ giảm dần); trả hết kỳ cuối → loan `closed`
- `services/accountService.ts`, `cardService.ts`, `fraudAlertService.ts` —
  transition trạng thái hợp lệ (vd `closed` là terminal, không mở lại được)

## Lưu ý quan trọng

Project này đang nằm trong **thư mục scratch tạm** của phiên làm việc — sẽ bị
xoá khi session kết thúc. Nếu muốn giữ lại, hãy copy `service-layer/` sang một
thư mục dự án thật (vd `git init` + commit) trước khi đóng ứng dụng.
