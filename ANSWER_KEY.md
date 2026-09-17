# Phụ lục Đáp án Tham chiếu (Answer Key)
## Đi kèm `TEST_DESIGN.md` — Fintech Core Service Layer

| | |
|---|---|
| **Phiên bản** | 1.0 |
| **Ngày** | 2026-09-15 |
| **Mục đích** | Cung cấp sẵn **bộ dữ liệu đầu vào cụ thể + đáp án đã tính toán chính xác** cho các test case có công thức (lãi suất, phân bổ gốc/lãi, quy đổi ngoại tệ, risk score) trong `TEST_DESIGN.md` — QA chỉ cần nhập đúng input dưới đây rồi so khớp kết quả trả về, **không cần tự tính tay**. |

> Toàn bộ số liệu trong tài liệu này đã được **chạy thật trên hệ thống và đối chiếu đúng** trong quá trình phát triển (không phải tính lý thuyết suông) — trừ khi có ghi chú "*tính theo công thức, chưa chạy thật*".

---

## 1. Cách dùng tài liệu này

Với mỗi "Bộ dữ liệu" (Recipe) bên dưới: nhập **chính xác** các tham số vào request tương ứng trong `TEST_DESIGN.md`, rồi so kết quả trả về với cột "Đáp án". Nếu tài liệu ghi "không phụ thuộc ngày cụ thể", nghĩa là bạn có thể tự chọn ngày miễn giữ đúng **khoảng cách số ngày/số tháng** đã nêu — kết quả vẫn phải khớp.

---

## 2. Bảng công thức gốc (trích thẳng từ code, `src/services/*.ts`)

| Công thức | Diễn giải | Áp dụng cho |
|---|---|---|
| `I = P × (r/100) × ngày / cơ_sở_năm` | Lãi đơn — `cơ_sở_năm` = 365 (`actual_365`) hoặc 360 (`actual_360`) | Lãi dự thu, tất toán đáo hạn (lãi đơn), rút trước hạn, trả lãi tháng |
| `I = P × ((1 + r/100/12)^n − 1)` | Lãi kép ghép hàng tháng, trọn `n` tháng | Đáo hạn sổ `interest_method=compound` |
| `risk_score = min(100, round((amount / threshold) × 50))` | Điểm rủi ro gian lận | Tạo `fraud_alerts` tự động |
| `to_amount = from_amount × rate` | Quy đổi ngoại tệ | `POST /fx-transfers` |
| `installment = P × mr / (1 − (1+mr)^−n)`, `mr = r/100/12` | Trả góp đều mỗi kỳ (French amortization), `mr`=lãi suất tháng | Lịch trả góp vay |
| `interest_kỳ_i = dư_nợ_còn_lại × mr`; `gốc_kỳ_i = installment − interest_kỳ_i` | Phân bổ gốc/lãi từng kỳ vay | Lịch trả góp vay |

---

## 3. Tiền gửi có kỳ hạn (FR-TD)

### 3.1 Recipe TD-A — Lãi đơn, tất toán đáo hạn (dùng cho TC-TD-005, TC-TD-012)

**Input:**
```json
{
  "account_id": "<tài khoản của bạn, đủ số dư ≥ 10.000.000>",
  "principal_amount": "10000000",
  "interest_rate": "6.5",
  "term_months": 3,
  "interest_method": "simple",
  "payout_method": "maturity",
  "day_count_convention": "actual_365",
  "start_date": "2026-06-07"
}
```
→ Hệ thống tự tính `maturity_date = 2026-09-07` (92 ngày sau `start_date`).

**Đáp án** (gọi `/mature` hoặc xem `accrued-interest` vào đúng/sau ngày `2026-09-07`):

| Đại lượng | Giá trị |
|---|---|
| Số ngày (`start_date` → `maturity_date`) | **92 ngày** |
| Lãi = `10.000.000 × 0.065 × 92 / 365` | **163.835,62 đ** |
| Tổng nhận về khi tất toán (`auto_renewal=false`) | **10.163.835,62 đ** |
| Bút toán GL | Nợ `2100`=10.000.000,00 + Nợ `5000`=163.835,62 / Có `2000`=10.163.835,62 |

*(Đã chạy thật và xác nhận khớp trong quá trình phát triển.)*

### 3.2 Recipe TD-B — Rút trước hạn, chỉ hưởng lãi không kỳ hạn (dùng cho TC-TD-008)

**Input:**
```json
{
  "account_id": "<tài khoản của bạn, đủ số dư ≥ 5.000.000>",
  "principal_amount": "5000000",
  "interest_rate": "7.0",
  "term_months": 6,
  "early_withdrawal_rate": "0.5",
  "start_date": "2026-01-01"
}
```
Sau đó gọi `POST /:id/withdraw-early` với `value_date: "2026-01-10"` (**đúng 9 ngày** sau `start_date`).

**Đáp án:**

