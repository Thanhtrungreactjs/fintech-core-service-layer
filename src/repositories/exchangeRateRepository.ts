import { pool } from "../db/pool";
import { ExchangeRate } from "../types/domain";

export interface CreateExchangeRateInput {
  currency_from: string;
  currency_to: string;
  rate: string | number;
  rate_date: string;
}

export const exchangeRateRepository = {
  /** Lấy tỷ giá as-of: bản ghi gần nhất có rate_date <= ngày yêu cầu (api-design.md mục 2). */
  async findAsOf(from: string, to: string, date: string): Promise<ExchangeRate | null> {
    const { rows } = await pool.query<ExchangeRate>(
      `SELECT * FROM exchange_rates
       WHERE currency_from = :from AND currency_to = :to AND rate_date <= :date
       ORDER BY rate_date DESC LIMIT 1`,
      { from, to, date }
    );
    return rows[0] ?? null;
  },

  async create(input: CreateExchangeRateInput): Promise<ExchangeRate> {
    const { rows } = await pool.query<ExchangeRate>(
      `INSERT INTO exchange_rates (currency_from, currency_to, rate, rate_date)
       VALUES (:currency_from, :currency_to, :rate, :rate_date)
       ON CONFLICT (currency_from, currency_to, rate_date) DO UPDATE SET rate = EXCLUDED.rate
       RETURNING *`,
      { ...input }
    );
    return rows[0];
  },
};
