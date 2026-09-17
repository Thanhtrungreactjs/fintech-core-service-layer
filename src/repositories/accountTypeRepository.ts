import { pool } from "../db/pool";
import { AccountType } from "../types/domain";

export const accountTypeRepository = {
  async findAll(): Promise<AccountType[]> {
    const { rows } = await pool.query<AccountType>(
      `SELECT * FROM account_types ORDER BY account_type_id`
    );
    return rows;
  },

  async findById(id: number): Promise<AccountType | null> {
    const { rows } = await pool.query<AccountType>(
      `SELECT * FROM account_types WHERE account_type_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  async create(typeName: string, interestRate: number): Promise<AccountType> {
    const { rows } = await pool.query<AccountType>(
      `INSERT INTO account_types (type_name, interest_rate) VALUES (:typeName, :interestRate)
       RETURNING *`,
      { typeName, interestRate }
    );
    return rows[0];
  },
};
