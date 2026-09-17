import { cobRunRepository } from "../repositories/cobRunRepository";
import { termDepositRepository } from "../repositories/termDepositRepository";
import { termDepositService } from "./termDepositService";
import { loanRepository } from "../repositories/loanRepository";
import { cardRepository } from "../repositories/cardRepository";
import { CobRun } from "../types/domain";
import { Errors } from "../utils/errors";

/** Basel/chuẩn ngân hàng phổ biến: quá hạn > 90 ngày -> phân loại nợ xấu (NPL / defaulted). */
const OVERDUE_DEFAULT_DAYS = 90;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface CobDetails {
  matured_deposits: { term_deposit_id: number; renewed: boolean; renewed_id: number | null }[];
  matured_errors: { term_deposit_id: number; error: string }[];
  overdue_loans: { loan_id: number; days_overdue: number; overdue_installments: number; overdue_amount: string }[];
  newly_defaulted_loans: number[];
  expired_cards: number[];
}

export const cobService = {
  /**
   * Batch cuối ngày (Close of Business) — trong T24 thật chạy tự động mỗi đêm; ở đây
   * trigger thủ công qua API/nút bấm nhưng logic xử lý giống hệt batch thật:
   *  1) Tự động đáo hạn mọi sổ tiết kiệm đã tới/qua hạn (gọi lại đúng termDepositService.mature
   *     — không viết lại business rule, chỉ lặp qua danh sách và gọi hàng loạt).
   *  2) Rà soát các khoản vay có kỳ quá hạn; kỳ nào quá hạn > 90 ngày thì chuyển loan sang
   *     'defaulted' (phân loại nợ xấu chuẩn Basel).
   *  3) Tự động chuyển mọi thẻ (active/blocked) đã qua ngày hết hạn (expiry_date <= asOf)
   *     sang trạng thái 'expired' — cùng cơ chế thay đổi trạng thái theo ngày như bước 1/2,
   *     chỉ là phép cập nhật đơn giản nên không cần try/catch cô lập như sổ tiết kiệm.
   * Mỗi lỗi xử lý từng sổ/khoản vay được cô lập (try/catch riêng) để 1 lỗi không chặn cả batch —
   * đúng nguyên tắc batch xử lý hàng loạt phải resilient, không fail-fast toàn bộ vì 1 bản ghi lỗi.
   */
  async run(asOfDate?: string): Promise<CobRun> {
    const asOf = asOfDate ?? todayISO();
    const details: CobDetails = {
      matured_deposits: [],
      matured_errors: [],
      overdue_loans: [],
      newly_defaulted_loans: [],
      expired_cards: [],
    };

    const dueDeposits = await termDepositRepository.findDueForMaturity(asOf);
    for (const d of dueDeposits) {
      try {
        const result = await termDepositService.mature(d.term_deposit_id, asOf);
        details.matured_deposits.push({
          term_deposit_id: d.term_deposit_id,
          renewed: result.renewed !== null,
          renewed_id: result.renewed?.term_deposit_id ?? null,
        });
      } catch (err) {
        details.matured_errors.push({
          term_deposit_id: d.term_deposit_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const overdue = await loanRepository.findOverdue(asOf);
    for (const o of overdue) {
      details.overdue_loans.push(o);
      if (o.days_overdue > OVERDUE_DEFAULT_DAYS) {
        await loanRepository.updateStatus(o.loan_id, "defaulted");
        details.newly_defaulted_loans.push(o.loan_id);
      }
    }

    const dueCards = await cardRepository.findDueForExpiry(asOf);
    for (const c of dueCards) {
      await cardRepository.updateStatus(c.card_id, "expired");
      details.expired_cards.push(c.card_id);
    }

    return cobRunRepository.create({
      run_date: asOf,
      term_deposits_matured: details.matured_deposits.length,
      loans_marked_defaulted: details.newly_defaulted_loans.length,
      errors_count: details.matured_errors.length,
      status: details.matured_errors.length > 0 ? "completed_with_errors" : "completed",
      details: details as unknown as Record<string, unknown>,
    });
  },

  async history(limit: number, offset: number) {
    return cobRunRepository.list(limit, offset);
  },

  async getById(id: number): Promise<CobRun> {
    const run = await cobRunRepository.findById(id);
    if (!run) throw Errors.notFound("cob_run", id);
    return run;
  },
};
