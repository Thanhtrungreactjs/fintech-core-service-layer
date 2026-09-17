const envelope = (dataSchema: object) => ({
  type: "object",
  properties: {
    status: { type: "string", enum: ["SUCCESS"] },
    data: dataSchema,
    error: { type: "null" },
    meta: {
      type: "object",
      nullable: true,
      properties: { total: { type: "integer" }, page: { type: "integer" }, size: { type: "integer" } },
    },
  },
});

const errorEnvelope = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ERROR"] },
    data: { type: "null" },
    error: {
      type: "object",
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  },
};

const idempotencyHeader = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: { type: "string" },
  description: "Key duy nhất cho mỗi lần thử giao dịch; request lặp lại cùng key + cùng body trả lại response đã lưu.",
};

const pageParams = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
  { name: "size", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 20 } },
];

const schemas = {
  Customer: {
    type: "object",
    properties: {
      customer_id: { type: "integer" },
      full_name: { type: "string" },
      email: { type: "string", format: "email" },
      phone: { type: "string", nullable: true },
      dob: { type: "string", format: "date", nullable: true },
      country: { type: "string", nullable: true },
      kyc_status: { type: "string", enum: ["pending", "verified", "rejected"] },
      referred_by: { type: "integer", nullable: true },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
    },
  },
  Account: {
    type: "object",
    properties: {
      account_id: { type: "integer" },
      customer_id: { type: "integer" },
      account_type_id: { type: "integer" },
      account_number: { type: "string" },
      currency: { type: "string" },
      balance: { type: "string" },
      status: { type: "string", enum: ["active", "dormant", "frozen", "closed"] },
      opened_at: { type: "string", format: "date-time" },
      closed_at: { type: "string", format: "date-time", nullable: true },
    },
  },
  AccountType: {
    type: "object",
    properties: {
      account_type_id: { type: "integer" },
      type_name: { type: "string" },
      interest_rate: { type: "string" },
    },
  },
  Card: {
    type: "object",
    properties: {
      card_id: { type: "integer" },
      account_id: { type: "integer" },
      card_number_masked: { type: "string" },
      card_type: { type: "string", enum: ["debit", "credit", "prepaid"] },
      status: { type: "string", enum: ["active", "blocked", "expired"] },
      expiry_date: { type: "string", format: "date" },
    },
  },
  Merchant: {
    type: "object",
    properties: {
      merchant_id: { type: "integer" },
      merchant_name: { type: "string" },
      category: { type: "string", nullable: true },
    },
  },
  TransactionCategory: {
    type: "object",
    properties: {
      category_id: { type: "integer" },
      category_name: { type: "string" },
      category_group: { type: "string" },
    },
  },
  Transaction: {
    type: "object",
    properties: {
      transaction_id: { type: "integer" },
      account_id: { type: "integer" },
      related_account_id: { type: "integer", nullable: true },
      card_id: { type: "integer", nullable: true },
      merchant_id: { type: "integer", nullable: true },
      category_id: { type: "integer" },
      txn_type: { type: "string", enum: ["deposit", "withdrawal", "transfer", "payment", "fee", "interest"] },
      status: { type: "string", enum: ["completed", "reversed"] },
      amount: { type: "string" },
      currency: { type: "string" },
      description: { type: "string", nullable: true },
      txn_timestamp: { type: "string", format: "date-time" },
    },
  },
  Loan: {
    type: "object",
    properties: {
      loan_id: { type: "integer" },
      customer_id: { type: "integer" },
      account_id: { type: "integer", nullable: true },
      loan_type: { type: "string", nullable: true },
      principal_amount: { type: "string" },
      interest_rate: { type: "string" },
      term_months: { type: "integer" },
      disbursed_date: { type: "string", format: "date" },
      status: { type: "string", enum: ["active", "closed", "defaulted"] },
    },
  },
  LoanPayment: {
    type: "object",
    properties: {
      payment_id: { type: "integer" },
      loan_id: { type: "integer" },
      installment_no: { type: "integer" },
      due_date: { type: "string", format: "date" },
      amount_due: { type: "string" },
      principal_component: { type: "string" },
      interest_component: { type: "string" },
      amount_paid: { type: "string", nullable: true },
      paid_date: { type: "string", format: "date", nullable: true },
      transaction_id: { type: "integer", nullable: true },
    },
  },
  FraudAlert: {
    type: "object",
    properties: {
      alert_id: { type: "integer" },
      transaction_id: { type: "integer" },
      risk_score: { type: "integer" },
      alert_type: { type: "string", nullable: true },
      status: { type: "string", enum: ["open", "reviewing", "closed_fp", "closed_confirmed"] },
      created_at: { type: "string", format: "date-time" },
    },
  },
  EkycVerification: {
    type: "object",
    properties: {
      verification_id: { type: "integer" },
      customer_id: { type: "integer" },
      extracted_full_name: { type: "string", nullable: true },
      extracted_id_number: { type: "string", nullable: true },
      extracted_dob: { type: "string", format: "date", nullable: true },
      ocr_confidence: { type: "string", nullable: true },
      name_match_score: { type: "string", nullable: true },
      face_match_score: { type: "string", nullable: true },
      decision: { type: "string", enum: ["verified", "rejected", "manual_review"] },
      reason: { type: "string", nullable: true },
      kyc_status_applied: { type: "boolean" },
      created_at: { type: "string", format: "date-time" },
    },
  },
  ExchangeRate: {
    type: "object",
    properties: {
      currency_from: { type: "string" },
      currency_to: { type: "string" },
      rate: { type: "string" },
      rate_date: { type: "string", format: "date" },
    },
  },
  TermDeposit: {
    type: "object",
    properties: {
      term_deposit_id: { type: "integer" },
      account_id: { type: "integer" },
      principal_amount: { type: "string" },
      interest_rate: { type: "string" },
      term_months: { type: "integer" },
      interest_method: { type: "string", enum: ["simple", "compound"] },
      payout_method: { type: "string", enum: ["maturity", "monthly"] },
      day_count_convention: { type: "string", enum: ["actual_365", "actual_360"] },
      early_withdrawal_rate: { type: "string" },
      auto_renewal: { type: "boolean" },
      start_date: { type: "string", format: "date" },
      maturity_date: { type: "string", format: "date" },
      status: { type: "string", enum: ["active", "matured", "withdrawn", "closed"] },
      renewed_from_id: { type: "integer", nullable: true },
      closed_date: { type: "string", format: "date", nullable: true },
      created_at: { type: "string", format: "date-time" },
    },
  },
  TermDepositPosting: {
    type: "object",
    properties: {
      posting_id: { type: "integer" },
      term_deposit_id: { type: "integer" },
      posting_type: { type: "string", enum: ["monthly_payout", "maturity_settlement", "early_withdrawal_settlement"] },
      period_from: { type: "string", format: "date" },
      period_to: { type: "string", format: "date" },
      days: { type: "integer" },
      interest_amount: { type: "string" },
      transaction_id: { type: "integer", nullable: true },
      created_at: { type: "string", format: "date-time" },
    },
  },
  GlAccount: {
    type: "object",
    properties: {
      gl_account_id: { type: "integer" }, code: { type: "string" }, name: { type: "string" },
      account_class: { type: "string", enum: ["asset", "liability", "equity", "income", "expense"] },
      normal_balance: { type: "string", enum: ["debit", "credit"] },
    },
  },
  GlEntry: {
    type: "object",
    properties: {
      gl_entry_id: { type: "integer" }, transaction_id: { type: "integer" }, gl_account_id: { type: "integer" },
      entry_side: { type: "string", enum: ["debit", "credit"] }, amount: { type: "string" },
      entry_date: { type: "string", format: "date" }, description: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      account_code: { type: "string" }, account_name: { type: "string" },
    },
  },
  TrialBalanceRow: {
    type: "object",
    properties: {
      code: { type: "string" }, name: { type: "string" },
      account_class: { type: "string", enum: ["asset", "liability", "equity", "income", "expense"] },
      normal_balance: { type: "string", enum: ["debit", "credit"] },
      total_debit: { type: "string" }, total_credit: { type: "string" }, balance: { type: "string" },
    },
  },
  AppUser: {
    type: "object",
    properties: {
      user_id: { type: "integer" }, username: { type: "string" }, display_name: { type: "string" },
      role: { type: "string", enum: ["maker", "checker", "both", "admin"] },
      created_at: { type: "string", format: "date-time" },
    },
  },
  CobRun: {
    type: "object",
    properties: {
      cob_run_id: { type: "integer" }, run_date: { type: "string", format: "date" },
      started_at: { type: "string", format: "date-time" }, finished_at: { type: "string", format: "date-time", nullable: true },
      term_deposits_matured: { type: "integer" }, loans_marked_defaulted: { type: "integer" }, errors_count: { type: "integer" },
      status: { type: "string", enum: ["completed", "completed_with_errors"] },
      details: { type: "object" },
    },
  },
  AuthQueueEntry: {
    type: "object",
    properties: {
      queue_id: { type: "integer" },
      operation_type: { type: "string", enum: ["CREATE_TRANSACTION", "UPDATE_ACCOUNT_STATUS", "OPEN_TERM_DEPOSIT", "WITHDRAW_TERM_DEPOSIT_EARLY", "MATURE_TERM_DEPOSIT"] },
      payload: { type: "object" },
      status: { type: "string", enum: ["pending", "authorized", "rejected"] },
      maker_id: { type: "integer" }, checker_id: { type: "integer", nullable: true },
      input_at: { type: "string", format: "date-time" }, decided_at: { type: "string", format: "date-time", nullable: true },
      reject_reason: { type: "string", nullable: true }, result: { type: "object", nullable: true },
    },
  },
};

