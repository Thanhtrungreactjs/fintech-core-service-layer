import { pool } from "../db/pool";
import { CobRun, CobRunStatus } from "../types/domain";

export const cobRunRepository = {
  async create(input: {
    run_date: string;
    term_deposits_matured: number;
    loans_marked_defaulted: number;
    errors_count: number;
    status: CobRunStatus;
    details: Record<string, unknown>;
  }): Promise<CobRun> {
    const { rows } = await pool.query<CobRun>(
      `INSERT INTO cob_runs
         (run_date, finished_at, term_deposits_matured, loans_marked_defaulted, errors_count, status, details)
       VALUES (:run_date, now(), :term_deposits_matured, :loans_marked_defaulted, :errors_count, :status, :details::jsonb)
       RETURNING *`,
      { ...input, details: JSON.stringify(input.details) }
    );
    return rows[0];
  },

  async list(limit: number, offset: number) {
    const { rows } = await pool.query<CobRun>(
      `SELECT * FROM cob_runs ORDER BY cob_run_id DESC LIMIT :limit OFFSET :offset`,
      { limit, offset }
    );
    const { rows: countRows } = await pool.query<{ total: string }>(`SELECT COUNT(*) AS total FROM cob_runs`);
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async findById(id: number): Promise<CobRun | null> {
    const { rows } = await pool.query<CobRun>(`SELECT * FROM cob_runs WHERE cob_run_id = :id`, { id });
    return rows[0] ?? null;
  },
};
