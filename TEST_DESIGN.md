# Đặc tả Thiết kế Kiểm thử (Test Design Specification)
## Fintech Core Service Layer — Hệ thống lõi ngân hàng kiểu T24

| | |
|---|---|
| **Phiên bản** | 1.1 |
| **Ngày** | 2026-09-18 |
| **Tài liệu tham chiếu** | `SRS.md` / `SRS.pdf` (đặc tả yêu cầu — cùng thư mục dự án) |
| **Đối tượng sử dụng** | QA kiểm thử API/nghiệp vụ (thủ công hoặc tự động hoá qua script) |

> **Cập nhật 2026-09-18 (v1.1)**: bổ sung mục 7.15 **FR-CREDIT — Đánh giá điểm tín dụng** (tính năng mới, chưa có trong `SRS.md` gốc) và 3 test case địa chỉ khách hàng (`TC-CUST-015…017`, theo cột `address` mới thêm vào `customers`). Xem chi tiết thay đổi schema tại `db/migrations/010_customer_address.sql`.

---

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu đặc tả **thiết kế kiểm thử** (test design) cho toàn bộ 15 module chức năng của hệ thống (14 module theo `SRS.md` mục 4 + 1 module **FR-CREDIT** mới bổ sung, chưa có trong SRS gốc), gồm: chiến lược kiểm thử, môi trường/dữ liệu cần chuẩn bị, và danh sách **159 test case** cụ thể (mã lỗi, dữ liệu vào, kết quả mong đợi, **câu lệnh SQL kiểm chứng trực tiếp trong DB**) — đủ chi tiết để QA thực thi qua REST client (curl/Postman/script) **và** xác nhận độc lập ở tầng dữ liệu, không chỉ tin vào response API.

> **Lưu ý quan trọng về schema DB**: dự án Supabase này có 2 schema chứa bảng trùng tên (`public` và `t24`) — `t24` là dữ liệu có sẵn từ trước, **không liên quan** tới hệ thống trong tài liệu này. Toàn bộ câu lệnh SQL dưới đây đã ghi rõ tiền tố `public.` — chạy đúng theo đó để tránh nhầm sang schema `t24`.

Có 1 tài liệu phụ đi kèm: **`ANSWER_KEY.md`** (`ANSWER_KEY.pdf`) — cung cấp sẵn bộ dữ liệu đầu vào cụ thể + đáp án đã tính toán chính xác cho các test case có công thức (lãi suất, phân bổ gốc/lãi, quy đổi ngoại tệ, risk score...), để QA đối chiếu trực tiếp mà không cần tự tính tay.

### 1.2 Phạm vi kiểm thử

- **Trong phạm vi**: kiểm thử API (tầng Controller→Service→Repository→DB) cho toàn bộ 14 module theo `SRS.md` mục 4; kiểm thử các quy tắc nghiệp vụ khó (tính lãi, hạch toán GL, kiểm soát kép, phân loại nợ xấu); smoke test giao diện Web Console.
- **Ngoài phạm vi**: kiểm thử hiệu năng/tải (performance/load testing), kiểm thử bảo mật chuyên sâu (penetration testing), kiểm thử tự động hoá UI (không có framework FE để viết E2E UI test — Console chỉ là lớp mỏng gọi thẳng API nên kiểm thử API đã bao phủ phần lớn logic).

### 1.3 Mức độ ưu tiên (Priority)

| Mức | Ý nghĩa |
|---|---|
| **P1** | Bắt buộc chạy mỗi lần release — nghiệp vụ lõi hoặc rủi ro tiền/bảo mật cao |
| **P2** | Nên chạy mỗi lần release — quy tắc nghiệp vụ phụ, validation |
| **P3** | Chạy khi có thời gian / hồi quy định kỳ — case phụ, ít rủi ro |

---

## 2. Chiến lược & phương pháp kiểm thử

| Kỹ thuật | Áp dụng cho |
|---|---|
| **Equivalence Partitioning** | Phân vùng amount hợp lệ/không hợp lệ, currency khớp/lệch, role hợp lệ/không hợp lệ |
| **Boundary Value Analysis** | Ngưỡng `FRAUD_AMOUNT_THRESHOLD` (đúng ngưỡng vs vượt 1 đồng), ngưỡng nợ xấu 90 ngày (90 vs 91 ngày), rút trước hạn (0 ngày vs 1 ngày) |
| **State Transition Testing** | Máy trạng thái `accounts` (active/dormant/frozen/closed), `cards` (active/blocked/expired), `loans` (active/closed/defaulted), `fraud_alerts` (open/reviewing/closed_fp/closed_confirmed), `term_deposits` (active/matured/withdrawn/closed), `auth_queue` (pending/authorized/rejected), `customers.kyc_status` (pending/verified/rejected) |
| **Decision Table** | Quy tắc RBAC Maker-Checker (role × hành động × là/không là chính người nộp lệnh) |
| **Kịch bản end-to-end nhiều bước** | Mở sổ tiết kiệm → trả lãi tháng → đáo hạn tái tục; tạo khoản vay → trả góp → đóng khoản vay; maker nộp lệnh → checker duyệt → kiểm tra tiền đã di chuyển |
| **Kiểm tra bất biến hệ thống (invariant)** | `GET /gl/trial-balance` phải luôn `balanced: true` — chạy lại sau **mọi** kịch bản khác như 1 bước hồi quy bắt buộc |
| **Kiểm chứng song song ở tầng DB** | Mỗi test case đều có kèm câu lệnh SQL (`psql`/Supabase SQL Editor) đọc thẳng bảng liên quan — phát hiện được trường hợp API trả response "trông đúng" nhưng dữ liệu ghi sai (hoặc ghi trùng do lỗi idempotency) mà chỉ nhìn response không thấy được. **Quy tắc áp dụng cho cả test case âm (expect lỗi)**: nếu bước test gọi 1 endpoint có khả năng ghi dữ liệu (`POST`/`PATCH`/`PUT`/`DELETE`) và mong đợi bị từ chối (4xx), vẫn phải có câu SQL xác nhận **không có bản ghi nào bị tạo/sửa ngầm** trước khi validation chặn lại — không được chỉ tin vào mã lỗi trả về, vì lỗi ứng dụng có thể khiến ghi dữ liệu xảy ra *trước* bước validate, hoặc thiếu rollback khi transaction lỗi giữa chừng. Chỉ những test case gọi `GET` (không có đường ghi) mới thực sự "không cần" kiểm DB — mọi trường hợp `(không cần)` khác trong tài liệu này đều phải ghi rõ lý do, không để mặc định. |

---

## 3. Môi trường & dữ liệu kiểm thử

### 3.1 Chuẩn bị môi trường

1. Chạy đủ 7 migration theo thứ tự (`scripts/migrate.mjs` hoặc từng file `db/migrations/00X_*.sql`).
2. Khởi động server: `npm run dev` → `http://localhost:3000`.
3. Base URL API: `http://localhost:3000/api/v1`. Swagger UI (tham chiếu nhanh schema): `http://localhost:3000/docs`.

### 3.2 Dữ liệu có sẵn sau migration (không cần tạo lại)

| Bảng | Dữ liệu seed |
|---|---|
| `account_types` | `id=1, type_name='Savings', interest_rate=2.50` |
| `transaction_categories` | `Deposit(income)`, `Withdrawal(spending)`, `Transfer(transfer)`, `Interest(income)` |
| `gl_accounts` | 7 tài khoản kế toán (mục 3.3 `SRS.md`) |
| `app_users` | 5 user, mật khẩu **`Demo@123`** cho tất cả (bảng dưới) |

| username | role | Dùng để test |
|---|---|---|
| `teller1` | maker | Nộp lệnh (không được tự duyệt) |
| `teller2` | maker | Nộp lệnh (dùng khi cần 2 maker khác nhau) |
| `supervisor1` | checker | Duyệt/từ chối lệnh của teller1/teller2 |
| `supervisor2` | checker | Duyệt/từ chối (dùng khi cần 2 checker khác nhau) |
| `admin1` | both | Vừa nộp vừa duyệt (nhưng không tự duyệt lệnh của chính mình) |

### 3.3 Dữ liệu cần tự tạo trước khi chạy bộ test (test data setup)

Thực hiện theo thứ tự, ghi lại ID trả về để dùng xuyên suốt các test case:

1. Tạo ≥2 `customers` (vd "Khách hàng A", "Khách hàng B").
2. Mở ≥2 `accounts` currency `VND` cho khách hàng A (1 tài khoản dùng để test rút tiền/đóng tài khoản, 1 tài khoản "sạch" dùng làm tài khoản đích cho transfer/FX).
3. Mở 1 `accounts` currency `USD` (dùng cho FR-FX) và nộp tiền USD vào đó qua `POST /transactions` (`txn_type=deposit`, `currency=USD` khớp với tài khoản).
4. Tạo 1 `exchange_rates`: `currency_from=USD, currency_to=VND, rate=25000, rate_date=<hôm nay>`.
5. Ghi nhớ: mọi ngày tháng dùng trong test rút trước hạn/đáo hạn/COB nên dùng **ngày quá khứ tính động** (vd "hôm nay trừ N ngày") thay vì hard-code, để bộ test không hết hạn theo thời gian thực.

---

## 4. Tiêu chí Entry/Exit

**Entry (bắt đầu kiểm thử):** migration chạy xong không lỗi; `GET /` và `GET /docs` trả 200; dữ liệu mục 3.3 đã tạo xong.

**Exit (kết thúc/đạt release):**
- 100% test case P1 pass.
- ≥95% test case P2 pass (case fail còn lại phải có phiếu lỗi kèm mức độ nghiêm trọng).
- `GET /gl/trial-balance` trả `balanced: true` tại thời điểm kết thúc bộ test (bất biến kế toán không bị vi phạm bởi bất kỳ test nào).

---

