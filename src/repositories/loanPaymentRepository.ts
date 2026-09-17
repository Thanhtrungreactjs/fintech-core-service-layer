import { pool, Executor } from "../db/pool";
import { LoanPayment } from "../types/domain";

export interface CreateLoanPaymentInput {
  loan_id: number;
  installment_no: number;
  due_date: string;
  amount_due: string;
  principal_component: string;
  interest_component: string;
}

export const loanPaymentRepository = {
  async findById(id: number, exec: Executor = pool): Promise<LoanPayment | null> {
    const { rows } = await exec.query<LoanPayment>(
      `SELECT * FROM loan_payments WHERE payment_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  async findByIdForUpdate(id: number, exec: Executor): Promise<LoanPayment | null> {
    const { rows } = await exec.query<LoanPayment>(
      `SELECT * FROM loan_payments WHERE payment_id = :id FOR UPDATE`,
      { id }
    );
    return rows[0] ?? null;
  },

  async findByLoan(loanId: number): Promise<LoanPayment[]> {
    const { rows } = await pool.query<LoanPayment>(
      `SELECT * FROM loan_payments WHERE loan_id = :loanId ORDER BY installment_no`,
      { loanId }
    );
    return rows;
  },

  async bulkCreate(rowsInput: CreateLoanPaymentInput[], exec: Executor): Promise<void> {
    if (rowsInput.length === 0) return;
    const values = rowsInput
      .map(
        (_, i) =>
          `(:loan_id${i}, :installment_no${i}, :due_date${i}, :amount_due${i}, :principal_component${i}, :interest_component${i})`
      )
      .join(", ");
    const params: Record<string, unknown> = {};
    rowsInput.forEach((r, i) => {
      params[`loan_id${i}`] = r.loan_id;
      params[`installment_no${i}`] = r.installment_no;
      params[`due_date${i}`] = r.due_date;
      params[`amount_due${i}`] = r.amount_due;
      params[`principal_component${i}`] = r.principal_component;
      params[`interest_component${i}`] = r.interest_component;
    });
    await exec.query(
      `INSERT INTO loan_payments
         (loan_id, installment_no, due_date, amount_due, principal_component, interest_component)
       VALUES ${values}`,
      params
    );
  },

  async markPaid(
    id: number,
    paidDate: string,
    amountPaid: string,
    transactionId: number,
    exec: Executor
  ): Promise<void> {
    await exec.query(
      `UPDATE loan_payments SET paid_date = :paidDate, amount_paid = :amountPaid, transaction_id = :transactionId
       WHERE payment_id = :id`,
      { id, paidDate, amountPaid, transactionId }
    );
  },
};