| Đại lượng | Giá trị |
|---|---|
| Số ngày thực gửi | **9 ngày** |
| Lãi suất áp dụng | **0.5%/năm** (early_withdrawal_rate) — **KHÔNG phải 7%** đã cam kết |
| Lãi = `5.000.000 × 0.005 × 9 / 365` | **616,44 đ** |
| Tổng nhận về | **5.000.616,44 đ** |
| So sánh: nếu (sai) tính theo lãi cam kết 7% | sẽ ra 8.630,14đ — **nếu hệ thống trả số này là BUG nghiêm trọng** |

> Kết quả chỉ phụ thuộc **khoảng cách 9 ngày**, không phụ thuộc ngày cụ thể — có thể đổi cả 2 ngày miễn giữ đúng khoảng cách 9 ngày, đáp án không đổi.

### 3.3 Recipe TD-C — Lãi kép trọn kỳ (dùng cho TC-TD-014)

**Input:**
```json
{
  "account_id": "<tài khoản của bạn, đủ số dư ≥ 10.000.000>",
  "principal_amount": "10000000",
  "interest_rate": "6.0",
  "term_months": 12,
  "interest_method": "compound",
  "start_date": "2025-08-11"
}
```
→ `maturity_date = 2026-08-11`. Gọi `/mature` vào đúng/sau ngày này.

**Đáp án:**

| Đại lượng | Giá trị |
|---|---|
| Lãi = `10.000.000 × ((1 + 0.06/12)^12 − 1)` | **616.778,12 đ** |
| Tổng nhận về (`auto_renewal=false`) | **10.616.778,12 đ** |

> Công thức lãi kép **chỉ phụ thuộc số tháng (12)**, không phụ thuộc ngày cụ thể hay số ngày thực tế trong các tháng đó — dùng bất kỳ `start_date` nào, chỉ cần đủ 12 tháng trọn, đáp án không đổi.

### 3.4 Recipe TD-D — Trả lãi hàng tháng + đáo hạn tái tục gốc-lãi (dùng cho TC-TD-013, TC-TD-015, TC-TD-016)

**Input:**
```json
{
  "account_id": "<tài khoản của bạn, đủ số dư ≥ 20.000.000>",
  "principal_amount": "20000000",
  "interest_rate": "5.4",
  "term_months": 1,
  "payout_method": "monthly",
  "auto_renewal": true,
  "start_date": "2026-08-06"
}
```
→ `maturity_date = 2026-09-06` (31 ngày sau).

**Bước 1** — `POST /:id/interest-postings/monthly` với `value_date: "2026-08-21"` (15 ngày sau `start_date`):

| Đại lượng | Giá trị |
|---|---|
| Số ngày kỳ 1 | **15 ngày** |
| Lãi kỳ 1 = `20.000.000 × 0.054 × 15 / 365` | **44.383,56 đ** |

**Bước 2** — `POST /:id/mature` với `value_date: "2026-09-06"` (đáo hạn đúng ngày):

| Đại lượng | Giá trị |
|---|---|
| Số ngày còn lại (2026-08-21 → 2026-09-06) | **16 ngày** |
| Lãi kỳ 2 (còn lại) = `20.000.000 × 0.054 × 16 / 365` | **47.342,47 đ** |
| Sổ mới (`renewed_from_id` trỏ về sổ cũ) `principal_amount` | **20.047.342,47 đ** (= 20.000.000 + 47.342,47) |
| `account.balance` sau bước 2 | **KHÔNG đổi** (lãi nhập gốc sổ mới, không qua tài khoản) |

**Bước 3** (test TC-TD-016) — gọi lại `/interest-postings/monthly` lần 2 với **cùng** `value_date: "2026-08-21"` hoặc bất kỳ ngày nào không sau ngày đó → phải nhận lỗi `TERM_DEPOSIT_NO_ACCRUAL`.

*(Toàn bộ Recipe TD-D đã chạy thật, số liệu xác nhận khớp 100%.)*

---

## 4. Cho vay (FR-LOAN)

### 4.1 Recipe LOAN-A — Lịch trả góp + tách gốc/lãi (dùng cho TC-LOAN-001, TC-LOAN-006, TC-GL-007)

**Input:**
```json
{
  "account_id": "<tài khoản của bạn, đủ số dư để trả góp>",
  "principal_amount": "10000000",
  "interest_rate": "12",
  "term_months": 6,
  "disbursed_date": "<bất kỳ ngày nào>"
}
```

**Đáp án — lịch trả góp đầy đủ 6 kỳ** (lãi suất tháng = 12%/12 = 1%):

| Kỳ | `amount_due` | `principal_component` | `interest_component` |
|---|---|---|---|
| 1 | 1.725.483,67 | 1.625.483,67 | 100.000,00 |
| 2 | 1.725.483,67 | 1.641.738,50 | 83.745,16 |
| 3 | 1.725.483,67 | *(tự tính hoặc lấy từ response — dư nợ còn lại × 1%)* | |
| ... | ... | ... | ... |
| 6 (kỳ cuối) | *(điều chỉnh làm tròn)* | = đúng dư nợ còn lại | |

