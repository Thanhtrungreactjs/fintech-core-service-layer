// Domain types khớp trực tiếp với các bảng trong db/schema.sql

export type KycStatus = "pending" | "verified" | "rejected";

export interface Customer {
  customer_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  country: string | null;
  kyc_status: KycStatus;
  referred_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AccountType {
  account_type_id: number;
  type_name: string;
  interest_rate: string;
}

export type AccountStatus = "active" | "dormant" | "frozen" | "closed";

export interface Account {
  account_id: number;
  customer_id: number;
  account_type_id: number;
  account_number: string;
  currency: string;
  balance: string;
  status: AccountStatus;
  opened_at: string;
  closed_at: string | null;
}

export type CardType = "debit" | "credit" | "prepaid";
export type CardStatus = "active" | "blocked" | "expired";

export interface Card {
  card_id: number;
  account_id: number;
  card_number_masked: string;
  card_type: CardType;
  status: CardStatus;
  expiry_date: string;
  issued_at: string;
}

export interface Merchant {
  merchant_id: number;
  merchant_name: string;
  category: string | null;
  country: string | null;
}

export type CategoryGroup = "income" | "spending" | "transfer" | "fee";

export interface TransactionCategory {
  category_id: number;
  category_name: string;
  category_group: CategoryGroup;
}

export type TxnType = "deposit" | "withdrawal" | "transfer" | "payment" | "fee" | "interest";
export type TxnStatus = "pending" | "completed" | "failed" | "reversed";

export interface Transaction {
  transaction_id: number;
  account_id: number;
  related_account_id: number | null;
  card_id: number | null;
  merchant_id: number | null;
  category_id: number;
  txn_type: TxnType;
  status: TxnStatus;
  amount: string;
  currency: string;
  description: string | null;
  txn_timestamp: string;
}

export type LoanStatus = "active" | "closed" | "defaulted";

export interface Loan {
  loan_id: number;
  customer_id: number;
  account_id: number | null;
  loan_type: string | null;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  disbursed_date: string | null;
  status: LoanStatus;
}

export interface LoanPayment {
  payment_id: number;
  loan_id: number;
  installment_no: number;
  due_date: string;
  amount_due: string;
  principal_component: string;
  interest_component: string;
  paid_date: string | null;
  amount_paid: string | null;
  transaction_id: number | null;
}

export type FraudAlertStatus = "open" | "reviewing" | "closed_fp" | "closed_confirmed";

export interface FraudAlert {
  alert_id: number;
  transaction_id: number;
  risk_score: number;
  alert_type: string | null;
  status: FraudAlertStatus;
  created_at: string;
}

export interface ExchangeRate {
  rate_id: number;
  currency_from: string;
  currency_to: string;
  rate: string;
  rate_date: string;
}

export type EkycDecision = "verified" | "rejected" | "manual_review";

export interface EkycVerification {
  verification_id: number;
  customer_id: number;
  extracted_full_name: string | null;
  extracted_id_number: string | null;
  extracted_dob: string | null;
  ocr_confidence: string | null;
  name_match_score: string | null;
  face_match_score: string | null;
  decision: EkycDecision;
  reason: string | null;
  kyc_status_applied: boolean;
  created_at: string;
}

export type TermDepositStatus = "active" | "matured" | "withdrawn" | "closed";
export type InterestMethod = "simple" | "compound";
export type TdPayoutMethod = "maturity" | "monthly";
export type DayCountConvention = "actual_365" | "actual_360";
export type TdPostingType = "monthly_payout" | "maturity_settlement" | "early_withdrawal_settlement";

export interface TermDeposit {
  term_deposit_id: number;
  account_id: number;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  interest_method: InterestMethod;
  payout_method: TdPayoutMethod;
  day_count_convention: DayCountConvention;
  early_withdrawal_rate: string;
  auto_renewal: boolean;
  start_date: string;
  maturity_date: string;
  status: TermDepositStatus;
  renewed_from_id: number | null;
  closed_date: string | null;
  created_at: string;
}

export interface TermDepositPosting {
  posting_id: number;
  term_deposit_id: number;
  posting_type: TdPostingType;
  period_from: string;
  period_to: string;
  days: number;
  interest_amount: string;
  transaction_id: number | null;
  created_at: string;
}

export type GlAccountClass = "asset" | "liability" | "equity" | "income" | "expense";
export type GlNormalBalance = "debit" | "credit";
export type GlEntrySide = "debit" | "credit";

export interface GlAccount {
  gl_account_id: number;
  code: string;
  name: string;
  account_class: GlAccountClass;
  normal_balance: GlNormalBalance;
}

export interface GlEntry {
  gl_entry_id: number;
  transaction_id: number;
  gl_account_id: number;
  entry_side: GlEntrySide;
  amount: string;
  entry_date: string;
  description: string | null;
  created_at: string;
}

export interface GlPostingRule {
  txn_type: TxnType;
  debit_account_code: string;
  credit_account_code: string;
}

export interface TrialBalanceRow {
  code: string;
  name: string;
  account_class: GlAccountClass;
  normal_balance: GlNormalBalance;
  total_debit: string;
  total_credit: string;
  balance: string;
}

export type AppUserRole = "maker" | "checker" | "both" | "admin";

export interface AppUser {
  user_id: number;
  username: string;
  display_name: string;
  role: AppUserRole;
  created_at: string;
}

/** Chỉ dùng nội bộ (appUserRepository.findByUsername/authService) — KHÔNG bao giờ trả ra API. */
export interface AppUserWithPassword extends AppUser {
  password_hash: string;
}

export type AuthQueueOperationType =
  | "CREATE_TRANSACTION"
  | "UPDATE_ACCOUNT_STATUS"
  | "OPEN_TERM_DEPOSIT"
  | "WITHDRAW_TERM_DEPOSIT_EARLY"
  | "MATURE_TERM_DEPOSIT";

export type AuthQueueStatus = "pending" | "authorized" | "rejected";

export interface AuthQueueEntry {
  queue_id: number;
  operation_type: AuthQueueOperationType;
  payload: Record<string, unknown>;
  status: AuthQueueStatus;
  maker_id: number;
  checker_id: number | null;
  input_at: string;
  decided_at: string | null;
  reject_reason: string | null;
  result: Record<string, unknown> | null;
}

export type CobRunStatus = "completed" | "completed_with_errors";

export interface CobRun {
  cob_run_id: number;
  run_date: string;
  started_at: string;
  finished_at: string | null;
  term_deposits_matured: number;
  loans_marked_defaulted: number;
  errors_count: number;
  status: CobRunStatus;
  details: Record<string, unknown>;
}