export const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Fintech Core — Service Layer API",
    version: "1.0.0",
    description:
      "Controller/Service/Repository layer cho Fintech Core DB (Postgres/Supabase). Envelope response chuẩn: {status, data, error}.",
  },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Customers" }, { name: "Accounts" }, { name: "Account Types" }, { name: "Cards" },
    { name: "Merchants" }, { name: "Transaction Categories" }, { name: "Transactions" },
    { name: "Loans" }, { name: "Fraud Alerts" }, { name: "Exchange Rates" }, { name: "Term Deposits" },
    { name: "General Ledger" }, { name: "Maker-Checker" }, { name: "Close of Business" },
  ],
  components: {
    schemas,
    responses: {
      NotFound: { description: "Không tìm thấy", content: { "application/json": { schema: errorEnvelope } } },
      ValidationError: { description: "Dữ liệu không hợp lệ", content: { "application/json": { schema: errorEnvelope } } },
    },
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Lấy token từ POST /auth/login" },
    },
  },
  paths: {
    "/customers": {
      post: {
        tags: ["Customers"], summary: "Tạo khách hàng",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["full_name", "email"],
          properties: {
            full_name: { type: "string" }, email: { type: "string", format: "email" },
            phone: { type: "string", nullable: true }, dob: { type: "string", format: "date", nullable: true },
            country: { type: "string", nullable: true }, referred_by: { type: "integer", nullable: true },
          },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.Customer) } } } },
      },
      get: {
        tags: ["Customers"], summary: "Tìm kiếm khách hàng",
        parameters: [
          ...pageParams,
          { name: "email", in: "query", schema: { type: "string" } },
          { name: "kyc_status", in: "query", schema: { type: "string", enum: ["pending", "verified", "rejected"] } },
          { name: "referred_by", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Danh sách khách hàng", content: { "application/json": { schema: envelope({ type: "array", items: schemas.Customer }) } } } },
      },
    },
    "/customers/{id}": {
      get: {
        tags: ["Customers"], summary: "Chi tiết khách hàng",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Customer) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
      patch: {
        tags: ["Customers"], summary: "Cập nhật thông tin khách hàng",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { content: { "application/json": { schema: {
          type: "object",
          properties: { full_name: { type: "string" }, phone: { type: "string", nullable: true }, dob: { type: "string", format: "date", nullable: true }, country: { type: "string", nullable: true } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Customer) } } } },
      },
    },
    "/customers/{id}/kyc": {
      patch: {
        tags: ["Customers"], summary: "Cập nhật trạng thái KYC",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["kyc_status"], properties: { kyc_status: { type: "string", enum: ["verified", "rejected", "pending"] } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Customer) } } } },
      },
    },
    "/customers/{id}/referrals": {
      get: {
        tags: ["Customers"], summary: "Danh sách khách hàng được giới thiệu bởi khách hàng này",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.Customer }) } } } },
      },
    },
    "/customers/{id}/accounts": {
      get: {
        tags: ["Customers"], summary: "Danh sách tài khoản của khách hàng",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, ...pageParams],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.Account }) } } } },
      },
    },
    "/customers/{id}/term-deposits": {
      get: {
        tags: ["Term Deposits"], summary: "Danh sách sổ tiết kiệm của khách hàng (gộp mọi tài khoản)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, ...pageParams],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.TermDeposit }) } } } },
      },
    },
    "/customers/{id}/ekyc/verify": {
      post: {
        tags: ["Customers"], summary: "Xác minh eKYC (OCR giấy tờ + đối chiếu khuôn mặt)",
        description: "multipart/form-data: field 'id_image' (ảnh giấy tờ, bắt buộc) + field 'face_match_score' (số 0-100, do client tự tính bằng face-api.js so ảnh giấy tờ với ảnh selfie, tùy chọn). Nếu quyết định là verified/rejected và khách hàng đang pending, tự động cập nhật kyc_status.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "multipart/form-data": { schema: {
          type: "object", required: ["id_image"],
          properties: { id_image: { type: "string", format: "binary" }, face_match_score: { type: "number", minimum: 0, maximum: 100 } },
        } } } },
        responses: { "201": { description: "Đã ghi nhận kết quả xác minh", content: { "application/json": { schema: envelope(schemas.EkycVerification) } } } },
      },
    },
    "/customers/{id}/ekyc": {
      get: {
        tags: ["Customers"], summary: "Lịch sử xác minh eKYC của khách hàng",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.EkycVerification }) } } } },
      },
    },
    "/customers/{id}/loans": {
      post: {
        tags: ["Loans"], summary: "Tạo khoản vay cho khách hàng (tự sinh lịch trả nợ, giải ngân thật)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, idempotencyHeader],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["account_id", "principal_amount", "interest_rate", "term_months", "disbursed_date"],
          properties: {
            account_id: { type: "integer", description: "Tài khoản giải ngân + nhận trả góp" },
            loan_type: { type: "string", nullable: true }, principal_amount: { type: "string" },
            interest_rate: { type: "number" }, term_months: { type: "integer" }, disbursed_date: { type: "string", format: "date" },
          },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.Loan) } } } },
      },
    },
    "/account-types": {
      get: { tags: ["Account Types"], summary: "Danh sách loại tài khoản", responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.AccountType }) } } } } },
      post: {
        tags: ["Account Types"], summary: "Tạo loại tài khoản",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["type_name", "interest_rate"], properties: { type_name: { type: "string" }, interest_rate: { type: "number" } },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.AccountType) } } } },
      },
    },
    "/accounts": {
      post: {
        tags: ["Accounts"], summary: "Mở tài khoản",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["customer_id", "account_type_id"],
          properties: { customer_id: { type: "integer" }, account_type_id: { type: "integer" }, currency: { type: "string" } },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.Account) } } } },
      },
    },
    "/accounts/{id}": {
      get: {
        tags: ["Accounts"], summary: "Chi tiết tài khoản",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Account) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/accounts/{id}/status": {
      patch: {
        tags: ["Accounts"], summary: "Đổi trạng thái tài khoản",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["status"], properties: { status: { type: "string", enum: ["active", "dormant", "frozen", "closed"] } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Account) } } } },
      },
    },
    "/accounts/{id}/balance-history": {
      get: {
        tags: ["Accounts"], summary: "Lịch sử số dư của tài khoản",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.Transaction }) } } } },
      },
    },
    "/accounts/{id}/cards": {
      get: {
        tags: ["Cards"], summary: "Danh sách thẻ của tài khoản",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.Card }) } } } },
      },
      post: {
        tags: ["Cards"], summary: "Phát hành thẻ cho tài khoản",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["card_type", "expiry_date"],
          properties: { card_type: { type: "string", enum: ["debit", "credit", "prepaid"] }, expiry_date: { type: "string", format: "date" } },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.Card) } } } },
      },
    },
    "/accounts/{id}/transactions": {
      get: {
        tags: ["Transactions"], summary: "Danh sách giao dịch của tài khoản",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } }, ...pageParams,
          { name: "txn_type", in: "query", schema: { type: "string", enum: ["deposit", "withdrawal", "transfer", "payment", "fee", "interest"] } },
          { name: "category_id", in: "query", schema: { type: "integer" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "completed", "failed", "reversed"] } },
          { name: "from", in: "query", schema: { type: "string" } },
          { name: "to", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.Transaction }) } } } },
      },
    },
    "/accounts/{id}/term-deposits": {
      get: {
        tags: ["Term Deposits"], summary: "Danh sách sổ tiết kiệm của tài khoản",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, ...pageParams],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.TermDeposit }) } } } },
      },
    },
    "/cards/{id}": {
      get: {
        tags: ["Cards"], summary: "Chi tiết thẻ",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Card) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/cards/{id}/status": {
      patch: {
        tags: ["Cards"], summary: "Đổi trạng thái thẻ",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["status"], properties: { status: { type: "string", enum: ["active", "blocked", "expired"] } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Card) } } } },
      },
    },
    "/merchants": {
      get: {
        tags: ["Merchants"], summary: "Danh sách merchant",
        parameters: pageParams,
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.Merchant }) } } } },
      },
    },
    "/transaction-categories": {
      get: {
        tags: ["Transaction Categories"], summary: "Danh sách danh mục giao dịch",
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.TransactionCategory }) } } } },
      },
    },
    "/transactions": {
      post: {
        tags: ["Transactions"], summary: "Tạo giao dịch",
        parameters: [idempotencyHeader],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["account_id", "category_id", "txn_type", "amount"],
          properties: {
            account_id: { type: "integer" }, related_account_id: { type: "integer", nullable: true },
            card_id: { type: "integer", nullable: true }, merchant_id: { type: "integer", nullable: true },
            category_id: { type: "integer" },
            txn_type: { type: "string", enum: ["deposit", "withdrawal", "transfer", "payment", "fee", "interest"] },
            amount: { type: "string" }, currency: { type: "string" }, description: { type: "string", nullable: true },
          },
        } } } },
        responses: { "201": { description: "Đã tạo. Nếu amount vượt ngưỡng FRAUD_AMOUNT_THRESHOLD, response kèm luôn fraud_alert vừa tự sinh (không cần gọi GET /fraud-alerts riêng).", content: { "application/json": { schema: envelope({
          allOf: [schemas.Transaction, { type: "object", properties: { fraud_alert: { ...schemas.FraudAlert, nullable: true } } }],
        }) } } }, "400": { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/transactions/{id}": {
      get: {
        tags: ["Transactions"], summary: "Chi tiết giao dịch",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Transaction) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/transactions/{id}/reverse": {
      post: {
        tags: ["Transactions"], summary: "Đảo giao dịch (ghi giao dịch bù trừ, không xoá bản gốc)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, idempotencyHeader],
        responses: { "201": { description: "Đã tạo giao dịch đảo", content: { "application/json": { schema: envelope(schemas.Transaction) } } } },
      },
    },
    "/loans/{id}": {
      get: {
        tags: ["Loans"], summary: "Chi tiết khoản vay",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.Loan) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/loans/{id}/payments": {
      get: {
        tags: ["Loans"], summary: "Lịch trả nợ của khoản vay",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.LoanPayment }) } } } },
      },
    },
    "/loans/{id}/payments/{paymentId}/pay": {
      post: {
        tags: ["Loans"], summary: "Thanh toán một kỳ trả nợ",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "paymentId", in: "path", required: true, schema: { type: "integer" } },
          idempotencyHeader,
        ],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["amount_paid", "paid_date"],
          properties: { amount_paid: { type: "string" }, paid_date: { type: "string", format: "date" } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.LoanPayment) } } } },
      },
    },
    "/fraud-alerts": {
      get: {
        tags: ["Fraud Alerts"], summary: "Danh sách cảnh báo gian lận",
        parameters: [
          ...pageParams,
          { name: "status", in: "query", schema: { type: "string", enum: ["open", "reviewing", "closed_fp", "closed_confirmed"] } },
          { name: "min_risk_score", in: "query", schema: { type: "integer", minimum: 0, maximum: 100 } },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.FraudAlert }) } } } },
      },
      post: {
        tags: ["Fraud Alerts"], summary: "Tạo cảnh báo thủ công",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["transaction_id", "risk_score"],
          properties: { transaction_id: { type: "integer" }, risk_score: { type: "integer", minimum: 0, maximum: 100 }, alert_type: { type: "string", nullable: true } },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.FraudAlert) } } } },
      },
    },
    "/fraud-alerts/{id}": {
      get: {
        tags: ["Fraud Alerts"], summary: "Chi tiết cảnh báo gian lận",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.FraudAlert) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/fraud-alerts/{id}/status": {
      patch: {
        tags: ["Fraud Alerts"], summary: "Cập nhật trạng thái cảnh báo",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["status"], properties: { status: { type: "string", enum: ["reviewing", "closed_fp", "closed_confirmed"] } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.FraudAlert) } } } },
      },
    },
    "/exchange-rates": {
      get: {
        tags: ["Exchange Rates"], summary: "Tra cứu tỷ giá",
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string", minLength: 3, maxLength: 3 } },
          { name: "to", in: "query", required: true, schema: { type: "string", minLength: 3, maxLength: 3 } },
          { name: "date", in: "query", required: true, schema: { type: "string", format: "date" } },
        ],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.ExchangeRate) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
      post: {
        tags: ["Exchange Rates"], summary: "Tạo tỷ giá",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["currency_from", "currency_to", "rate", "rate_date"],
          properties: {
            currency_from: { type: "string", minLength: 3, maxLength: 3 }, currency_to: { type: "string", minLength: 3, maxLength: 3 },
            rate: { type: "number" }, rate_date: { type: "string", format: "date" },
          },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.ExchangeRate) } } } },
      },
    },
    "/fx-transfers": {
      post: {
        tags: ["Exchange Rates"], summary: "Quy đổi ngoại tệ giữa 2 tài khoản khác currency (dùng tỷ giá as-of)",
        description: "Chỉ hỗ trợ cặp có 1 chân là VND (base currency của hệ thống). Tra tỷ giá as-of từ exchange_rates theo rate_date.",
        parameters: [idempotencyHeader],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["from_account_id", "to_account_id", "from_amount"],
          properties: {
            from_account_id: { type: "integer" }, to_account_id: { type: "integer" },
            from_amount: { type: "string" }, rate_date: { type: "string", format: "date", description: "Mặc định hôm nay" },
          },
        } } } },
        responses: { "201": { description: "OK", content: { "application/json": { schema: envelope({
          type: "object", properties: {
            from_transaction: schemas.Transaction, to_transaction: schemas.Transaction,
            rate: { type: "string" }, to_amount: { type: "string" },
          },
        }) } } }, "422": { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/term-deposits": {
      post: {
        tags: ["Term Deposits"], summary: "Mở sổ tiết kiệm (tiền gửi có kỳ hạn)",
        description: "Trích nộp principal_amount từ account_id (ghi 1 giao dịch withdrawal), tạo sổ tiết kiệm mới.",
        parameters: [idempotencyHeader],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["account_id", "principal_amount", "interest_rate", "term_months"],
          properties: {
            account_id: { type: "integer" }, principal_amount: { type: "string" }, interest_rate: { type: "string" },
            term_months: { type: "integer" },
            interest_method: { type: "string", enum: ["simple", "compound"], default: "simple" },
            payout_method: { type: "string", enum: ["maturity", "monthly"], default: "maturity" },
            day_count_convention: { type: "string", enum: ["actual_365", "actual_360"], default: "actual_365" },
            early_withdrawal_rate: { type: "string", default: "0.20" },
            auto_renewal: { type: "boolean", default: false },
            start_date: { type: "string", format: "date", description: "Mặc định hôm nay" },
          },
        } } } },
        responses: { "201": { description: "Đã tạo", content: { "application/json": { schema: envelope(schemas.TermDeposit) } } }, "400": { $ref: "#/components/responses/ValidationError" } },
      },
    },
    "/term-deposits/{id}": {
      get: {
        tags: ["Term Deposits"], summary: "Chi tiết sổ tiết kiệm",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.TermDeposit) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/term-deposits/{id}/accrued-interest": {
      get: {
        tags: ["Term Deposits"], summary: "Lãi dự thu tính đến hôm nay (tham khảo, chưa hạch toán)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({
          type: "object", properties: { as_of: { type: "string", format: "date" }, days_elapsed: { type: "integer" }, accrued_interest: { type: "string" } },
        }) } } } },
      },
    },
    "/term-deposits/{id}/postings": {
      get: {
        tags: ["Term Deposits"], summary: "Lịch sử ghi nhận lãi của sổ tiết kiệm",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.TermDepositPosting }) } } } },
      },
    },
    "/term-deposits/{id}/interest-postings/monthly": {
      post: {
        tags: ["Term Deposits"], summary: "Ghi nhận + chi trả lãi 1 kỳ (chỉ cho sổ payout_method='monthly')",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, idempotencyHeader],
        requestBody: { content: { "application/json": { schema: {
          type: "object", properties: { value_date: { type: "string", format: "date", description: "Mặc định hôm nay" } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.TermDepositPosting) } } } },
      },
    },
    "/term-deposits/{id}/withdraw-early": {
      post: {
        tags: ["Term Deposits"], summary: "Rút trước hạn (chỉ hưởng lãi không kỳ hạn trên số ngày thực gửi)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, idempotencyHeader],
        requestBody: { content: { "application/json": { schema: {
          type: "object", properties: { value_date: { type: "string", format: "date", description: "Mặc định hôm nay" } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({
          type: "object", properties: { deposit: schemas.TermDeposit, posting: schemas.TermDepositPosting },
        }) } } } },
      },
    },
    "/term-deposits/{id}/mature": {
      post: {
        tags: ["Term Deposits"], summary: "Xử lý đáo hạn (tái tục gốc+lãi nếu auto_renewal, hoặc tất toán)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }, idempotencyHeader],
        requestBody: { content: { "application/json": { schema: {
          type: "object", properties: { value_date: { type: "string", format: "date", description: "Mặc định hôm nay" } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({
          type: "object", properties: { deposit: schemas.TermDeposit, posting: schemas.TermDepositPosting, renewed: { ...schemas.TermDeposit, nullable: true } },
        }) } } } },
      },
    },
    "/gl/accounts": {
      get: {
        tags: ["General Ledger"], summary: "Hệ thống tài khoản kế toán (Chart of Accounts)",
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.GlAccount }) } } } },
      },
    },
    "/gl/trial-balance": {
      get: {
        tags: ["General Ledger"], summary: "Bảng cân đối thử — kiểm tra tổng Nợ = tổng Có toàn hệ thống",
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({
          type: "object", properties: {
            accounts: { type: "array", items: schemas.TrialBalanceRow },
            total_debit: { type: "string" }, total_credit: { type: "string" }, balanced: { type: "boolean" },
          },
        }) } } } },
      },
    },
    "/gl/accounts/{code}/entries": {
      get: {
        tags: ["General Ledger"], summary: "Sổ cái chi tiết theo 1 tài khoản kế toán (vd '2000')",
        parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }, ...pageParams],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.GlEntry }) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/gl/transactions/{id}/entries": {
      get: {
        tags: ["General Ledger"], summary: "Bút toán GL phát sinh từ 1 transaction cụ thể (audit trail)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.GlEntry }) } } } },
      },
    },
    "/users": {
      get: {
        tags: ["Maker-Checker"], summary: "Danh sách người dùng nội bộ demo (teller/supervisor)",
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.AppUser }) } } } },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Maker-Checker"], summary: "Đăng nhập app_user, nhận JWT (mật khẩu demo cho cả 5 user: Demo@123)",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["username", "password"],
          properties: { username: { type: "string" }, password: { type: "string" } },
        } } } },
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: envelope({
              type: "object",
              properties: { token: { type: "string" }, user: schemas.AppUser },
            }) } },
          },
          "401": { description: "Sai tên đăng nhập hoặc mật khẩu", content: { "application/json": { schema: errorEnvelope } } },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Maker-Checker"], summary: "Thông tin user ứng với token hiện tại", security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: envelope({
              type: "object",
              properties: { user_id: { type: "integer" }, username: { type: "string" }, role: { type: "string" } },
            }) } },
          },
        },
      },
    },
    "/auth-queue": {
      post: {
        tags: ["Maker-Checker"], summary: "Maker nộp 1 yêu cầu nghiệp vụ vào hàng đợi chờ duyệt (CHƯA có hiệu lực)",
        security: [{ bearerAuth: [] }],
        description: "maker_id lấy từ token đã đăng nhập (Authorization: Bearer), không nhận qua body.",
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["operation_type", "payload"],
          properties: {
            operation_type: { type: "string", enum: ["CREATE_TRANSACTION", "UPDATE_ACCOUNT_STATUS", "OPEN_TERM_DEPOSIT", "WITHDRAW_TERM_DEPOSIT_EARLY", "MATURE_TERM_DEPOSIT"] },
            payload: { type: "object", description: "Body tương ứng operation_type — vd CREATE_TRANSACTION dùng đúng shape của POST /transactions" },
          },
        } } } },
        responses: { "201": { description: "Đã nộp, đang chờ duyệt", content: { "application/json": { schema: envelope(schemas.AuthQueueEntry) } } }, "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: errorEnvelope } } } },
      },
      get: {
        tags: ["Maker-Checker"], summary: "Danh sách hàng đợi chờ duyệt",
        parameters: [...pageParams, { name: "status", in: "query", schema: { type: "string", enum: ["pending", "authorized", "rejected"] } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.AuthQueueEntry }) } } } },
      },
    },
    "/auth-queue/{id}": {
      get: {
        tags: ["Maker-Checker"], summary: "Chi tiết 1 yêu cầu trong hàng đợi",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.AuthQueueEntry) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
    "/auth-queue/{id}/authorize": {
      post: {
        tags: ["Maker-Checker"], summary: "Checker phê duyệt — thực thi nghiệp vụ thật (checker phải khác maker, xác định qua token)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.AuthQueueEntry) } } }, "400": { $ref: "#/components/responses/ValidationError" }, "401": { description: "Chưa đăng nhập", content: { "application/json": { schema: errorEnvelope } } } },
      },
    },
    "/auth-queue/{id}/reject": {
      post: {
        tags: ["Maker-Checker"], summary: "Checker từ chối yêu cầu (checker phải khác maker, xác định qua token)",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        requestBody: { required: true, content: { "application/json": { schema: {
          type: "object", required: ["reason"], properties: { reason: { type: "string" } },
        } } } },
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.AuthQueueEntry) } } } },
      },
    },
    "/cob/run": {
      post: {
        tags: ["Close of Business"], summary: "Chạy batch cuối ngày (đáo hạn tự động + phân loại nợ quá hạn)",
        requestBody: { content: { "application/json": { schema: {
          type: "object", properties: { as_of_date: { type: "string", format: "date", description: "Mặc định hôm nay" } },
        } } } },
        responses: { "201": { description: "Đã chạy xong", content: { "application/json": { schema: envelope(schemas.CobRun) } } } },
      },
    },
    "/cob/runs": {
      get: {
        tags: ["Close of Business"], summary: "Lịch sử các lần chạy COB",
        parameters: pageParams,
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope({ type: "array", items: schemas.CobRun }) } } } },
      },
    },
    "/cob/runs/{id}": {
      get: {
        tags: ["Close of Business"], summary: "Chi tiết 1 lần chạy COB",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "OK", content: { "application/json": { schema: envelope(schemas.CobRun) } } }, "404": { $ref: "#/components/responses/NotFound" } },
      },
    },
  },
};
