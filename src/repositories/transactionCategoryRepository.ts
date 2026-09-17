import { pool, Executor } from "../db/pool";
import { TransactionCategory } from "../types/domain";

export const transactionCategoryRepository = {
  async findAll(): Promise<TransactionCategory[]> {
    const { rows } = await pool.query<TransactionCategory>(
      `SELECT * FROM transaction_categories ORDER BY category_id`
    );
    return rows;
  },

  async findById(id: number): Promise<TransactionCategory | null> {
    const { rows } = await pool.query<TransactionCategory>(
      `SELECT * FROM transaction_categories WHERE category_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  async findByName(name: string, exec: Executor = pool): Promise<TransactionCategory | null> {
    const { rows } = await exec.query<TransactionCategory>(
      `SELECT * FROM transaction_categories WHERE category_name = :name`,
      { name }
    );
    return rows[0] ?? null;
  },
};
