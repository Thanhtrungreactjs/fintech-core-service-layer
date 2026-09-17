import { Executor, pool } from "../db/pool";
import { FraudAlert, FraudAlertStatus } from "../types/domain";

export interface FraudAlertFilter {
  status?: FraudAlertStatus;
  minRiskScore?: number;
}

export interface CreateFraudAlertInput {
  transaction_id: number;
  risk_score: number;
  alert_type?: string | null;
}

export const fraudAlertRepository = {
  async findById(id: number): Promise<FraudAlert | null> {
    const { rows } = await pool.query<FraudAlert>(
      `SELECT * FROM fraud_alerts WHERE alert_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  async findAll(filter: FraudAlertFilter, limit: number, offset: number) {
    const where: string[] = [];
    const params: Record<string, unknown> = { limit, offset };

    if (filter.status) {
      where.push("status = :status");
      params.status = filter.status;
    }
    if (filter.minRiskScore !== undefined) {
      where.push("risk_score >= :minRiskScore");
      params.minRiskScore = filter.minRiskScore;
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query<FraudAlert>(
      `SELECT * FROM fraud_alerts ${whereClause} ORDER BY alert_id DESC LIMIT :limit OFFSET :offset`,
      params
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM fraud_alerts ${whereClause}`,
      params
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async create(input: CreateFraudAlertInput, exec: Executor = pool): Promise<FraudAlert> {
    const { rows } = await exec.query<FraudAlert>(
      `INSERT INTO fraud_alerts (transaction_id, risk_score, alert_type)
       VALUES (:transaction_id, :risk_score, :alert_type)
       RETURNING *`,
      {
        transaction_id: input.transaction_id,
        risk_score: input.risk_score,
        alert_type: input.alert_type ?? null,
      }
    );
    return rows[0];
  },

  async updateStatus(id: number, status: FraudAlertStatus): Promise<void> {
    await pool.query(`UPDATE fraud_alerts SET status = :status WHERE alert_id = :id`, {
      id,
      status,
    });
  },
};
