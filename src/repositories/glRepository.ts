import { pool, Executor } from "../db/pool";
import { GlAccount, GlEntry, GlPostingRule, TrialBalanceRow } from "../types/domain";

export const glRepository = {
  async listAccounts(): Promise<GlAccount[]> {
    const { rows } = await pool.query<GlAccount>(`SELECT * FROM gl_accounts ORDER BY code`);
    return rows;
  },

  async findAccountByCode(code: string, exec: Executor = pool): Promise<GlAccount | null> {
    const { rows } = await exec.query<GlAccount>(`SELECT * FROM gl_accounts WHERE code = :code`, { code });
    return rows[0] ?? null;
  },

  async findRuleByTxnType(txnType: string, exec: Executor = pool): Promise<GlPostingRule | null> {
    const { rows } = await exec.query<GlPostingRule>(
      `SELECT * FROM gl_posting_rules WHERE txn_type = :txnType`,
      { txnType }
    );
    return rows[0] ?? null;
  },

  /**
   * Hạch toán 1 bút toán sổ cái gồm N dòng Nợ/Có cho 1 transaction — đây là
   * điểm duy nhất tạo gl_entries. Bắt buộc SUM(debit) == SUM(credit) trước khi
   * ghi (bất biến kế toán kép); vỡ bất biến này ném lỗi ngay, không ghi nửa vời.
   */
  async postJournal(
    lines: { accountCode: string; side: "debit" | "credit"; amount: string }[],
    meta: { transactionId: number; entryDate: string; description: string | null },
    exec: Executor
  ): Promise<GlEntry[]> {
    const totalDebit = lines.filter((l) => l.side === "debit").reduce((s, l) => s + Number(l.amount), 0);
    const totalCredit = lines.filter((l) => l.side === "credit").reduce((s, l) => s + Number(l.amount), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.005) {
      throw new Error(
        `Bút toán GL không cân bằng cho transaction ${meta.transactionId}: Nợ ${totalDebit} != Có ${totalCredit}`
      );
    }

    const results: GlEntry[] = [];
    for (const line of lines) {
      const account = await this.findAccountByCode(line.accountCode, exec);
      if (!account) throw new Error(`GL account '${line.accountCode}' không tồn tại`);
      const { rows } = await exec.query<GlEntry>(
        `INSERT INTO gl_entries (transaction_id, gl_account_id, entry_side, amount, entry_date, description)
         VALUES (:transactionId, :glAccountId, :side, :amount, :entryDate, :description)
         RETURNING *`,
        {
          transactionId: meta.transactionId,
          glAccountId: account.gl_account_id,
          side: line.side,
          amount: line.amount,
          entryDate: meta.entryDate,
          description: meta.description,
        }
      );
      results.push(rows[0]);
    }
    return results;
  },

  /** Tiện ích cho trường hợp phổ biến nhất: đúng 1 cặp Nợ/Có cùng amount. */
  async postEntryPair(
    input: {
      debitAccountCode: string;
      creditAccountCode: string;
      amount: string;
      transactionId: number;
      entryDate: string;
      description: string | null;
    },
    exec: Executor
  ): Promise<GlEntry[]> {
    return this.postJournal(
      [
        { accountCode: input.debitAccountCode, side: "debit", amount: input.amount },
        { accountCode: input.creditAccountCode, side: "credit", amount: input.amount },
      ],
      { transactionId: input.transactionId, entryDate: input.entryDate, description: input.description },
      exec
    );
  },

  /** Bảng cân đối thử (Trial Balance) — kiểm tra bất biến kế toán kép toàn hệ thống. */
  async trialBalance(): Promise<TrialBalanceRow[]> {
    const { rows } = await pool.query<TrialBalanceRow>(
      `SELECT
         a.code, a.name, a.account_class, a.normal_balance,
         COALESCE(SUM(CASE WHEN e.entry_side = 'debit' THEN e.amount ELSE 0 END), 0) AS total_debit,
         COALESCE(SUM(CASE WHEN e.entry_side = 'credit' THEN e.amount ELSE 0 END), 0) AS total_credit,
         COALESCE(SUM(CASE
           WHEN a.normal_balance = 'debit' AND e.entry_side = 'debit' THEN e.amount
           WHEN a.normal_balance = 'debit' AND e.entry_side = 'credit' THEN -e.amount
           WHEN a.normal_balance = 'credit' AND e.entry_side = 'credit' THEN e.amount
           WHEN a.normal_balance = 'credit' AND e.entry_side = 'debit' THEN -e.amount
         END), 0) AS balance
       FROM gl_accounts a
       LEFT JOIN gl_entries e ON e.gl_account_id = a.gl_account_id
       GROUP BY a.gl_account_id, a.code, a.name, a.account_class, a.normal_balance
       ORDER BY a.code`
    );
    return rows;
  },

  async entriesByAccountCode(code: string, limit: number, offset: number) {
    const { rows } = await pool.query<GlEntry & { account_code: string; account_name: string }>(
      `SELECT e.*, a.code AS account_code, a.name AS account_name
       FROM gl_entries e
       JOIN gl_accounts a ON a.gl_account_id = e.gl_account_id
       WHERE a.code = :code
       ORDER BY e.gl_entry_id DESC LIMIT :limit OFFSET :offset`,
      { code, limit, offset }
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM gl_entries e JOIN gl_accounts a ON a.gl_account_id = e.gl_account_id WHERE a.code = :code`,
      { code }
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async entriesByTransaction(transactionId: number): Promise<(GlEntry & { account_code: string; account_name: string })[]> {
    const { rows } = await pool.query<GlEntry & { account_code: string; account_name: string }>(
      `SELECT e.*, a.code AS account_code, a.name AS account_name
       FROM gl_entries e
       JOIN gl_accounts a ON a.gl_account_id = e.gl_account_id
       WHERE e.transaction_id = :transactionId
       ORDER BY e.gl_entry_id`,
      { transactionId }
    );
    return rows;
  },
};
