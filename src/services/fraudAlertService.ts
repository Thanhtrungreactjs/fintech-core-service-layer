import { Executor, pool } from "../db/pool";
import { fraudAlertRepository, FraudAlertFilter } from "../repositories/fraudAlertRepository";
import { transactionRepository } from "../repositories/transactionRepository";
import { env } from "../config/env";
import { FraudAlert, FraudAlertStatus, Transaction } from "../types/domain";
import { Errors } from "../utils/errors";
import { Pagination, toLimitOffset } from "../utils/pagination";

const ALLOWED_TRANSITIONS: Record<FraudAlertStatus, FraudAlertStatus[]> = {
  open: ["reviewing", "closed_fp", "closed_confirmed"],
  reviewing: ["closed_fp", "closed_confirmed"],
  closed_fp: [],
  closed_confirmed: [],
};

export const fraudAlertService = {
  /**
   * Rule-based check chạy ngay sau khi ghi transaction (api-design.md mục 3):
   * amount vượt ngưỡng cấu hình (FRAUD_AMOUNT_THRESHOLD, mặc định 50,000,000 VND)
   * -> tự tạo fraud_alerts. risk_score tăng tuyến tính theo mức vượt ngưỡng, tối đa 100.
   */
  async evaluateAndFlag(txn: Transaction, exec: Executor = pool): Promise<FraudAlert | null> {
    const amount = Number(txn.amount);
    if (amount <= env.fraudAmountThreshold) return null;
    const riskScore = Math.min(100, Math.round((amount / env.fraudAmountThreshold) * 50));
    return fraudAlertRepository.create(
      { transaction_id: txn.transaction_id, risk_score: riskScore, alert_type: "LARGE_AMOUNT" },
      exec
    );
  },

  async create(transactionId: number, riskScore: number, alertType?: string): Promise<FraudAlert> {
    const txn = await transactionRepository.findById(transactionId);
    if (!txn) throw Errors.notFound("transaction", transactionId);
    return fraudAlertRepository.create({
      transaction_id: transactionId,
      risk_score: riskScore,
      alert_type: alertType ?? null,
    });
  },

  async getById(id: number): Promise<FraudAlert> {
    const alert = await fraudAlertRepository.findById(id);
    if (!alert) throw Errors.notFound("fraud_alert", id);
    return alert;
  },

  async list(filter: FraudAlertFilter, pagination: Pagination) {
    const { limit, offset } = toLimitOffset(pagination);
    return fraudAlertRepository.findAll(filter, limit, offset);
  },

  async updateStatus(id: number, status: FraudAlertStatus): Promise<FraudAlert> {
    const alert = await this.getById(id);
    if (!ALLOWED_TRANSITIONS[alert.status].includes(status)) {
      throw Errors.business(
        "FRAUD_ALERT_STATUS_TRANSITION_INVALID",
        `Không thể chuyển alert ${id} từ '${alert.status}' sang '${status}'`
      );
    }
    await fraudAlertRepository.updateStatus(id, status);
    return this.getById(id);
  },
};
