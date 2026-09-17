import { pool } from "../db/pool";
import { Card, CardStatus, CardType } from "../types/domain";

export interface CreateCardInput {
  account_id: number;
  card_number_masked: string;
  card_type: CardType;
  expiry_date: string;
}

export const cardRepository = {
  async findById(id: number): Promise<Card | null> {
    const { rows } = await pool.query<Card>(`SELECT * FROM cards WHERE card_id = :id`, { id });
    return rows[0] ?? null;
  },

  async findByAccount(accountId: number): Promise<Card[]> {
    const { rows } = await pool.query<Card>(
      `SELECT * FROM cards WHERE account_id = :accountId ORDER BY card_id DESC`,
      { accountId }
    );
    return rows;
  },

  /** Thẻ active/blocked nhưng đã qua ngày hết hạn tính đến asOf — dùng cho COB tự động chuyển expired. */
  async findDueForExpiry(asOf: string): Promise<Card[]> {
    const { rows } = await pool.query<Card>(
      `SELECT * FROM cards WHERE status IN ('active', 'blocked') AND expiry_date <= :asOf ORDER BY card_id`,
      { asOf }
    );
    return rows;
  },

  async create(input: CreateCardInput): Promise<Card> {
    const { rows } = await pool.query<Card>(
      `INSERT INTO cards (account_id, card_number_masked, card_type, expiry_date)
       VALUES (:account_id, :card_number_masked, :card_type, :expiry_date)
       RETURNING *`,
      { ...input }
    );
    return rows[0];
  },

  async updateStatus(id: number, status: CardStatus): Promise<void> {
    await pool.query(`UPDATE cards SET status = :status WHERE card_id = :id`, { id, status });
  },
};
