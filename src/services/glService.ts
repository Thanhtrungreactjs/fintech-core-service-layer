import { Executor } from "../db/pool";
import { glRepository } from "../repositories/glRepository";
import { Transaction } from "../types/domain";
import { Errors } from "../utils/errors";
import { Pagination, toLimitOffset } from "../utils/pagination";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const glService = {
  async listAccounts() {
    return glRepository.listAccounts();
  },

  /** Bảng cân đối thử — SUM(total_debit) toàn hệ thống luôn phải = SUM(total_credit). */
  async trialBalance() {
    const rows = await glRepository.trialBalance();
    const totalDebit = rows.reduce((s, r) => s + Number(r.total_debit), 0);
    const totalCredit = rows.reduce((s, r) => s + Number(r.total_credit), 0);
    return {
      accounts: rows,
      total_debit: totalDebit.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      balanced: Math.abs(totalDebit - totalCredit) < 0.005,
    };
  },

  async accountLedger(code: string, pagination: Pagination) {
    const account = await glRepository.findAccountByCode(code);
    if (!account) throw Errors.notFound("gl_account", code);
    const { limit, offset } = toLimitOffset(pagination);
    return glRepository.entriesByAccountCode(code, limit, offset);
  },

  async transactionEntries(transactionId: number) {
    return glRepository.entriesByTransaction(transactionId);
  },

  /**
   * Hạch toán tự động theo txn_type cho các giao dịch tài khoản thông thường
   * (deposit/withdrawal/transfer/payment/fee/interest ngoài phạm vi tiền gửi
   * có kỳ hạn). Dùng invert=true khi hạch toán cho 1 giao dịch ĐẢO NGƯỢC
   * (transactionService.reverse) — vì bản ghi transactions của lần đảo mang
   * cùng txn_type với bản gốc (chỉ đổi dấu balance qua effect ngược), nên
   * bút toán GL cũng phải đảo Nợ/Có so với quy tắc mặc định để triệt tiêu
   * đúng ảnh hưởng gốc, không phải lặp lại y hệt.
   */
  async postByTxnType(txn: Transaction, exec: Executor, opts?: { invert?: boolean }): Promise<void> {
    const rule = await glRepository.findRuleByTxnType(txn.txn_type, exec);
    if (!rule) {
      throw Errors.business(
        "GL_RULE_MISSING",
        `Chưa có quy tắc hạch toán GL cho txn_type '${txn.txn_type}' — kiểm tra bảng gl_posting_rules`
      );
    }
    const [debitCode, creditCode] = opts?.invert
      ? [rule.credit_account_code, rule.debit_account_code]
      : [rule.debit_account_code, rule.credit_account_code];

    await glRepository.postEntryPair(
      {
        debitAccountCode: debitCode,
        creditAccountCode: creditCode,
        amount: txn.amount,
        transactionId: txn.transaction_id,
        entryDate: txn.txn_timestamp.slice(0, 10),
        description: txn.description,
      },
      exec
    );
  },

  /** Hạch toán tường minh 1 cặp Nợ/Có (dùng cho nghiệp vụ có quy tắc riêng, vd tiền gửi có kỳ hạn). */
  async postExplicit(
    debitAccountCode: string,
    creditAccountCode: string,
    amount: string,
    transactionId: number,
    exec: Executor,
    description?: string | null,
    entryDate?: string
  ): Promise<void> {
    await glRepository.postEntryPair(
      {
        debitAccountCode,
        creditAccountCode,
        amount,
        transactionId,
        entryDate: entryDate ?? todayISO(),
        description: description ?? null,
      },
      exec
    );
  },

  /**
   * Hạch toán tường minh nhiều dòng (vd tách gốc/lãi trong 1 lần tất toán sổ
   * tiết kiệm: Nợ Tiền gửi có kỳ hạn (gốc) + Nợ Chi phí lãi (lãi) / Có Tiền
   * gửi thanh toán (gốc+lãi)). glRepository.postJournal tự kiểm tra cân bằng.
   */
  async postExplicitJournal(
    lines: { accountCode: string; side: "debit" | "credit"; amount: string }[],
    transactionId: number,
    exec: Executor,
    description?: string | null,
    entryDate?: string
  ): Promise<void> {
    await glRepository.postJournal(
      lines,
      { transactionId, entryDate: entryDate ?? todayISO(), description: description ?? null },
      exec
    );
  },
};