## 5. Bảng tra cứu mã lỗi (Error Code Reference)

Tổng hợp **toàn bộ** mã lỗi nghiệp vụ trong hệ thống (trích trực tiếp từ `Errors.*` trong mã nguồn) — dùng để QA đối chiếu `error.code` trong response thay vì đoán.

| HTTP | Mã lỗi | Khi nào xảy ra |
|---|---|---|
| 400 | `IDEMPOTENCY_KEY_REQUIRED` | Thiếu header `Idempotency-Key` ở endpoint bắt buộc |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | Cùng key, khác nội dung request |
| 422 | `VALIDATION_ERROR` | Lỗi zod schema, hoặc `Errors.validation(...)` (vd sai currency, sai amount) |
| 404 | `ROUTE_NOT_FOUND` | Endpoint không tồn tại |
| 404 | `<RESOURCE>_NOT_FOUND` (vd `ACCOUNT_NOT_FOUND`, `CUSTOMER_NOT_FOUND`, `LOAN_NOT_FOUND`, `TERM_DEPOSIT_NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `CARD_NOT_FOUND`, `APP_USER_NOT_FOUND`, `AUTH_QUEUE_NOT_FOUND`, `GL_ACCOUNT_NOT_FOUND`, `COB_RUN_NOT_FOUND`, `MERCHANT_NOT_FOUND`, `EXCHANGE_RATE_NOT_FOUND`...) | Không tìm thấy bản ghi theo id |
| 401 | `UNAUTHORIZED` | Sai mật khẩu / thiếu-sai token JWT |
| 403 | `FORBIDDEN` | Đúng token nhưng sai vai trò (RBAC) |
| 409 | `CUSTOMER_EMAIL_TAKEN` | Trùng email khi tạo khách hàng |
| 400 | `KYC_INVALID_TRANSITION` | Chuyển KYC không hợp lệ (xem mục 6.2) |
| 400 | `ACCOUNT_STATUS_TRANSITION_INVALID` | Đổi trạng thái account trái máy trạng thái (vd từ `closed`) |
| 400 | `ACCOUNT_NOT_ACTIVE` | Thao tác tiền trên account không `active` |
| 400 | `INSUFFICIENT_BALANCE` | Không đủ số dư |
| 400 | `CARD_STATUS_TRANSITION_INVALID` | Đổi trạng thái thẻ trái máy trạng thái (từ `expired`) |
| 400 | `TRANSACTION_NOT_REVERSIBLE` | Đảo giao dịch không ở trạng thái `completed` |
| 400 | `LOAN_NOT_ACTIVE` | Trả góp trên loan không `active` |
| 400 | `LOAN_PAYMENT_ALREADY_PAID` | Trả góp kỳ đã thanh toán |
| 400 | `LOAN_ACCOUNT_MISSING` | Loan chưa gắn `account_id` |
| 400 | `FRAUD_ALERT_STATUS_TRANSITION_INVALID` | Đổi trạng thái cảnh báo trái máy trạng thái |
| 400 | `TERM_DEPOSIT_NOT_ACTIVE` | Thao tác trên sổ không `active` |
| 400 | `TERM_DEPOSIT_TOO_EARLY` | Rút trước hạn khi chưa đủ 1 ngày |
| 400 | `TERM_DEPOSIT_ALREADY_MATURE` | Rút trước hạn khi đã tới/qua hạn |
| 400 | `TERM_DEPOSIT_NOT_MATURE` | Xử lý đáo hạn khi chưa tới hạn |
| 400 | `TERM_DEPOSIT_NOT_MONTHLY_PAYOUT` | Trả lãi tháng cho sổ không dùng `payout_method=monthly` |
| 400 | `TERM_DEPOSIT_PAST_MATURITY` | Trả lãi tháng khi đã quá hạn đáo hạn |
| 400 | `TERM_DEPOSIT_NO_ACCRUAL` | Trả lãi tháng khi chưa phát sinh ngày mới |
| 400 | `AUTH_QUEUE_SELF_AUTHORIZATION` | Checker trùng Maker (tự duyệt/tự từ chối) |
| 400 | `AUTH_QUEUE_NOT_PENDING` | Duyệt/từ chối yêu cầu đã quyết định rồi |
| 400 | `CATEGORY_MISSING` | Danh mục giao dịch cần thiết chưa seed (lỗi cấu hình môi trường) |
| 400 | `GL_RULE_MISSING` | Thiếu `gl_posting_rules` cho 1 `txn_type` (lỗi cấu hình môi trường) |
| 500 | `INTERNAL_ERROR` | Lỗi hệ thống không xác định (vd vi phạm UNIQUE constraint không được bắt tường minh) |

---

## 6. Máy trạng thái tham chiếu (State Machines)

Dùng để thiết kế test theo kỹ thuật State Transition — mỗi bảng liệt kê **toàn bộ transition hợp lệ**; bất kỳ cặp (trạng thái hiện tại → trạng thái đích) nào KHÔNG có trong bảng đều phải bị hệ thống từ chối.

### 6.1 `accounts.status`
`active → {dormant, frozen, closed}` · `dormant → {active, frozen, closed}` · `frozen → {active, dormant, closed}` · `closed →` *(terminal, không transition)*

### 6.2 `customers.kyc_status`
`pending → {verified, rejected}` **duy nhất** — không cho phép bất kỳ transition nào khác kể cả `verified → rejected` hay đặt lại `→ pending`.

### 6.3 `cards.status`
`active → {blocked, expired}` · `blocked → {active, expired}` · `expired →` *(terminal)*

### 6.4 `fraud_alerts.status`
`open → {reviewing, closed_fp, closed_confirmed}` · `reviewing → {closed_fp, closed_confirmed}` · `closed_fp →` / `closed_confirmed →` *(terminal)*

### 6.5 `loans.status`
`active → closed` (trả hết kỳ cuối) · `active → defaulted` (qua COB, quá hạn > 90 ngày) · `closed`/`defaulted →` *(terminal, không có API đổi tay)*

### 6.6 `term_deposits.status`
`active → matured` (qua `/mature`) · `active → withdrawn` (qua `/withdraw-early`) · `matured`/`withdrawn →` *(terminal)*

### 6.7 `auth_queue.status`
`pending → authorized` (qua `/authorize`) · `pending → rejected` (qua `/reject`) · `authorized`/`rejected →` *(terminal)*

### 6.8 Tổng hợp: 2 kiểu mô hình trạng thái trong hệ thống

Nhìn lại 7 máy trạng thái trên, toàn hệ thống chỉ rơi vào đúng 2 kiểu mô hình. Tester nên dùng bảng này để quyết định kỹ thuật test phù hợp: nhóm A cần test cả 2 chiều đi/về giữa các trạng thái sống, nhóm B chỉ cần test đúng 1 lần chuyển tiến rồi xác nhận không thể lùi/lặp lại.

| Đối tượng | Nhóm | Các trạng thái "đang sống" có đi qua lại được không? | Trạng thái cuối (terminal, hết đường) |
|---|---|---|---|
| `accounts.status` | **A — Linh hoạt + 1 ngõ cụt** | Có — `active` / `dormant` / `frozen` chuyển qua lại tự do, không giới hạn số lần | `closed` |
| `cards.status` | **A — Linh hoạt + 1 ngõ cụt** | Có — `active` ↔ `blocked` chuyển qua lại tự do | `expired` |
| `customers.kyc_status` | **B — 1 chiều tuyệt đối** | Không — đúng 1 lần chuyển duy nhất từ `pending`, không có trạng thái "đang sống" nào khác để quay lại | `verified` hoặc `rejected` |
| `fraud_alerts.status` | **B — 1 chiều tuyệt đối** | Không — `open → reviewing` chỉ tiến, không có transition lùi về `open` | `closed_fp` hoặc `closed_confirmed` |
| `loans.status` | **B — 1 chiều tuyệt đối** | Không — chỉ 1 lần chuyển, hoàn toàn qua batch COB hoặc trả hết nợ, không có API đổi tay | `closed` hoặc `defaulted` |
| `term_deposits.status` | **B — 1 chiều tuyệt đối** | Không — chỉ 1 lần chuyển khi đáo hạn hoặc rút trước hạn | `matured` hoặc `withdrawn` |
| `auth_queue.status` | **B — 1 chiều tuyệt đối** | Không — chỉ 1 lần chuyển khi duyệt hoặc từ chối | `authorized` hoặc `rejected` |

**Ý nghĩa cho test design:**
- **Nhóm A** (`accounts`, `cards`): phải test đủ các cặp chuyển đổi qua lại giữa trạng thái sống (ví dụ `active→frozen→active→dormant→closed`), VÀ test rằng một khi đã `closed`/`expired` thì mọi transition tiếp theo đều bị từ chối (`*_STATUS_TRANSITION_INVALID`).
- **Nhóm B**: không cần test chiều "quay lại" vì bản thân model không có cạnh đó — chỉ cần test (a) transition tiến đúng 1 lần thành công, và (b) gọi lại lần 2 (dù cùng giá trị hay giá trị khác) đều bị chặn. Đây chính là nhóm dễ bị bỏ sót nhất khi viết test, vì tester quen tư duy "trạng thái nào cũng sửa lại được".

---

## 7. Danh sách Test Case theo module

Ký hiệu preconditions: `[Acc-VND-1]`, `[Acc-VND-2]`, `[Acc-USD]` = các account tạo ở mục 3.3; `[Cust-A]`, `[Cust-B]` = customer.

### 7.1 FR-REF — Danh mục dùng chung

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-REF-001 | Xem danh sách loại tài khoản | `GET /account-types` | 200, có `id=1 Savings 2.50` | `SELECT * FROM public.account_types ORDER BY account_type_id;` | P3 |
| TC-REF-002 | Tạo loại tài khoản mới | `POST /account-types {type_name:"VIP", interest_rate:5}` | 201 | `SELECT * FROM public.account_types WHERE type_name='VIP';` → đúng 1 dòng, `interest_rate=5.00` | P3 |
| TC-REF-003 | Tạo loại tài khoản trùng tên | Gọi lại TC-REF-002 với cùng `type_name` | Lỗi (vi phạm UNIQUE, không crash server) | `SELECT COUNT(*) FROM public.account_types WHERE type_name='VIP';` → vẫn `=1` (không tăng thành 2) | P3 |
| TC-REF-004 | Xem danh sách merchant | `GET /merchants` | 200, mảng (rỗng nếu chưa tạo) | `SELECT COUNT(*) FROM public.merchants;` | P3 |
| TC-REF-005 | Xem danh mục giao dịch | `GET /transaction-categories` | 200, có đủ `Deposit/Withdrawal/Transfer/Interest` | `SELECT category_name, category_group FROM public.transaction_categories ORDER BY category_id;` | P2 |

### 7.2 FR-CUST — Khách hàng

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-CUST-001 | Tạo khách hàng hợp lệ | `POST /customers` email chưa tồn tại | 201, `kyc_status='pending'` | `SELECT * FROM public.customers WHERE customer_id=:id;` | P1 |
| TC-CUST-002 | Tạo trùng email | Lặp lại TC-CUST-001 cùng email | 409 `CUSTOMER_EMAIL_TAKEN` | `SELECT COUNT(*) FROM public.customers WHERE email=:email;` → vẫn `=1` | P1 |
| TC-CUST-003 | `referred_by` không tồn tại | `referred_by: 999999` | 404 `CUSTOMER_NOT_FOUND` | `SELECT COUNT(*) FROM public.customers WHERE referred_by=999999;` → `=0` (không tạo được) | P2 |
| TC-CUST-004 | Tìm kiếm theo email | `GET /customers?email=...` | 200, đúng bản ghi | `SELECT customer_id FROM public.customers WHERE email=:email;` | P2 |
| TC-CUST-005 | Tìm kiếm theo kyc_status | `GET /customers?kyc_status=pending` | 200, đúng danh sách | `SELECT customer_id FROM public.customers WHERE kyc_status='pending';` | P2 |
| TC-CUST-006 | Xem chi tiết không tồn tại | `GET /customers/999999` | 404 | *(không cần — xác nhận qua response là đủ)* | P2 |
| TC-CUST-007 | Cập nhật thông tin | `PATCH /customers/:id {full_name}` | 200, đã đổi | `SELECT full_name, updated_at FROM public.customers WHERE customer_id=:id;` → `updated_at` mới hơn `created_at` (trigger `set_updated_at`) | P2 |
| TC-CUST-008 | KYC pending→verified | `PATCH /:id/kyc {kyc_status:verified}` | 200 | `SELECT kyc_status FROM public.customers WHERE customer_id=:id;` → `verified` | P1 |
| TC-CUST-009 | KYC verified→rejected (đã verified) | Lặp lại `PATCH .../kyc {rejected}` sau TC-CUST-008 | 400 `KYC_INVALID_TRANSITION` | `SELECT kyc_status FROM public.customers WHERE customer_id=:id;` → vẫn `verified`, **không** đổi thành `rejected` | P1 |
| TC-CUST-010 | KYC đặt lại về pending | `PATCH .../kyc {pending}` (bất kỳ trạng thái nào) | 400 `KYC_INVALID_TRANSITION` | `SELECT kyc_status FROM public.customers WHERE customer_id=:id;` → giữ nguyên giá trị trước đó | P2 |
| TC-CUST-011 | Xem danh sách referrals | `GET /:id/referrals` sau khi có khách hàng khác `referred_by=:id` | 200, đúng danh sách | `SELECT customer_id, full_name FROM public.customers WHERE referred_by=:id;` | P3 |
| TC-CUST-012 | Xem accounts của khách hàng | `GET /:id/accounts` | 200 | `SELECT account_id, balance FROM public.accounts WHERE customer_id=:id;` | P3 |
| TC-CUST-013 | Tạo khoản vay thiếu Idempotency-Key | `POST /:id/loans` không header | 400 `IDEMPOTENCY_KEY_REQUIRED` | `SELECT COUNT(*) FROM public.loans WHERE customer_id=:id;` → `=0` | P1 |
| TC-CUST-014 | Tạo khoản vay lặp lại đúng key | Gọi 2 lần cùng key+body | Lần 2 trả **cùng `loan_id`**, không tạo bản ghi/giải ngân mới | `SELECT COUNT(*) FROM public.loans WHERE customer_id=:id;` → `=1` (không phải 2); `SELECT balance FROM public.accounts WHERE account_id=:acc;` → chỉ +principal đúng 1 lần; `SELECT COUNT(*) FROM public.idempotency_keys WHERE idempotency_key=:key;` → `=1` | P1 |
| TC-CUST-015 | Tạo khách hàng kèm địa chỉ hợp lệ *(mới — cột `address`, `db/migrations/010_customer_address.sql`)* | `POST /customers {..., address:"123 Đường Láng, Đống Đa, Hà Nội"}` | 201, response có đúng `address` vừa nhập | `SELECT address FROM public.customers WHERE customer_id=:id;` → khớp chuỗi đã gửi | P2 |
| TC-CUST-016 | Địa chỉ vượt quá độ dài cho phép (boundary) | `address` = chuỗi 256 ký tự (giới hạn cột là `VARCHAR(255)`, Zod `max(255)`) | 422 `VALIDATION_ERROR`, không tạo được khách hàng | `SELECT COUNT(*) FROM public.customers WHERE email=:email;` → `=0` (chưa từng ghi) | P2 |
| TC-CUST-017 | Cập nhật địa chỉ khách hàng | `PATCH /customers/:id {address:"456 Trần Duy Hưng, Cầu Giấy, Hà Nội"}` | 200, `address` đã đổi | `SELECT address, updated_at FROM public.customers WHERE customer_id=:id;` → `address` mới, `updated_at` mới hơn trước | P3 |

### 7.3 FR-ACC — Tài khoản

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-ACC-001 | Mở tài khoản hợp lệ | `POST /accounts {customer_id, account_type_id:1, currency:VND}` | 201, `balance=0.00`, `account_number` dạng `VNxxxxxxxxxxxx` | `SELECT balance, currency, account_number, status FROM public.accounts WHERE account_id=:id;` → `balance=0.00, status='active'` | P1 |
| TC-ACC-002 | `account_type_id` không tồn tại | `account_type_id: 999` | 404 | `SELECT COUNT(*) FROM public.accounts WHERE customer_id=:cust AND account_type_id=999;` → `=0` | P2 |
| TC-ACC-003 | `customer_id` không tồn tại | `customer_id: 999999` | 404 | `SELECT COUNT(*) FROM public.accounts WHERE customer_id=999999;` → `=0` | P2 |
| TC-ACC-004 | Xem chi tiết | `GET /accounts/:id` | 200 | `SELECT * FROM public.accounts WHERE account_id=:id;` | P2 |
| TC-ACC-005 | active → frozen | `PATCH /:id/status {frozen}` | 200 | `SELECT status FROM public.accounts WHERE account_id=:id;` → `frozen` | P1 |
| TC-ACC-006 | frozen → active | `PATCH /:id/status {active}` | 200 (chuyển tự do, không phải chain 1 chiều) | `SELECT status FROM public.accounts WHERE account_id=:id;` → `active` | P1 |
| TC-ACC-007 | active → closed | `PATCH /:id/status {closed}` | 200, `closed_at` được set | `SELECT status, closed_at FROM public.accounts WHERE account_id=:id;` → `closed`, `closed_at IS NOT NULL` | P1 |
| TC-ACC-008 | closed → active (mở lại) | `PATCH /:id/status {active}` sau TC-ACC-007 | 400 `ACCOUNT_STATUS_TRANSITION_INVALID` | `SELECT status FROM public.accounts WHERE account_id=:id;` → vẫn `closed` | P1 |
| TC-ACC-009 | Lịch sử số dư | Thực hiện 3 giao dịch rồi `GET /:id/balance-history` | 200, `running_balance` khớp phép cộng dồn tay | `SELECT txn_type, amount, txn_timestamp FROM public.transactions WHERE account_id=:id OR related_account_id=:id ORDER BY txn_timestamp;` → cộng dồn tay đối chiếu `running_balance` | P2 |
| TC-ACC-010 | Danh sách giao dịch có lọc | `GET /:id/transactions?txn_type=deposit` | 200, chỉ trả đúng loại | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:id AND txn_type='deposit';` → khớp `meta.total` | P2 |
| TC-ACC-011 | Danh sách sổ tiết kiệm theo account | `GET /:id/term-deposits` | 200 | `SELECT term_deposit_id, status FROM public.term_deposits WHERE account_id=:id;` | P3 |

### 7.4 FR-CARD — Thẻ

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-CARD-001 | Phát hành thẻ cho account active | `POST /accounts/:id/cards {card_type:debit, expiry_date}` | 201 | `SELECT * FROM public.cards WHERE account_id=:id;` → có dòng mới, `status='active'` | P2 |
| TC-CARD-002 | Phát hành thẻ cho account frozen/closed | Đổi account sang `frozen` trước, rồi phát hành | 400 `ACCOUNT_NOT_ACTIVE` | `SELECT COUNT(*) FROM public.cards WHERE account_id=:id;` → không tăng | P2 |
| TC-CARD-003 | Xem chi tiết thẻ | `GET /cards/:id` | 200 | `SELECT * FROM public.cards WHERE card_id=:id;` | P3 |
| TC-CARD-004 | active→blocked→active→expired | 3 lần `PATCH /:id/status` liên tiếp | Mỗi bước 200 | `SELECT status FROM public.cards WHERE card_id=:id;` sau mỗi bước | P2 |
| TC-CARD-005 | expired → bất kỳ | `PATCH /:id/status {active}` sau khi đã `expired` | 400 `CARD_STATUS_TRANSITION_INVALID` | `SELECT status FROM public.cards WHERE card_id=:id;` → vẫn `expired` | P2 |

### 7.5 FR-TXN — Giao dịch *(module lõi, ưu tiên cao)*

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-TXN-001 | Deposit hợp lệ | `POST /transactions {account_id, txn_type:deposit, amount, category_id}` + Idempotency-Key | 201, balance +amount | `SELECT balance FROM public.accounts WHERE account_id=:id;` + `SELECT * FROM public.transactions WHERE transaction_id=:txn;` | P1 |
| TC-TXN-002 | Withdrawal đủ số dư | `txn_type:withdrawal`, amount ≤ balance | 201, balance -amount | `SELECT balance FROM public.accounts WHERE account_id=:id;` | P1 |
| TC-TXN-003 | Withdrawal không đủ số dư | amount > balance | 400 `INSUFFICIENT_BALANCE` | `SELECT balance FROM public.accounts WHERE account_id=:id;` → không đổi | P1 |
| TC-TXN-004 | Transfer hợp lệ cùng currency | `[Acc-VND-1]→[Acc-VND-2]`, `txn_type:transfer` | 201, cả 2 balance đổi đúng | `SELECT account_id, balance FROM public.accounts WHERE account_id IN (:a1,:a2);` | P1 |
| TC-TXN-005 | Transfer thiếu `related_account_id` | `txn_type:transfer` không kèm field | 422 `VALIDATION_ERROR` | *(bị chặn trước khi ghi DB — xác nhận qua response là đủ)* | P1 |
| TC-TXN-006 | `related_account_id` trùng `account_id` | Tự transfer cho chính mình | 422 | *(không ghi được — xác nhận qua response là đủ)* | P2 |
| TC-TXN-007 | Có `related_account_id` nhưng không phải transfer | `txn_type:deposit` kèm `related_account_id` | 422 | *(không ghi được — xác nhận qua response là đủ)* | P2 |
| TC-TXN-008 | Currency lệch tài khoản | `[Acc-VND-1]` nhưng `currency:USD` | 422 `VALIDATION_ERROR` (đã vá — không âm thầm sai số) | `SELECT balance FROM public.accounts WHERE account_id=:id;` → **không đổi** (bằng chứng không bị cộng/trừ sai) | P1 |
| TC-TXN-009 | Transfer khác currency qua endpoint thường | `[Acc-VND-1]→[Acc-USD]` | 422, gợi ý dùng `/fx-transfers` | `SELECT balance, currency FROM public.accounts WHERE account_id IN (:vnd,:usd);` → cả 2 không đổi | P1 |
| TC-TXN-010 | Giao dịch trên account không active | Đổi account sang `frozen`, thử deposit | 400 `ACCOUNT_NOT_ACTIVE` | `SELECT balance FROM public.accounts WHERE account_id=:id;` → không đổi | P1 |
| TC-TXN-011 | `category_id` không tồn tại | `category_id: 999` | 404 | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:id;` → **không tăng** (bằng chứng 404 không phải kiểu "báo lỗi cho có" trong khi vẫn âm thầm ghi DB) | P2 |
| TC-TXN-012 | `merchant_id` không tồn tại | `merchant_id: 999` | 404 | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:id;` → không tăng | P3 |
| TC-TXN-013 | `card_id` không thuộc account | Thẻ của account khác | 422 | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:id;` → không tăng | P3 |
| TC-TXN-014 | Thiếu Idempotency-Key | `POST /transactions` không header | 400 `IDEMPOTENCY_KEY_REQUIRED` | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:id;` → không tăng | P1 |
| TC-TXN-015 | Lặp lại đúng key+body | Gọi 2 lần | Lần 2 trả cache, balance **không** đổi thêm | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:id;` → chỉ **+1** dòng dù gọi 2 lần; `SELECT balance FROM public.accounts WHERE account_id=:id;` → chỉ +amount đúng 1 lần | P1 |
| TC-TXN-016 | Cùng key khác body | Đổi `amount` giữ nguyên key | 409 `IDEMPOTENCY_KEY_CONFLICT` | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:id;` → không có dòng mới cho lần gọi thứ 2 | P1 |
| TC-TXN-017 | Vượt ngưỡng gian lận | `amount > FRAUD_AMOUNT_THRESHOLD` | 201 + tự sinh `fraud_alerts` (kiểm `GET /fraud-alerts`) | `SELECT * FROM public.fraud_alerts WHERE transaction_id=:txn;` → có dòng, `alert_type='LARGE_AMOUNT'` | P1 |
| TC-TXN-018 | Đảo giao dịch hợp lệ | `POST /:id/reverse` trên giao dịch `completed` | 201, balance hoàn nguyên, GL 2 dòng đảo Nợ/Có | `SELECT status FROM public.transactions WHERE transaction_id=:id;` → `reversed`; `SELECT balance FROM public.accounts WHERE account_id=:acc;` → về đúng giá trị trước giao dịch gốc | P1 |
| TC-TXN-019 | Đảo giao dịch đã đảo rồi | Gọi `/reverse` lần 2 | 400 `TRANSACTION_NOT_REVERSIBLE` | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:acc AND description LIKE 'Reversal of transaction #%';` → vẫn `=1` cho giao dịch gốc `:id` (không đảo 2 lần) | P2 |
| TC-TXN-020 | Đảo giao dịch không tồn tại | `POST /999999/reverse` | 404 | `SELECT COUNT(*) FROM public.transactions WHERE description LIKE 'Reversal of transaction #999999%';` → `= 0` (không có bản ghi đảo nào được tạo cho 1 giao dịch gốc không tồn tại) | P3 |

### 7.6 FR-TD — Tiền gửi có kỳ hạn *(module khó nhất — nhiều case)*

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-TD-001 | Mở sổ hợp lệ (lãi đơn, trả cuối kỳ) | `POST /term-deposits {account_id, principal_amount, interest_rate, term_months}` + key | 201, account balance -principal | `SELECT * FROM public.term_deposits WHERE term_deposit_id=:td;` + `SELECT balance FROM public.accounts WHERE account_id=:acc;` | P1 |
| TC-TD-002 | Mở sổ thiếu Idempotency-Key | Không header | 400 | `SELECT COUNT(*) FROM public.term_deposits WHERE account_id=:acc;` → không tăng | P1 |
| TC-TD-003 | Mở sổ trên account không active | Account `frozen` | 400 `ACCOUNT_NOT_ACTIVE` | `SELECT COUNT(*) FROM public.term_deposits WHERE account_id=:acc;` → không tăng | P2 |
| TC-TD-004 | Mở sổ không đủ số dư | `principal_amount` > balance | 400 `INSUFFICIENT_BALANCE` | `SELECT balance FROM public.accounts WHERE account_id=:acc;` → không đổi | P1 |
| TC-TD-005 | Xem lãi dự thu (lãi đơn) | `GET /:id/accrued-interest` giữa kỳ | 200, `accrued_interest` = `P×r%×ngày/365` (đối chiếu tay) | `SELECT principal_amount, interest_rate, start_date, day_count_convention FROM public.term_deposits WHERE term_deposit_id=:id;` → dùng để tự tính lại và so khớp | P1 |
| TC-TD-006 | Xem lãi dự thu (lãi kép) | Sổ `interest_method=compound` | 200, giá trị nội suy tuyến tính theo tỉ lệ ngày | `SELECT interest_method, term_months FROM public.term_deposits WHERE term_deposit_id=:id;` | P2 |
| TC-TD-007 | Rút trước hạn khi chưa đủ 1 ngày | `start_date` = hôm nay, gọi `/withdraw-early` ngay | 400 `TERM_DEPOSIT_TOO_EARLY` | `SELECT status FROM public.term_deposits WHERE term_deposit_id=:id;` → vẫn `active` | P2 |
| TC-TD-008 | **Rút trước hạn hợp lệ (case khó #1)** | Sổ lãi suất cam kết cao (vd 7%), rút giữa kỳ | 201, lãi nhận **chỉ theo `early_withdrawal_rate`** (vd 0.20%), không phải 7% | `SELECT status, closed_date FROM public.term_deposits WHERE term_deposit_id=:id;` → `withdrawn`; `SELECT interest_amount FROM public.term_deposit_postings WHERE term_deposit_id=:id AND posting_type='early_withdrawal_settlement';` → khớp công thức lãi KHÔNG kỳ hạn, không phải 7% | P1 |
| TC-TD-009 | Rút trước hạn khi đã tới/qua hạn | `maturity_date` ≤ hôm nay | 400 `TERM_DEPOSIT_ALREADY_MATURE` | `SELECT status FROM public.term_deposits WHERE term_deposit_id=:id;` → vẫn `active` | P2 |
| TC-TD-010 | Rút trước hạn sổ không active | Sổ đã `matured`/`withdrawn` | 400 `TERM_DEPOSIT_NOT_ACTIVE` | `SELECT status FROM public.term_deposits WHERE term_deposit_id=:id;` → không đổi thêm | P2 |
| TC-TD-011 | Đáo hạn khi chưa tới hạn | `maturity_date` > hôm nay | 400 `TERM_DEPOSIT_NOT_MATURE` | `SELECT status FROM public.term_deposits WHERE term_deposit_id=:id;` → vẫn `active` | P2 |
| TC-TD-012 | Đáo hạn, `auto_renewal=false` | Sổ đã tới hạn | 201, account +gốc+lãi, GL tách Nợ 2100(gốc)+Nợ 5000(lãi)/Có 2000 | `SELECT status FROM public.term_deposits WHERE term_deposit_id=:id;` → `matured`; `SELECT gl_account_id, entry_side, amount FROM public.gl_entries WHERE transaction_id=(SELECT transaction_id FROM public.term_deposit_postings WHERE term_deposit_id=:id ORDER BY posting_id DESC LIMIT 1);` → 3 dòng đúng như mô tả | P1 |
| TC-TD-013 | **Đáo hạn, `auto_renewal=true` (case khó #2)** | Sổ đã tới hạn, `auto_renewal=true` | 201, tạo sổ mới `principal=gốc+lãi`, `renewed_from_id` đúng, **account balance không đổi** | `SELECT term_deposit_id, principal_amount, renewed_from_id FROM public.term_deposits WHERE renewed_from_id=:old_id;` → sổ mới đúng gốc; `SELECT balance FROM public.accounts WHERE account_id=:acc;` → **không đổi** so với trước khi đáo hạn | P1 |
| TC-TD-014 | Đáo hạn lãi kép | `interest_method=compound`, term=12 tháng | Lãi = `P×((1+r%/12)^12−1)` (đối chiếu tay) | `SELECT interest_amount FROM public.term_deposit_postings WHERE term_deposit_id=:id AND posting_type='maturity_settlement';` | P1 |
| TC-TD-015 | Trả lãi tháng lần đầu | Sổ `payout_method=monthly` | 201, account +lãi đúng số ngày kể từ `start_date` | `SELECT period_from, period_to, days, interest_amount FROM public.term_deposit_postings WHERE term_deposit_id=:id;` | P1 |
| TC-TD-016 | Trả lãi tháng 2 lần liên tiếp cùng ngày | Gọi `/interest-postings/monthly` 2 lần liền | Lần 2: 400 `TERM_DEPOSIT_NO_ACCRUAL` | `SELECT COUNT(*) FROM public.term_deposit_postings WHERE term_deposit_id=:id;` → chỉ tăng 1, không phải 2 | P2 |
| TC-TD-017 | Trả lãi tháng cho sổ `payout_method=maturity` | Gọi trên sổ sai loại | 400 `TERM_DEPOSIT_NOT_MONTHLY_PAYOUT` | `SELECT COUNT(*) FROM public.term_deposit_postings WHERE term_deposit_id=:id;` → `=0` | P2 |
| TC-TD-018 | Trả lãi tháng khi đã quá hạn | `maturity_date` < hôm nay | 400 `TERM_DEPOSIT_PAST_MATURITY` | `SELECT COUNT(*) FROM public.term_deposit_postings WHERE term_deposit_id=:id AND posting_type='monthly_payout';` → không tăng | P2 |
| TC-TD-019 | Xem lịch sử ghi nhận lãi | `GET /:id/postings` sau vài thao tác | 200, mỗi dòng có `transaction_id` thật, tra được qua `/gl/transactions/:id/entries` | `SELECT posting_id, transaction_id FROM public.term_deposit_postings WHERE term_deposit_id=:id;` → mọi `transaction_id` đều `IN (SELECT transaction_id FROM public.transactions)` | P2 |
| TC-TD-020 | Danh sách sổ theo account | `GET /accounts/:id/term-deposits` | 200 | `SELECT term_deposit_id FROM public.term_deposits WHERE account_id=:id;` | P3 |
| TC-TD-021 | Mở sổ thiếu trường bắt buộc | Thiếu `interest_rate` | 422 | *(bị chặn trước khi ghi DB — xác nhận qua response là đủ)* | P2 |

### 7.7 FR-LOAN — Cho vay

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-LOAN-001 | Tạo khoản vay hợp lệ | `POST /customers/:id/loans` + key | 201, N kỳ trả góp, `Σ principal_component = principal_amount`, account +principal | `SELECT SUM(principal_component) FROM public.loan_payments WHERE loan_id=:id;` → bằng `principal_amount`; `SELECT balance FROM public.accounts WHERE account_id=:acc;` | P1 |
| TC-LOAN-002 | `account_id` không thuộc customer | Account của khách hàng khác | 422 | *(bị chặn trước khi ghi — xác nhận qua response là đủ)* | P2 |
| TC-LOAN-003 | Account không active | Account `frozen` | 400 `ACCOUNT_NOT_ACTIVE` | `SELECT COUNT(*) FROM public.loans WHERE account_id=:acc;` → không tăng | P2 |
| TC-LOAN-004 | Thiếu Idempotency-Key | Không header | 400 | `SELECT COUNT(*) FROM public.loans WHERE customer_id=:cust;` → không tăng | P1 |
| TC-LOAN-005 | Lặp lại đúng key | Gọi 2 lần | Cùng `loan_id`, không giải ngân 2 lần (đối chiếu balance) | `SELECT COUNT(*) FROM public.loans WHERE customer_id=:cust;` → `+1` dù gọi 2 lần | P1 |
| TC-LOAN-006 | Trả góp đúng `amount_due` | `POST /:id/payments/:pid/pay` + key | 200, GL tách đúng gốc/lãi theo lịch | `SELECT paid_date, amount_paid, transaction_id FROM public.loan_payments WHERE payment_id=:pid;` + `SELECT gl_account_id, entry_side, amount FROM public.gl_entries WHERE transaction_id=(SELECT transaction_id FROM public.loan_payments WHERE payment_id=:pid);` | P1 |
| TC-LOAN-007 | Trả góp không đủ số dư | Account balance < `amount_paid` | 400 `INSUFFICIENT_BALANCE` | `SELECT paid_date FROM public.loan_payments WHERE payment_id=:pid;` → vẫn `NULL` | P1 |
| TC-LOAN-008 | Trả góp kỳ đã trả | Gọi lại cùng `payment_id` khác key | 400 `LOAN_PAYMENT_ALREADY_PAID` | `SELECT amount_paid FROM public.loan_payments WHERE payment_id=:pid;` → không đổi so với lần trả đầu | P2 |
| TC-LOAN-009 | Trả hết kỳ cuối | Trả đủ N/N kỳ | `loans.status` → `closed` | `SELECT status FROM public.loans WHERE loan_id=:id;` → `closed`; `SELECT COUNT(*) FROM public.loan_payments WHERE loan_id=:id AND paid_date IS NULL;` → `=0` | P1 |
| TC-LOAN-010 | Trả góp trên loan không active | Loan đã `closed`/`defaulted` | 400 `LOAN_NOT_ACTIVE` | `SELECT status FROM public.loans WHERE loan_id=:id;` → không đổi | P2 |
| TC-LOAN-011 | Trả góp thiếu Idempotency-Key | Không header | 400 | `SELECT paid_date FROM public.loan_payments WHERE payment_id=:pid;` → vẫn `NULL` | P2 |
| TC-LOAN-012 | `payment_id` không thuộc `loan_id` | Trộn ID sai | 404 `LOAN_PAYMENT_NOT_FOUND` | `SELECT amount_paid, paid_date, transaction_id FROM public.loan_payments WHERE payment_id=:paymentId;` → vẫn `amount_paid`/`paid_date`/`transaction_id` như trước (không bị áp nhầm khoản thanh toán từ 1 loan khác vào kỳ trả nợ này — bảng `loan_payments` không có cột `status` riêng, trạng thái "đã trả" được suy ra từ `paid_date IS NOT NULL`) | P3 |

### 7.8 FR-FRAUD — Cảnh báo gian lận

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-FRAUD-001 | Giao dịch vượt ngưỡng | `amount = threshold + 1` | Tự tạo `fraud_alerts`, `risk_score = round((amount/threshold)×50)` | `SELECT risk_score, alert_type FROM public.fraud_alerts WHERE transaction_id=:txn;` | P1 |
| TC-FRAUD-002 | Giao dịch **đúng** ngưỡng (boundary) | `amount = threshold` (không hơn) | **Không** tạo alert (điều kiện là `>`, không phải `≥`) | `SELECT COUNT(*) FROM public.fraud_alerts WHERE transaction_id=:txn;` → `=0` | P1 |
| TC-FRAUD-003 | Giao dịch rất lớn | `amount = threshold × 5` | `risk_score` bị chặn ở tối đa 100 | `SELECT risk_score FROM public.fraud_alerts WHERE transaction_id=:txn;` → `=100` | P2 |
| TC-FRAUD-004 | Tạo cảnh báo thủ công | `POST /fraud-alerts` | 201 | `SELECT * FROM public.fraud_alerts WHERE alert_id=:id;` | P2 |
| TC-FRAUD-005 | `open → reviewing` | `PATCH /:id/status {reviewing}` | 200 | `SELECT status FROM public.fraud_alerts WHERE alert_id=:id;` → `reviewing` | P2 |
| TC-FRAUD-006 | `open → closed_fp` (bỏ qua reviewing) | `PATCH /:id/status {closed_fp}` | 200 (transition thẳng hợp lệ) | `SELECT status FROM public.fraud_alerts WHERE alert_id=:id;` → `closed_fp` | P2 |
| TC-FRAUD-007 | `reviewing → open` (lùi) | `PATCH /:id/status {open}` | 400 `FRAUD_ALERT_STATUS_TRANSITION_INVALID` | `SELECT status FROM public.fraud_alerts WHERE alert_id=:id;` → vẫn `reviewing` | P2 |
| TC-FRAUD-008 | `closed_fp → bất kỳ` | Sau khi đã `closed_fp` | 400 (terminal) | `SELECT status FROM public.fraud_alerts WHERE alert_id=:id;` → vẫn `closed_fp` | P2 |

### 7.9 FR-FX — Tỷ giá & Quy đổi ngoại tệ

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-FX-001 | Tra cứu tỷ giá as-of đúng ngày | `GET /exchange-rates?from=USD&to=VND&date=<ngày seed>` | 200 | `SELECT * FROM public.exchange_rates WHERE currency_from='USD' AND currency_to='VND' ORDER BY rate_date DESC;` | P2 |
| TC-FX-002 | Tra cứu as-of ngày sau (không có bản ghi mới hơn) | `date` = hôm sau ngày seed | 200, trả bản ghi gần nhất trước đó | `SELECT rate_date FROM public.exchange_rates WHERE currency_from='USD' AND currency_to='VND' AND rate_date <= :date ORDER BY rate_date DESC LIMIT 1;` | P2 |
| TC-FX-003 | Tra cứu tỷ giá không tồn tại | Cặp tiền tệ chưa từng seed | 404 `EXCHANGE_RATE_NOT_FOUND` | `SELECT COUNT(*) FROM public.exchange_rates WHERE currency_from=:cf AND currency_to=:ct;` → `=0` | P2 |
| TC-FX-004 | Tạo tỷ giá trùng ngày/cặp | Tạo lại đúng `(from,to,date)` với `rate` khác | 201, `rate` được ghi đè (UPSERT) | `SELECT rate FROM public.exchange_rates WHERE currency_from=:cf AND currency_to=:ct AND rate_date=:d;` → giá trị mới nhất, chỉ **1 dòng** duy nhất (không trùng lặp) | P3 |
| TC-FX-005 | Quy đổi USD→VND hợp lệ (khớp tỷ giá đã seed ở mục 3.3) | `POST /fx-transfers {from:Acc-USD, to:Acc-VND, from_amount}` + key | 201, `to_amount = from_amount × rate` (đối chiếu tay, vd 200 USD × 25000 = 5.000.000 VND) | `SELECT balance, currency FROM public.accounts WHERE account_id IN (:usd,:vnd);` + `SELECT gl_account_id, entry_side, amount FROM public.gl_entries WHERE transaction_id=(SELECT transaction_id FROM public.transactions WHERE account_id=:vnd ORDER BY transaction_id DESC LIMIT 1);` → 1 cặp Nợ/Có cùng mã 2000 | P1 |
| TC-FX-006 | Quy đổi VND→USD hợp lệ (chiều ngược) | **Cần seed thêm** `exchange_rates {currency_from:VND, currency_to:USD, rate:0.00004, rate_date}` (tra cứu theo đúng chiều `from_account.currency → to_account.currency`, không tự đảo ngược tỷ giá đã seed chiều kia), sau đó `POST /fx-transfers {from:Acc-VND, to:Acc-USD, from_amount}` | 201, `to_amount = from_amount × rate` | `SELECT balance, currency FROM public.accounts WHERE account_id IN (:vnd,:usd);` | P1 |
| TC-FX-007 | Quy đổi 2 account cùng currency | `[Acc-VND-1]→[Acc-VND-2]` | 422, gợi ý dùng transfer thường | `SELECT balance FROM public.accounts WHERE account_id IN (:a1,:a2);` → cả 2 không đổi | P1 |
| TC-FX-008 | Quy đổi cặp không có chân VND | Mở thêm 1 account `currency:EUR`, thử `POST /fx-transfers {from:Acc-USD, to:Acc-EUR, from_amount}` | 422, không hỗ trợ quy đổi ngoại tệ ↔ ngoại tệ trực tiếp | `SELECT balance FROM public.accounts WHERE account_id IN (:usd,:eur);` → cả 2 không đổi | P1 |
| TC-FX-009 | Tài khoản nguồn không đủ số dư | `from_amount` > balance | 400 `INSUFFICIENT_BALANCE` | `SELECT balance FROM public.accounts WHERE account_id=:from;` → không đổi | P2 |
| TC-FX-010 | Thiếu Idempotency-Key | Không header | 400 | `SELECT COUNT(*) FROM public.transactions WHERE account_id=:from OR account_id=:to;` → không tăng | P2 |
| TC-FX-011 | Quy đổi khi chưa seed tỷ giá | Ngày quy đổi không có `exchange_rates` phù hợp | 404 `EXCHANGE_RATE_NOT_FOUND` | `SELECT balance FROM public.accounts WHERE account_id=:from;` → không đổi | P2 |

### 7.10 FR-GL — Sổ cái kế toán kép

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-GL-001 | Xem Chart of Accounts | `GET /gl/accounts` | 200, đủ 7 tài khoản đúng mục 3.3 SRS | `SELECT code, name, account_class, normal_balance FROM public.gl_accounts ORDER BY code;` | P2 |
| TC-GL-002 | **Bảng cân đối thử sau mọi thao tác** | `GET /gl/trial-balance` sau khi chạy bất kỳ nhóm test nào ở trên | `balanced: true`, `total_debit == total_credit` | `SELECT entry_side, SUM(amount) FROM public.gl_entries GROUP BY entry_side;` → 2 tổng phải bằng nhau tuyệt đối | **P1 — chạy lại liên tục xuyên suốt bộ test** |
| TC-GL-003 | Sổ cái theo tài khoản kế toán | `GET /gl/accounts/2000/entries` | 200, danh sách bút toán | `SELECT * FROM public.gl_entries e JOIN public.gl_accounts a ON a.gl_account_id=e.gl_account_id WHERE a.code='2000';` | P2 |
| TC-GL-004 | Sổ cái theo mã không tồn tại | `GET /gl/accounts/9999/entries` | 404 | *(không cần — đây là `GET`, không có đường ghi dữ liệu nào để kiểm tra)* | P3 |
| TC-GL-005 | Bút toán theo transaction | `GET /gl/transactions/:id/entries` sau TC-TXN-001 | 200, đúng 2 dòng Nợ=Có=amount | `SELECT entry_side, amount FROM public.gl_entries WHERE transaction_id=:id;` → 2 dòng, `amount` bằng nhau | P1 |
| TC-GL-006 | Bút toán đảo giao dịch | Sau TC-TXN-018 (reverse) | 2 dòng mới có `entry_side` đảo ngược so với 2 dòng gốc | `SELECT gl_account_id, entry_side FROM public.gl_entries WHERE transaction_id=:reversal_txn;` so với `...WHERE transaction_id=:original_txn;` → cùng `gl_account_id`, `entry_side` ngược nhau | P1 |
| TC-GL-007 | Bút toán tách gốc/lãi (loan payment) | Sau TC-LOAN-006 | 3 dòng: Nợ 2000 (tổng) / Có 1100 (gốc) + Có 4000 (lãi) | `SELECT a.code, e.entry_side, e.amount FROM public.gl_entries e JOIN public.gl_accounts a ON a.gl_account_id=e.gl_account_id WHERE e.transaction_id=:txn;` → đúng 3 dòng như mô tả | P1 |

### 7.11 FR-AUTH — Đăng nhập, RBAC & Kiểm soát kép *(bảo mật — ưu tiên rất cao)*

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-AUTH-001 | Đăng nhập đúng | `POST /auth/login {teller1, Demo@123}` | 200, có `token`, `user` KHÔNG chứa `password_hash` | `SELECT username, role FROM public.app_users WHERE username='teller1';` | P1 |
| TC-AUTH-002 | Đăng nhập sai mật khẩu | `password: sai` | 401 `UNAUTHORIZED` | *(không cần — không ghi gì)* | P1 |
| TC-AUTH-003 | Đăng nhập username không tồn tại | `username: khongtontai` | 401 (thông báo giống hệt TC-AUTH-002, không lộ user có tồn tại hay không) | `SELECT COUNT(*) FROM public.app_users WHERE username='khongtontai';` → `=0` (xác nhận đúng là user không tồn tại) | P1 |
| TC-AUTH-004 | `/auth/me` không có token | `GET /auth/me` không header | 401 | *(không cần — đây là `GET`, không có đường ghi dữ liệu nào để kiểm tra)* | P1 |
| TC-AUTH-005 | `/auth/me` token hỏng/hết hạn | Token giả hoặc sửa 1 ký tự | 401 | *(không cần — đây là `GET`, không có đường ghi dữ liệu nào để kiểm tra)* | P2 |
| TC-AUTH-006 | Enqueue không có token | `POST /auth-queue` không `Authorization` | 401 | `SELECT COUNT(*) FROM public.auth_queue WHERE input_at > now() - interval '1 minute';` → không có dòng mới | P1 |
| TC-AUTH-007 | Enqueue bằng role `checker` | Login `supervisor1`, gọi enqueue | 403 `FORBIDDEN` | `SELECT COUNT(*) FROM public.auth_queue WHERE maker_id=(SELECT user_id FROM public.app_users WHERE username='supervisor1');` → `=0` | P1 |
| TC-AUTH-008 | Enqueue payload sai schema | `operation_type=CREATE_TRANSACTION`, payload thiếu `account_id` | 422 ngay lúc nộp (không đợi tới lúc duyệt) | `SELECT COUNT(*) FROM public.auth_queue WHERE queue_id=:id;` → `=0` (chưa từng được tạo) | P1 |
| TC-AUTH-009 | **Tự duyệt lệnh của chính mình** | Login `teller1`, enqueue rồi cũng `teller1` authorize | 400 `AUTH_QUEUE_SELF_AUTHORIZATION` | `SELECT status, checker_id FROM public.auth_queue WHERE queue_id=:id;` → vẫn `pending`, `checker_id IS NULL` | P1 |
| TC-AUTH-010 | **Duyệt bởi role sai (không phải người nộp)** | `teller1` enqueue, `teller2` (role maker, không phải checker) authorize | 403 `FORBIDDEN` (khác lỗi TC-AUTH-009 dù cùng "không phải checker") | `SELECT status FROM public.auth_queue WHERE queue_id=:id;` → vẫn `pending` | P1 |
| TC-AUTH-011 | Duyệt hợp lệ | `teller1` enqueue, `supervisor1` authorize | 200, `status=authorized`, `result` có dữ liệu, tiền đã di chuyển thật | `SELECT status, checker_id, result FROM public.auth_queue WHERE queue_id=:id;` → `authorized`, `result` khớp `transaction_id` thật đã tạo | P1 |
| TC-AUTH-012 | Duyệt lại lần 2 | Gọi `/authorize` lần nữa trên queue đã `authorized` | 400 `AUTH_QUEUE_NOT_PENDING` | `SELECT decided_at FROM public.auth_queue WHERE queue_id=:id;` → không đổi so với lần duyệt đầu | P1 |
| TC-AUTH-013 | Từ chối hợp lệ | `supervisor1` reject kèm `reason` | 200, `status=rejected`, tiền **không** di chuyển | `SELECT status, reject_reason FROM public.auth_queue WHERE queue_id=:id;` → `rejected`, có `reject_reason` | P1 |
| TC-AUTH-014 | Từ chối thiếu `reason` | Body không có `reason` | 422 | `SELECT status FROM public.auth_queue WHERE queue_id=:id;` → vẫn `pending` | P2 |
| TC-AUTH-015 | Từ chối bởi chính maker | `teller1` tự reject lệnh của mình | 400 `AUTH_QUEUE_SELF_AUTHORIZATION` | `SELECT status FROM public.auth_queue WHERE queue_id=:id;` → vẫn `pending` | P2 |
| TC-AUTH-016 | **Executor lỗi sau khi claim** | Enqueue payload hợp lệ về schema nhưng sẽ fail ở service (vd `INSUFFICIENT_BALANCE`), rồi authorize | Queue tự hoàn tác về `pending` (không kẹt ở `authorized` sai sự thật), lỗi service được trả về cho checker | `SELECT status, checker_id FROM public.auth_queue WHERE queue_id=:id;` → **`pending`, `checker_id IS NULL`** (đã hoàn tác, không kẹt ở `authorized`) | P1 |
| TC-AUTH-017 | Lọc hàng đợi theo trạng thái | `GET /auth-queue?status=pending` | 200, chỉ trả đúng trạng thái | `SELECT COUNT(*) FROM public.auth_queue WHERE status='pending';` → khớp `meta.total` | P2 |
| TC-AUTH-018 | Danh sách user không lộ mật khẩu | `GET /users` | 200, không có trường `password_hash` trong bất kỳ bản ghi nào | `SELECT COUNT(*) FROM public.app_users;` → đối chiếu số lượng bản ghi (5), không đối chiếu `password_hash` (API không trả trường này) | P1 |

### 7.12 FR-COB — Batch cuối ngày (test job / scheduled job)

**"Test job" trong hệ thống này nghĩa là gì?** Toàn hệ thống chỉ có đúng 1 job chạy nền theo
lịch: **COB (Close of Business)** — bản mô phỏng batch cuối ngày mà lõi ngân hàng thật (T24,
Flexcube...) luôn chạy tự động mỗi đêm sau giờ giao dịch. Mục này giải thích job chạy như thế
nào và cách kiểm thử nó, để trả lời được câu hỏi phỏng vấn kiểu "mô tả cách bạn test 1 batch
job/scheduled job".

**Job này làm gì (`src/services/cobService.ts`, hàm `run(asOfDate?)`)** — chạy tuần tự 3 bước,
mỗi bước tự truy vấn "cái gì ĐANG đến hạn tính đến ngày `asOf`" rồi xử lý hàng loạt bằng đúng
service nghiệp vụ đã có (không viết lại business rule riêng cho batch):
1. Sổ tiết kiệm có `maturity_date <= asOf` và còn `active` → tự gọi `termDepositService.mature()`.
2. Khoản vay có kỳ trả nợ quá hạn `> 90 ngày` → chuyển `loans.status = 'defaulted'` (chuẩn Basel).
3. Thẻ đang `active`/`blocked` có `expiry_date <= asOf` → chuyển `cards.status = 'expired'`.

**2 đường trigger, dùng chung đúng 1 hàm** (đây là điểm quan trọng nhất khi test — sửa/test 1
lần là chắc chắn cả 2 đường đều đúng, không lệch nhau):
- **Tự động**: `node-cron` chạy theo lịch cấu hình ở biến môi trường `COB_CRON_SCHEDULE` (mặc
  định `0 0 * * *` — 0h mỗi ngày), khai báo ở `src/jobs/cobScheduler.ts`.
- **Thủ công**: `POST /cob/run` (body tùy chọn `{ as_of_date }`) — dùng để QA/demo trigger ngay
  lập tức, không phải đợi tới nửa đêm.

**4 đặc tính bắt buộc phải kiểm tra khi test bất kỳ batch/scheduled job nào** (áp dụng cụ thể
vào COB):

| Đặc tính cần test | COB làm đúng như thế nào | Cách verify |
|---|---|---|
| **Idempotent** — chạy lại nhiều lần không xử lý trùng | Mỗi bước tự query "đang active/chưa xử lý VÀ đã đến hạn" tại thời điểm chạy — không dựa vào cờ "đã chạy hôm nay chưa", nên bản ghi đã xử lý xong sẽ tự động không xuất hiện lại ở lần chạy sau | TC-COB-009: chạy `/cob/run` 2 lần liên tiếp, lần 2 phải ra số liệu rỗng cho phần đã xử lý ở lần 1 |
| **Resilient theo từng bản ghi** — 1 lỗi không sập cả batch | Vòng lặp đáo hạn sổ tiết kiệm có `try/catch` riêng từng sổ (`cobService.ts:50-62`); lỗi bị gom vào `matured_errors`, các sổ khác vẫn xử lý tiếp | TC-COB-006: xem `details.matured_errors` trong 1 lần chạy có lỗi cục bộ |
| **Audit trail đầy đủ** — biết chính xác job đã làm gì, khi nào | Mỗi lần chạy ghi 1 dòng vào `cob_runs` (ngày chạy, số liệu tổng hợp, `status`, `details` JSON liệt kê từng ID đã xử lý) | TC-COB-005, TC-COB-006 |
| **Test được không cần chờ thời gian thực trôi qua** | Tham số `as_of_date` cho phép "giả lập" job chạy vào 1 ngày trong tương lai — kỹ thuật bắt buộc phải có khi test bất kỳ job nào phụ thuộc ngày tháng, nếu không QA phải chờ thật sự tới ngày đó mới test được | Toàn bộ TC-COB-002 → 004, 008 đều dùng kỹ thuật này thay vì chờ ngày thật |

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-COB-001 | Chạy COB không có gì đến hạn | `POST /cob/run` khi không có sổ/vay/thẻ đến hạn | 201, `term_deposits_matured=0`, `loans_marked_defaulted=0`, `status=completed` | `SELECT * FROM public.cob_runs WHERE cob_run_id=:id;` | P2 |
| TC-COB-002 | Tự động đáo hạn sổ tiết kiệm | Mở sổ với `start_date` quá khứ để `maturity_date` ≤ hôm nay, rồi chạy COB | Sổ tự chuyển `matured` (không cần gọi `/mature` tay) | `SELECT status, closed_date FROM public.term_deposits WHERE term_deposit_id=:id;` → `matured` | P1 |
| TC-COB-003 | **Biên nợ xấu — đúng 90 ngày** | Khoản vay có kỳ quá hạn đúng 90 ngày | **Không** chuyển `defaulted` (điều kiện `>90`, không phải `≥90`) | `SELECT status FROM public.loans WHERE loan_id=:id;` → vẫn `active`; `SELECT CURRENT_DATE - due_date AS days_overdue FROM public.loan_payments WHERE loan_id=:id AND paid_date IS NULL;` → xác nhận đúng 90 | P1 |
| TC-COB-004 | **Biên nợ xấu — 91 ngày** | Khoản vay có kỳ quá hạn 91 ngày | Chuyển `status=defaulted` | `SELECT status FROM public.loans WHERE loan_id=:id;` → `defaulted` | P1 |
| TC-COB-005 | Log lịch sử chạy | `GET /cob/runs` sau vài lần chạy | 200, mỗi lần chạy có `run_date`, số liệu đúng | `SELECT cob_run_id, run_date, term_deposits_matured, loans_marked_defaulted FROM public.cob_runs ORDER BY cob_run_id DESC;` | P2 |
| TC-COB-006 | Xem chi tiết 1 lần chạy | `GET /cob/runs/:id` | 200, `details` JSON có danh sách sổ/vay/thẻ đã xử lý (và `matured_errors` nếu có lỗi cục bộ) | `SELECT details FROM public.cob_runs WHERE cob_run_id=:id;` | P3 |
| TC-COB-007 | COB tự động theo cron *(kiểm thử tích hợp)* | Đặt `COB_CRON_SCHEDULE=* * * * *`, khởi động lại server, đợi 1 phút | Log server tự in "Hoàn tất #..." không cần gọi API tay | `SELECT MAX(cob_run_id), MAX(started_at) FROM public.cob_runs;` → xuất hiện dòng mới không do QA gọi API | P3 |
| TC-COB-008 | Tự động chuyển thẻ hết hạn | Phát hành thẻ (`expiry_date` = ngày mai, vì API chặn phát hành thẻ hết hạn ngay từ đầu), rồi chạy `POST /cob/run {as_of_date: "<ngày mốt>"}` để giả lập đã qua ngày hết hạn | Thẻ tự chuyển `expired`, `expired_cards` trong response có ID thẻ này | `SELECT status FROM public.cards WHERE card_id=:id;` → `expired` | P1 |
| TC-COB-009 | **Chạy COB 2 lần liên tiếp (idempotency toàn batch)** | Chạy `/cob/run` khi đang có sổ/vay/thẻ thật sự đến hạn (lần 1 xử lý được), gọi `/cob/run` lần 2 ngay sau đó cùng `as_of_date` | Lần 2: `term_deposits_matured=0`, `loans_marked_defaulted=0`, `expired_cards=[]` — không xử lý trùng lại các bản ghi lần 1 đã xử lý xong | `SELECT COUNT(*) FROM public.cob_runs WHERE run_date=:asOf;` → **2 dòng** (2 lần chạy đều được ghi log), nhưng `SELECT status FROM public.term_deposits/loans/cards WHERE ...` → trạng thái giữ nguyên như sau lần 1, không đổi thêm | P1 |

### 7.13 FR-UI — Giao diện quản trị *(smoke test)*

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-UI-001 | Trang chủ tải được | Mở `http://localhost:3000/` | 200, đủ 12 mục sidebar | *(không cần)* | P2 |
| TC-UI-002 | Đăng nhập Maker/Checker trong tab Duyệt lệnh | Nhập `teller1`/`Demo@123` vào ô Maker | Hiển thị "Đang đăng nhập: ..." đúng tên | *(không cần)* | P2 |
| TC-UI-003 | Tạo khách hàng qua UI | Điền form "Tạo khách hàng mới" | Bảng chi tiết hiển thị đúng dữ liệu vừa tạo | `SELECT * FROM public.customers WHERE email=:email;` | P3 |
| TC-UI-004 | Mở sổ tiết kiệm qua UI, xem lãi dự thu | Thao tác trên tab Tiền gửi | Số liệu khớp với gọi API trực tiếp | `SELECT principal_amount, interest_rate FROM public.term_deposits WHERE term_deposit_id=:id;` | P3 |
| TC-UI-005 | Chạy COB qua nút bấm | Tab Batch cuối ngày → "Chạy COB ngay" | Lịch sử chạy cập nhật thêm 1 dòng | `SELECT COUNT(*) FROM public.cob_runs;` → tăng thêm 1 | P3 |

### 7.14 FR-DOC — Tài liệu API

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-DOC-001 | Swagger UI tải được | Mở `http://localhost:3000/docs` | 200, hiển thị đủ 14 nhóm tag | *(không cần)* | P2 |
| TC-DOC-002 | Thử 1 endpoint qua "Try it out" | Chọn `GET /account-types` → Execute | Trả đúng response như gọi trực tiếp | `SELECT * FROM public.account_types;` | P3 |

### 7.15 FR-CREDIT — Đánh giá điểm tín dụng *(mới, bổ sung sau SRS gốc — xem `src/services/creditScoreService.ts`)*

`GET /customers/:id/credit-score` chỉ **đọc** dữ liệu sẵn có (loans, loan_payments, accounts, fraud_alerts, customers) rồi tính ra 1 điểm số 300–850 (base 550) — không ghi DB. Vì vậy mọi test case đều là kiểm tra **công thức tính toán**: cột "Kiểm chứng qua DB" liệt kê SQL lấy đúng dữ liệu đầu vào để QA tự tính tay rồi so khớp với `factors[]`/`score` trả về, không phải kiểm tra ghi/không ghi như các module khác.

| ID | Tiêu đề | Bước / Dữ liệu | Kết quả mong đợi | Kiểm chứng qua DB (SQL) | Ưu tiên |
|---|---|---|---|---|---|
| TC-CREDIT-001 | Khách hàng không tồn tại | `GET /customers/999999/credit-score` | 404 `CUSTOMER_NOT_FOUND` | *(không cần — GET, không có đường ghi)* | P2 |
| TC-CREDIT-002 | Khách hàng chưa từng vay | Khách hàng mới, không có `loans` | 200, factor `payment_history` có `points=0`, `detail` nêu rõ "chưa từng vay" | `SELECT COUNT(*) FROM public.loans WHERE customer_id=:id;` → `=0` | P1 |
| TC-CREDIT-003 | Lịch sử trả nợ 100% đúng hạn | Toàn bộ `loan_payments` của khách hàng có `paid_date <= due_date` | `payment_history.points = +150` (tối đa, `ratio=1.0` → `(1-0.5)×300`) | `SELECT due_date, paid_date FROM public.loan_payments lp JOIN public.loans l ON l.loan_id=lp.loan_id WHERE l.customer_id=:id;` → tự đếm on-time/trễ/quá hạn rồi tính `(on_time/total-0.5)×300` | P1 |
| TC-CREDIT-004 | Có khoản vay `defaulted` | 1 `loans.status='defaulted'` | Factor `defaulted_loans` xuất hiện, `points = -80` (mỗi khoản, tối đa `-150`) | `SELECT COUNT(*) FROM public.loans WHERE customer_id=:id AND status='defaulted';` → nhân `80`, chặn trần `150` | P1 |
| TC-CREDIT-005 | KYC `verified` so với `pending` | So sánh điểm 2 khách hàng chỉ khác `kyc_status` | Khách `verified` cao hơn khách `pending` đúng **30 điểm** (factor `kyc_status`) | `SELECT kyc_status FROM public.customers WHERE customer_id IN (:id1,:id2);` | P2 |
| TC-CREDIT-006 | KYC `rejected` | `customers.kyc_status='rejected'` | Factor `kyc_status` = **`-100`** điểm (rủi ro danh tính nghiêm trọng) | `SELECT kyc_status FROM public.customers WHERE customer_id=:id;` → `rejected` | P1 |
| TC-CREDIT-007 | Có cảnh báo gian lận đã xác nhận | ≥1 `fraud_alerts.status='closed_confirmed'` trên giao dịch của khách hàng | Factor `fraud_alerts` âm, `-60`/cảnh báo xác nhận (trần `-150`) + `-15`/cảnh báo `open`/`reviewing` (trần `-60`) | `SELECT fa.status, COUNT(*) FROM public.fraud_alerts fa JOIN public.transactions t ON t.transaction_id=fa.transaction_id JOIN public.accounts a ON a.account_id=t.account_id WHERE a.customer_id=:id GROUP BY fa.status;` | P1 |
| TC-CREDIT-008 | Tài khoản bị đóng băng/đóng | ≥1 `accounts.status IN ('frozen','closed')` | Factor `account_status` xuất hiện, `-20`/tài khoản (trần `-60`) | `SELECT COUNT(*) FROM public.accounts WHERE customer_id=:id AND status IN ('frozen','closed');` | P2 |
| TC-CREDIT-009 | **Điểm luôn trong khoảng 300–850 (clamp)** | Khách hàng cộng dồn nhiều yếu tố âm (nợ xấu + KYC rejected + gian lận xác nhận + tài khoản đóng băng) | `score` không bao giờ `< 300` dù tổng điểm trừ lý thuyết âm hơn | Tự cộng tay toàn bộ `points` trong `factors[]` — nếu tổng `< 300` thì `score` trả về phải đúng **`= 300`** (bị chặn dưới, không âm hơn) | P1 |
| TC-CREDIT-010 | Xếp hạng (`grade`) đúng ngưỡng | Dựng/chọn khách hàng có `score` quanh các mốc `800/740/670/580` | `grade` đổi đúng tại ngưỡng: `≥800 excellent`, `≥740 very_good`, `≥670 good`, `≥580 fair`, còn lại `poor`; `recommendation` khớp `grade` | *(không có bảng lưu điểm — đối chiếu trực tiếp `score`/`grade` trong response với bảng ngưỡng nêu ở cột bên trái)* | P2 |

---

## 8. Ma trận truy vết (Traceability Summary)

| Module (SRS) | Số test case | Khoảng ID |
|---|---|---|
| 4.1 FR-REF | 5 | TC-REF-001…005 |
| 4.2 FR-CUST | 17 | TC-CUST-001…017 |
| 4.3 FR-ACC | 11 | TC-ACC-001…011 |
| 4.4 FR-CARD | 5 | TC-CARD-001…005 |
| 4.5 FR-TXN | 20 | TC-TXN-001…020 |
| 4.6 FR-TD | 21 | TC-TD-001…021 |
| 4.7 FR-LOAN | 12 | TC-LOAN-001…012 |
| 4.8 FR-FRAUD | 8 | TC-FRAUD-001…008 |
| 4.9 FR-FX | 11 | TC-FX-001…011 |
| 4.10 FR-GL | 7 | TC-GL-001…007 |
| 4.11 FR-AUTH | 18 | TC-AUTH-001…018 |
| 4.12 FR-COB | 7 | TC-COB-001…007 |
| 4.13 FR-UI | 5 | TC-UI-001…005 |
| 4.14 FR-DOC | 2 | TC-DOC-001…002 |
| FR-CREDIT *(mới, ngoài SRS gốc)* | 10 | TC-CREDIT-001…010 |
| **Tổng** | **159** | |

---

## 9. Rủi ro & giả định khi kiểm thử

- **Test phụ thuộc thời gian** (TC-TD-007…018, TC-COB-002…004): phải tính ngày động (`hôm nay ± N ngày`) khi tạo dữ liệu test, không hard-code ngày cụ thể — nếu không bộ test sẽ pass/fail sai theo thời gian chạy thực tế.
- **Thứ tự chạy**: một số test case tạo dữ liệu dùng cho test khác (vd TC-ACC-001 tạo account cho TC-TXN-*) — nên chạy theo nhóm module tuần tự, không song song trong cùng 1 nhóm.
- **TC-GL-002 là bất biến xuyên suốt**: khuyến nghị chèn bước gọi `GET /gl/trial-balance` sau **mỗi nhóm module** (không chỉ 1 lần cuối) để khoanh vùng chính xác thao tác nào (nếu có) làm lệch sổ cái.
- **TC-COB-007** cần khởi động lại server với biến môi trường khác — nên tách chạy riêng, không nằm trong bộ smoke test thường xuyên.
- Môi trường Supabase dùng chung — tránh chạy song song 2 bộ test cùng lúc gây nhiễu dữ liệu số dư giữa các test case.
- **FR-CREDIT phụ thuộc dữ liệu của FR-LOAN/FR-FRAUD/FR-ACC**: chạy nhóm FR-CREDIT **sau** khi đã có dữ liệu từ các nhóm đó (loan đã tạo + có kỳ trả nợ, fraud alert đã xác nhận, account đã đổi trạng thái) — nếu chạy riêng lẻ trên khách hàng "sạch" thì phần lớn factor sẽ bằng 0 và không kiểm được nhánh tính điểm âm/dương.
