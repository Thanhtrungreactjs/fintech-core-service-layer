import { pool, Executor } from "../db/pool";
import { Transaction, TxnStatus, TxnType } from "../types/domain";

export interface CreateTransactionInput {
  account_id: number;
  related_account_id?: number | null;
  card_id?: number | null;
  merchant_id?: number | null;
  category_id: number;
  txn_type: TxnType;
  amount: string;
  currency: string;
  description?: string | null;
  status?: TxnStatus;
}

export interface TransactionFilter {
  txnType?: TxnType;
  categoryId?: number;
  status?: TxnStatus;
  from?: string;
  to?: string;
}

export const transactionRepository = {
  async findById(id: number, exec: Executor = pool): Promise<Transaction | null> {
    const { rows } = await exec.query<Transaction>(
      `SELECT * FROM transactions WHERE transaction_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  /** Khoá row bằng FOR UPDATE — dùng khi reverse() cần đọc + đổi status trong cùng transaction,
   * chặn 2 request reverse() đồng thời trên cùng 1 giao dịch cùng đọc thấy status='completed'
   * rồi cả 2 đều đảo (double-reversal, trừ tiền 2 lần) trước khi bên nào kịp cập nhật status. */
  async findByIdForUpdate(id: number, exec: Executor): Promise<Transaction | null> {
    const { rows } = await exec.query<Transaction>(
      `SELECT * FROM transactions WHERE transaction_id = :id FOR UPDATE`,
      { id }
    );
    return rows[0] ?? null;
  },

  async findByAccount(
    accountId: number,
    filter: TransactionFilter,
    limit: number,
    offset: number
  ) {
    const where = ["(account_id = :accountId OR related_account_id = :accountId)"];
    const params: Record<string, unknown> = { accountId, limit, offset };

    if (filter.txnType) {
      where.push("txn_type = :txnType");
      params.txnType = filter.txnType;
    }
    if (filter.categoryId !== undefined) {
      where.push("category_id = :categoryId");
      params.categoryId = filter.categoryId;
    }
    if (filter.status) {
      where.push("status = :status");
      params.status = filter.status;
    }
    if (filter.from) {
      where.push("txn_timestamp >= :from");
      params.from = filter.from;
    }
    if (filter.to) {
      where.push("txn_timestamp <= :to");
      params.to = filter.to;
    }
    const whereClause = `WHERE ${where.join(" AND ")}`;

    const { rows } = await pool.query<Transaction>(
      `SELECT * FROM transactions ${whereClause} ORDER BY txn_timestamp DESC LIMIT :limit OFFSET :offset`,
      params
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM transactions ${whereClause}`,
      params
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async create(input: CreateTransactionInput, exec: Executor): Promise<Transaction> {
    const { rows } = await exec.query<Transaction>(
      `INSERT INTO transactions
         (account_id, related_account_id, card_id, merchant_id, category_id, txn_type, status, amount, currency, description)
       VALUES
         (:account_id, :related_account_id, :card_id, :merchant_id, :category_id, :txn_type, :status, :amount, :currency, :description)
       RETURNING *`,
      {
        account_id: input.account_id,
        related_account_id: input.related_account_id ?? null,
        card_id: input.card_id ?? null,
        merchant_id: input.merchant_id ?? null,
        category_id: input.category_id,
        txn_type: input.txn_type,
        status: input.status ?? "completed",
        amount: input.amount,
        currency: input.currency,
        description: input.description ?? null,
      }
    );
    return rows[0];
  },

  async updateStatus(id: number, status: TxnStatus, exec: Executor): Promise<void> {
    await exec.query(`UPDATE transactions SET status = :status WHERE transaction_id = :id`, {
      id,
      status,
    });
  },
};
