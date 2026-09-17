import { pool, Executor } from "../db/pool";
import { TermDeposit, TermDepositPosting, TdPostingType } from "../types/domain";

export interface CreateTermDepositInput {
  account_id: number;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  interest_method: string;
  payout_method: string;
  day_count_convention: string;
  early_withdrawal_rate: string;
  auto_renewal: boolean;
  start_date: string;
  maturity_date: string;
  renewed_from_id?: number | null;
}

export interface CreatePostingInput {
  term_deposit_id: number;
  posting_type: TdPostingType;
  period_from: string;
  period_to: string;
  days: number;
  interest_amount: string;
  transaction_id: number | null;
}

export const termDepositRepository = {
  async findById(id: number, exec: Executor = pool): Promise<TermDeposit | null> {
    const { rows } = await exec.query<TermDeposit>(
      `SELECT * FROM term_deposits WHERE term_deposit_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  /** Khoá row bằng FOR UPDATE — dùng khi cần đọc + ghi trạng thái/lãi trong cùng transaction. */
  async findByIdForUpdate(id: number, exec: Executor): Promise<TermDeposit | null> {
    const { rows } = await exec.query<TermDeposit>(
      `SELECT * FROM term_deposits WHERE term_deposit_id = :id FOR UPDATE`,
      { id }
    );
    return rows[0] ?? null;
  },

  /** Sổ đang active đã tới/qua hạn tính đến asOf — dùng cho COB tự động xử lý đáo hạn. */
  async findDueForMaturity(asOf: string, exec: Executor = pool): Promise<TermDeposit[]> {
    const { rows } = await exec.query<TermDeposit>(
      `SELECT * FROM term_deposits WHERE status = 'active' AND maturity_date <= :asOf ORDER BY term_deposit_id`,
      { asOf }
    );
    return rows;
  },

  async findByAccount(accountId: number, limit: number, offset: number) {
    const { rows } = await pool.query<TermDeposit>(
      `SELECT * FROM term_deposits WHERE account_id = :accountId ORDER BY term_deposit_id DESC LIMIT :limit OFFSET :offset`,
      { accountId, limit, offset }
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM term_deposits WHERE account_id = :accountId`,
      { accountId }
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async findByCustomer(customerId: number, limit: number, offset: number) {
    const { rows } = await pool.query<TermDeposit>(
      `SELECT td.* FROM term_deposits td
       JOIN accounts a ON a.account_id = td.account_id
       WHERE a.customer_id = :customerId
       ORDER BY td.term_deposit_id DESC LIMIT :limit OFFSET :offset`,
      { customerId, limit, offset }
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM term_deposits td
       JOIN accounts a ON a.account_id = td.account_id
       WHERE a.customer_id = :customerId`,
      { customerId }
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async create(input: CreateTermDepositInput, exec: Executor): Promise<TermDeposit> {
    const { rows } = await exec.query<TermDeposit>(
      `INSERT INTO term_deposits
         (account_id, principal_amount, interest_rate, term_months, interest_method, payout_method,
          day_count_convention, early_withdrawal_rate, auto_renewal, start_date, maturity_date, renewed_from_id)
       VALUES
         (:account_id, :principal_amount, :interest_rate, :term_months, :interest_method, :payout_method,
          :day_count_convention, :early_withdrawal_rate, :auto_renewal, :start_date, :maturity_date, :renewed_from_id)
       RETURNING *`,
      { ...input, renewed_from_id: input.renewed_from_id ?? null }
    );
    return rows[0];
  },

  async updateStatus(
    id: number,
    status: string,
    closedDate: string | null,
    exec: Executor
  ): Promise<void> {
    await exec.query(
      `UPDATE term_deposits SET status = :status, closed_date = :closedDate WHERE term_deposit_id = :id`,
      { id, status, closedDate }
    );
  },

  async addPosting(input: CreatePostingInput, exec: Executor): Promise<TermDepositPosting> {
    const { rows } = await exec.query<TermDepositPosting>(
      `INSERT INTO term_deposit_postings
         (term_deposit_id, posting_type, period_from, period_to, days, interest_amount, transaction_id)
       VALUES (:term_deposit_id, :posting_type, :period_from, :period_to, :days, :interest_amount, :transaction_id)
       RETURNING *`,
      { ...input }
    );
    return rows[0];
  },

  async findPostings(termDepositId: number): Promise<TermDepositPosting[]> {
    const { rows } = await pool.query<TermDepositPosting>(
      `SELECT * FROM term_deposit_postings WHERE term_deposit_id = :termDepositId ORDER BY posting_id`,
      { termDepositId }
    );
    return rows;
  },

  /** Ngày cuối kỳ của lần ghi nhận lãi gần nhất — mốc bắt đầu tính lãi cho lần kế tiếp. */
  async lastPostingPeriodTo(termDepositId: number, exec: Executor): Promise<string | null> {
    const { rows } = await exec.query<{ period_to: string }>(
      `SELECT period_to FROM term_deposit_postings WHERE term_deposit_id = :termDepositId
       ORDER BY period_to DESC LIMIT 1`,
      { termDepositId }
    );
    return rows[0]?.period_to ?? null;
  },
};
