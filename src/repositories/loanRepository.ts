import { pool, Executor } from "../db/pool";
import { Loan, LoanStatus } from "../types/domain";

export interface CreateLoanInput {
  customer_id: number;
  account_id: number;
  loan_type?: string | null;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  disbursed_date: string;
}

export const loanRepository = {
  async findById(id: number, exec: Executor = pool): Promise<Loan | null> {
    const { rows } = await exec.query<Loan>(`SELECT * FROM loans WHERE loan_id = :id`, { id });
    return rows[0] ?? null;
  },

  async findByIdForUpdate(id: number, exec: Executor): Promise<Loan | null> {
    const { rows } = await exec.query<Loan>(`SELECT * FROM loans WHERE loan_id = :id FOR UPDATE`, { id });
    return rows[0] ?? null;
  },

  async create(input: CreateLoanInput, exec: Executor): Promise<Loan> {
    const { rows } = await exec.query<Loan>(
      `INSERT INTO loans (customer_id, account_id, loan_type, principal_amount, interest_rate, term_months, disbursed_date)
       VALUES (:customer_id, :account_id, :loan_type, :principal_amount, :interest_rate, :term_months, :disbursed_date)
       RETURNING *`,
      {
        customer_id: input.customer_id,
        account_id: input.account_id,
        loan_type: input.loan_type ?? null,
        principal_amount: input.principal_amount,
        interest_rate: input.interest_rate,
        term_months: input.term_months,
        disbursed_date: input.disbursed_date,
      }
    );
    return rows[0];
  },

  async updateStatus(id: number, status: LoanStatus, exec: Executor = pool): Promise<void> {
    await exec.query(`UPDATE loans SET status = :status WHERE loan_id = :id`, { id, status });
  },

  async findByCustomer(customerId: number, exec: Executor = pool): Promise<Loan[]> {
    const { rows } = await exec.query<Loan>(
      `SELECT * FROM loans WHERE customer_id = :customerId ORDER BY loan_id DESC`,
      { customerId }
    );
    return rows;
  },

  /** Danh sách loan đang active có ít nhất 1 kỳ quá hạn tính đến asOf, kèm số ngày quá hạn lớn nhất. */
  async findOverdue(asOf: string, exec: Executor = pool): Promise<
    { loan_id: number; days_overdue: number; overdue_installments: number; overdue_amount: string }[]
  > {
    const { rows } = await exec.query<{
      loan_id: number;
      days_overdue: number;
      overdue_installments: number;
      overdue_amount: string;
    }>(
      `SELECT lp.loan_id,
              MAX((:asOf::date) - lp.due_date) AS days_overdue,
              COUNT(*) AS overdue_installments,
              SUM(lp.amount_due) AS overdue_amount
       FROM loan_payments lp
       JOIN loans l ON l.loan_id = lp.loan_id
       WHERE lp.paid_date IS NULL AND lp.due_date <= :asOf AND l.status = 'active'
       GROUP BY lp.loan_id`,
      { asOf }
    );
    return rows;
  },
};
