import { pool, Executor } from "../db/pool";
import { Account, AccountStatus } from "../types/domain";

export interface CreateAccountInput {
  customer_id: number;
  account_type_id: number;
  account_number: string;
  currency?: string;
}

export const accountRepository = {
  async findById(id: number, exec: Executor = pool): Promise<Account | null> {
    const { rows } = await exec.query<Account>(
      `SELECT * FROM accounts WHERE account_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  /** Khoá row bằng FOR UPDATE — dùng khi cần đọc + ghi balance trong cùng transaction để tránh race condition. */
  async findByIdForUpdate(id: number, exec: Executor): Promise<Account | null> {
    const { rows } = await exec.query<Account>(
      `SELECT * FROM accounts WHERE account_id = :id FOR UPDATE`,
      { id }
    );
    return rows[0] ?? null;
  },

  async findByCustomer(customerId: number, limit: number, offset: number) {
    const { rows } = await pool.query<Account>(
      `SELECT * FROM accounts WHERE customer_id = :customerId ORDER BY account_id DESC LIMIT :limit OFFSET :offset`,
      { customerId, limit, offset }
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM accounts WHERE customer_id = :customerId`,
      { customerId }
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async create(input: CreateAccountInput): Promise<Account> {
    const { rows } = await pool.query<Account>(
      `INSERT INTO accounts (customer_id, account_type_id, account_number, currency)
       VALUES (:customer_id, :account_type_id, :account_number, :currency)
       RETURNING *`,
      {
        customer_id: input.customer_id,
        account_type_id: input.account_type_id,
        account_number: input.account_number,
        currency: input.currency ?? "VND",
      }
    );
    return rows[0];
  },

  async updateStatus(id: number, status: AccountStatus, exec: Executor = pool): Promise<void> {
    const closedAt = status === "closed" ? "now()" : "NULL";
    await exec.query(
      `UPDATE accounts SET status = :status, closed_at = ${closedAt} WHERE account_id = :id`,
      { id, status }
    );
  },

  async adjustBalance(id: number, delta: string, exec: Executor): Promise<void> {
    await exec.query(`UPDATE accounts SET balance = balance + :delta WHERE account_id = :id`, {
      id,
      delta,
    });
  },
};
