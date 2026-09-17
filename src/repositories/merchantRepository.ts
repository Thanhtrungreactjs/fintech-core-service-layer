import { pool } from "../db/pool";
import { Merchant } from "../types/domain";

export const merchantRepository = {
  async findAll(limit: number, offset: number) {
    const { rows } = await pool.query<Merchant>(
      `SELECT * FROM merchants ORDER BY merchant_id DESC LIMIT :limit OFFSET :offset`,
      { limit, offset }
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM merchants`
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async findById(id: number): Promise<Merchant | null> {
    const { rows } = await pool.query<Merchant>(
      `SELECT * FROM merchants WHERE merchant_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },
};