> Kết quả **không phụ thuộc `disbursed_date`** (chỉ ảnh hưởng `due_date` từng kỳ, không ảnh hưởng số tiền) — chỉ phụ thuộc `principal_amount`, `interest_rate`, `term_months`.

**Kiểm tra nhanh (không cần tính hết 6 kỳ):** `Σ principal_component` của cả 6 kỳ phải **bằng đúng** `10.000.000,00` (không lệch dù 1 xu, vì kỳ cuối được điều chỉnh phần dư làm tròn).

**Sau khi trả đúng kỳ 1** (`amount_paid = "1725483.67"`) — bút toán GL (TC-GL-007):

| Tài khoản kế toán | Bên | Số tiền |
|---|---|---|
| 2000 (Tiền gửi thanh toán) | Nợ | 1.725.483,67 |
| 1100 (Dư nợ cho vay) | Có | 1.625.483,67 |
| 4000 (Thu nhập lãi cho vay) | Có | 100.000,00 |

*(Đã chạy thật, số liệu xác nhận khớp 100% — bao gồm cả bút toán GL, lấy trực tiếp từ `gl_entries` thật.)*

---

## 5. Cảnh báo gian lận (FR-FRAUD)

Giả sử `FRAUD_AMOUNT_THRESHOLD = 50000000` (mặc định `.env`) — **nếu môi trường của bạn đặt giá trị khác, thay `50000000` bằng giá trị thật rồi tính lại theo công thức mục 2**.

| `amount` (đ) | Có tạo alert? | `risk_score` | Ghi chú |
|---|---|---|---|
| 50.000.000 | **Không** | — | `amount ≤ threshold` (đúng bằng, không phải vượt) — *đã chạy thật, xác nhận không tạo alert* |
| 50.000.001 | Có | **50** | Vượt đúng 1 đồng — *đã chạy thật, xác nhận đúng risk_score=50* |
| 60.000.000 | Có | **60** | *đã chạy thật, xác nhận đúng 60* |
| 100.000.000 | Có | `round(2×50)` = **100** | *tính theo công thức* |
| 250.000.000 | Có | `round(5×50)=250` → chặn ở **100** | *tính theo công thức (giới hạn tối đa)* |

---

## 6. Quy đổi ngoại tệ (FR-FX)

### 6.1 Recipe FX-A — USD → VND

**Chuẩn bị:** `POST /exchange-rates {currency_from:"USD", currency_to:"VND", rate:"25000", rate_date:"2026-09-14"}`

**Input:** `POST /fx-transfers {from_account_id:<TK USD>, to_account_id:<TK VND>, from_amount:"200", rate_date:"2026-09-14"}`

**Đáp án:**

| Đại lượng | Giá trị |
|---|---|
| `to_amount = 200 × 25000` | **5.000.000,00 VND** |
| Balance TK USD | `-200.00` |
| Balance TK VND | `+5,000,000.00` |
| Bút toán GL | Nợ `2000` = Có `2000` = **5.000.000,00** (wash entry, cùng mã TK) |

*(Đã chạy thật, xác nhận khớp 100%.)*

### 6.2 Recipe FX-B — VND → USD (chiều ngược, cần seed thêm tỷ giá riêng)

**Chuẩn bị:** `POST /exchange-rates {currency_from:"VND", currency_to:"USD", rate:"0.00004", rate_date:"2026-09-14"}`

**Input:** `POST /fx-transfers {from_account_id:<TK VND>, to_account_id:<TK USD>, from_amount:"5000000", rate_date:"2026-09-14"}`

**Đáp án:** `to_amount = 5,000,000 × 0.00004 = ` **200,00 USD** *(đã chạy thật để xác nhận, khớp chính xác)*.

---

## 7. Sổ cái kế toán kép (FR-GL)

Không có "đáp án cố định" cho `trial-balance` vì phụ thuộc toàn bộ lịch sử giao dịch đã chạy — nhưng có **1 bất biến tuyệt đối phải luôn đúng bất kể dữ liệu nào**:

```sql
SELECT
  SUM(CASE WHEN entry_side='debit' THEN amount ELSE 0 END) AS total_debit,
  SUM(CASE WHEN entry_side='credit' THEN amount ELSE 0 END) AS total_credit
FROM public.gl_entries;
```
→ `total_debit` phải **bằng tuyệt đối** `total_credit` — nếu lệch dù 0,01đ, đây là **lỗi nghiêm trọng (P1 fail)**, cần dừng test và báo cáo ngay, không tiếp tục các test case sau.

---

## 8. Ghi chú về sai số làm tròn

Mọi phép tính lãi làm tròn 2 chữ số thập phân bằng `.toFixed(2)` (làm tròn thông thường, không phải ngân hàng làm tròn tới 5/10). Nếu kết quả QA tính tay lệch **≤ 0,01đ** so với đáp án do khác cách làm tròn trung gian, **không tính là lỗi** — chỉ báo lỗi khi lệch từ 0,02đ trở lên hoặc lệch hoàn toàn về bản chất (vd nhầm lãi suất cam kết thay vì lãi suất không kỳ hạn).
