import { withTransaction, Executor } from "../db/pool";
import { accountRepository } from "../repositories/accountRepository";
import { customerService } from "./customerService";
import { transactionRepository } from "../repositories/transactionRepository";
import { termDepositRepository } from "../repositories/termDepositRepository";
import { glService } from "./glService";
import {
  daysBetween,
  addMonthsISO,
  simpleInterest,
  compoundInterestFullTerm,
  earlyWithdrawalInterest,
} from "./termDepositMath";
import {
  TermDeposit,
  TermDepositPosting,
  InterestMethod,
  TdPayoutMethod,
  DayCountConvention,
} from "../types/domain";
import { Errors } from "../utils/errors";
import { Pagination, toLimitOffset } from "../utils/pagination";

const todayISO = () => new Date().toISOString().slice(0, 10);

async function categoryIdByName(name: string, exec: Executor): Promise<number> {
  const { rows } = await exec.query<{ category_id: number }>(
    `SELECT category_id FROM transaction_categories WHERE category_name = :name`,
    { name }
  );
  if (!rows[0]) {
    throw Errors.business(
      "CATEGORY_MISSING",
      `Danh mục giao dịch '${name}' chưa tồn tại — chạy db/migrations/002_term_deposits.sql`
    );
  }
  return rows[0].category_id;
}

export interface OpenTermDepositRequest {
  account_id: number;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  interest_method?: InterestMethod;
  payout_method?: TdPayoutMethod;
  day_count_convention?: DayCountConvention;
  early_withdrawal_rate?: string;
  auto_renewal?: boolean;
  start_date?: string;
}

export const termDepositService = {
  /** Mở sổ tiết kiệm: trích nộp principal_amount từ account (ghi 1 transaction 'withdrawal'). */
  async open(input: OpenTermDepositRequest): Promise<TermDeposit> {
    const principal = Number(input.principal_amount);
    const rate = Number(input.interest_rate);
    if (!Number.isFinite(principal) || principal <= 0) {
      throw Errors.validation("principal_amount phải là số dương");
    }
    if (!Number.isFinite(rate) || rate < 0) {
      throw Errors.validation("interest_rate không được âm");
    }
    if (!Number.isInteger(input.term_months) || input.term_months <= 0) {
      throw Errors.validation("term_months phải là số nguyên dương");
    }

    const startDate = input.start_date ?? todayISO();
    const maturityDate = addMonthsISO(startDate, input.term_months);
    const payoutMethod = input.payout_method ?? "maturity";
    // Sổ trả lãi hàng tháng luôn dùng lãi đơn theo từng kỳ — không có khái niệm
    // "lãi kép" khi lãi đã được chi trả ra ngoài (không còn nhập gốc) mỗi tháng.
    const interestMethod: InterestMethod =
      payoutMethod === "monthly" ? "simple" : input.interest_method ?? "simple";

    return withTransaction(async (conn) => {
      const account = await accountRepository.findByIdForUpdate(input.account_id, conn);
      if (!account) throw Errors.notFound("account", input.account_id);
      if (account.status !== "active") {
        throw Errors.business(
          "ACCOUNT_NOT_ACTIVE",
          `Tài khoản ${input.account_id} không ở trạng thái active`
        );
      }
      if (Number(account.balance) < principal) {
        throw Errors.business(
          "INSUFFICIENT_BALANCE",
          `Tài khoản ${input.account_id} không đủ số dư để mở sổ tiết kiệm ${principal}`
        );
      }

      const withdrawalCategoryId = await categoryIdByName("Withdrawal", conn);
      const description = `Mở sổ tiết kiệm kỳ hạn ${input.term_months} tháng`;
      const txn = await transactionRepository.create(
        {
          account_id: input.account_id,
          category_id: withdrawalCategoryId,
          txn_type: "withdrawal",
          amount: input.principal_amount,
          currency: account.currency,
          description,
        },
        conn
      );
      await accountRepository.adjustBalance(input.account_id, (-principal).toFixed(2), conn);
      // Mở sổ = chuyển loại tiền gửi (thanh toán -> có kỳ hạn), không phải rút tiền mặt
      // khỏi ngân hàng — hạch toán Nợ 2000 (Tiền gửi thanh toán) / Có 2100 (Tiền gửi có
      // kỳ hạn), khác với quy tắc "withdrawal" mặc định (Nợ 2000 / Có 1000 Tiền mặt).
      await glService.postExplicit("2000", "2100", input.principal_amount, txn.transaction_id, conn, description, startDate);

      return termDepositRepository.create(
        {
          account_id: input.account_id,
          principal_amount: input.principal_amount,
          interest_rate: input.interest_rate,
          term_months: input.term_months,
          interest_method: interestMethod,
          payout_method: payoutMethod,
          day_count_convention: input.day_count_convention ?? "actual_365",
          early_withdrawal_rate: input.early_withdrawal_rate ?? "0.20",
          auto_renewal: input.auto_renewal ?? false,
          start_date: startDate,
          maturity_date: maturityDate,
        },
        conn
      );
    });
  },

  async getById(id: number): Promise<TermDeposit> {
    const deposit = await termDepositRepository.findById(id);
    if (!deposit) throw Errors.notFound("term_deposit", id);
    return deposit;
  },

  async listByAccount(accountId: number, pagination: Pagination) {
    const account = await accountRepository.findById(accountId);
    if (!account) throw Errors.notFound("account", accountId);
    const { limit, offset } = toLimitOffset(pagination);
    return termDepositRepository.findByAccount(accountId, limit, offset);
  },

  async listByCustomer(customerId: number, pagination: Pagination) {
    await customerService.getById(customerId);
    const { limit, offset } = toLimitOffset(pagination);
    return termDepositRepository.findByCustomer(customerId, limit, offset);
  },

  async listPostings(id: number): Promise<TermDepositPosting[]> {
    await this.getById(id);
    return termDepositRepository.findPostings(id);
  },

  /**
   * Lãi dự thu tính đến hôm nay (accrual) — CHỈ để tham khảo, không ghi sổ / không
   * ảnh hưởng balance. Đây là khái niệm "lãi đã phát sinh nhưng chưa hạch toán"
   * chuẩn kế toán ngân hàng: khác với lãi thực nhận khi rút trước hạn (bị phạt).
   */
  async accruedInterestToDate(
    id: number
  ): Promise<{ as_of: string; days_elapsed: number; accrued_interest: string }> {
    const d = await this.getById(id);
    if (d.status !== "active") {
      return { as_of: d.closed_date ?? todayISO(), days_elapsed: 0, accrued_interest: "0.00" };
    }
    const asOf = todayISO() < d.maturity_date ? todayISO() : d.maturity_date;
    const days = Math.max(0, daysBetween(d.start_date, asOf));
    const principal = Number(d.principal_amount);
    const rate = Number(d.interest_rate);

    let interest: number;
    if (d.interest_method === "compound") {
      // Xấp xỉ lãi kép dự thu bằng nội suy tuyến tính trên tổng lãi kép cả kỳ theo
      // tỉ lệ số ngày đã trôi qua (đủ dùng để hiển thị tham khảo, không dùng để hạch toán).
      const fullTermDays = daysBetween(d.start_date, d.maturity_date);
      const fullTermInterest = compoundInterestFullTerm(principal, rate, d.term_months);
      interest = fullTermDays > 0 ? (fullTermInterest * days) / fullTermDays : 0;
    } else {
      interest = simpleInterest(principal, rate, days, d.day_count_convention);
    }
    return { as_of: asOf, days_elapsed: days, accrued_interest: interest.toFixed(2) };
  },

  /** Ghi nhận + chi trả lãi 1 kỳ cho sổ trả lãi hàng tháng (payout_method='monthly'). */
  async postMonthlyInterest(id: number, valueDate?: string): Promise<TermDepositPosting> {
    return withTransaction(async (conn) => {
      const deposit = await termDepositRepository.findByIdForUpdate(id, conn);
      if (!deposit) throw Errors.notFound("term_deposit", id);
      if (deposit.status !== "active") {
        throw Errors.business("TERM_DEPOSIT_NOT_ACTIVE", `Sổ tiết kiệm ${id} không ở trạng thái active`);
      }
      if (deposit.payout_method !== "monthly") {
        throw Errors.business(
          "TERM_DEPOSIT_NOT_MONTHLY_PAYOUT",
          `Sổ tiết kiệm ${id} không dùng phương thức trả lãi hàng tháng`
        );
      }
      const asOf = valueDate ?? todayISO();
      if (asOf > deposit.maturity_date) {
        throw Errors.business(
          "TERM_DEPOSIT_PAST_MATURITY",
          `Sổ tiết kiệm ${id} đã quá hạn (${deposit.maturity_date}) — xử lý đáo hạn thay vì ghi lãi tháng`
        );
      }

      const lastTo = (await termDepositRepository.lastPostingPeriodTo(id, conn)) ?? deposit.start_date;
      const days = daysBetween(lastTo, asOf);
      if (days <= 0) {
        throw Errors.business(
          "TERM_DEPOSIT_NO_ACCRUAL",
          `Chưa phát sinh ngày lãi mới kể từ lần ghi nhận trước (${lastTo})`
        );
      }

      const interest = simpleInterest(
        Number(deposit.principal_amount),
        Number(deposit.interest_rate),
        days,
        deposit.day_count_convention
      );
      const interestStr = interest.toFixed(2);

      const account = await accountRepository.findByIdForUpdate(deposit.account_id, conn);
      if (!account) throw Errors.notFound("account", deposit.account_id);

      const interestCategoryId = await categoryIdByName("Interest", conn);
      const txn = await transactionRepository.create(
        {
          account_id: deposit.account_id,
          category_id: interestCategoryId,
          txn_type: "interest",
          amount: interestStr,
          currency: account.currency,
          description: `Trả lãi tháng sổ tiết kiệm #${id} (${days} ngày)`,
        },
        conn
      );
      await accountRepository.adjustBalance(deposit.account_id, interestStr, conn);
      await glService.postExplicit("5000", "2000", interestStr, txn.transaction_id, conn, txn.description, asOf);

      return termDepositRepository.addPosting(
        {
          term_deposit_id: id,
          posting_type: "monthly_payout",
          period_from: lastTo,
          period_to: asOf,
          days,
          interest_amount: interestStr,
          transaction_id: txn.transaction_id,
        },
        conn
      );
    });
  },

  /**
   * Rút trước hạn (case khó #1): dù chỉ còn 1 ngày là đáo hạn, sổ KHÔNG được hưởng
   * lãi suất có kỳ hạn đã cam kết — chỉ được tính lãi đơn ở mức lãi suất không kỳ hạn
   * (early_withdrawal_rate) trên đúng số ngày thực gửi. Nếu là sổ trả lãi hàng tháng,
   * các kỳ lãi đã trả trước đó khách vẫn được giữ nguyên (không truy thu).
   */
  async withdrawEarly(
    id: number,
    withdrawDate?: string
  ): Promise<{ deposit: TermDeposit; posting: TermDepositPosting }> {
    return withTransaction(async (conn) => {
      const deposit = await termDepositRepository.findByIdForUpdate(id, conn);
      if (!deposit) throw Errors.notFound("term_deposit", id);
      if (deposit.status !== "active") {
        throw Errors.business("TERM_DEPOSIT_NOT_ACTIVE", `Sổ tiết kiệm ${id} không ở trạng thái active`);
      }
      const asOf = withdrawDate ?? todayISO();
      if (asOf >= deposit.maturity_date) {
        throw Errors.business(
          "TERM_DEPOSIT_ALREADY_MATURE",
          `Sổ tiết kiệm ${id} đã đến/qua hạn (${deposit.maturity_date}) — dùng xử lý đáo hạn thay vì rút trước hạn`
        );
      }
      const elapsedDays = daysBetween(deposit.start_date, asOf);
      if (elapsedDays <= 0) {
        throw Errors.business("TERM_DEPOSIT_TOO_EARLY", `Chưa đủ 1 ngày kể từ ngày mở sổ (${deposit.start_date})`);
      }

      const interest = earlyWithdrawalInterest(
        Number(deposit.principal_amount),
        Number(deposit.early_withdrawal_rate),
        elapsedDays,
        deposit.day_count_convention
      );
      const principal = Number(deposit.principal_amount);
      const payout = (principal + interest).toFixed(2);

      const account = await accountRepository.findByIdForUpdate(deposit.account_id, conn);
      if (!account) throw Errors.notFound("account", deposit.account_id);

      const depositCategoryId = await categoryIdByName("Deposit", conn);
      const txn = await transactionRepository.create(
        {
          account_id: deposit.account_id,
          category_id: depositCategoryId,
          txn_type: "deposit",
          amount: payout,
          currency: account.currency,
          description: `Tất toán trước hạn sổ tiết kiệm #${id} (lãi không kỳ hạn, ${elapsedDays} ngày)`,
        },
        conn
      );
      await accountRepository.adjustBalance(deposit.account_id, payout, conn);
      await termDepositRepository.updateStatus(id, "withdrawn", asOf, conn);

      // Tách rõ 2 cấu phần trong bút toán GL: Nợ 2100 (hoàn gốc, tất toán khoản tiền gửi
      // có kỳ hạn) + Nợ 5000 (chi phí lãi không kỳ hạn phát sinh) / Có 2000 (tổng tiền trả
      // vào tài khoản thanh toán) — không gộp chung vì bản chất kế toán khác nhau (gốc là
      // hoàn trả nợ phải trả, lãi là chi phí phát sinh trong kỳ).
      const glLines: { accountCode: string; side: "debit" | "credit"; amount: string }[] = [
        { accountCode: "2100", side: "debit", amount: deposit.principal_amount },
      ];
      if (interest > 0) glLines.push({ accountCode: "5000", side: "debit", amount: interest.toFixed(2) });
      glLines.push({ accountCode: "2000", side: "credit", amount: payout });
      await glService.postExplicitJournal(glLines, txn.transaction_id, conn, txn.description, asOf);

      const posting = await termDepositRepository.addPosting(
        {
          term_deposit_id: id,
          posting_type: "early_withdrawal_settlement",
          period_from: deposit.start_date,
          period_to: asOf,
          days: elapsedDays,
          interest_amount: interest.toFixed(2),
          transaction_id: txn.transaction_id,
        },
        conn
      );

      const updated = await termDepositRepository.findById(id, conn);
      return { deposit: updated!, posting };
    });
  },

  /**
   * Xử lý đáo hạn (case khó #2): tính lãi trọn kỳ theo phương pháp đã đăng ký
   * (đơn hoặc kép), rồi:
   *  - auto_renewal=true: tái tục — mở sổ mới với gốc = gốc cũ + lãi vừa tính
   *    ("quay vòng gốc + lãi", không đi qua balance tài khoản), sổ cũ chuyển
   *    'matured' và liên kết renewed_from_id sang sổ mới.
   *  - auto_renewal=false: tất toán — cộng gốc + lãi vào tài khoản, đóng sổ.
   * Với sổ trả lãi hàng tháng, lãi trọn kỳ ở bước này chỉ tính phần CÒN LẠI kể
   * từ lần trả lãi gần nhất tới ngày đáo hạn (các kỳ trước đã trả rồi).
   */
  async mature(
    id: number,
    valueDate?: string
  ): Promise<{ deposit: TermDeposit; posting: TermDepositPosting; renewed: TermDeposit | null }> {
    return withTransaction(async (conn) => {
      const deposit = await termDepositRepository.findByIdForUpdate(id, conn);
      if (!deposit) throw Errors.notFound("term_deposit", id);
      if (deposit.status !== "active") {
        throw Errors.business("TERM_DEPOSIT_NOT_ACTIVE", `Sổ tiết kiệm ${id} không ở trạng thái active`);
      }
      const asOf = valueDate ?? todayISO();
      if (asOf < deposit.maturity_date) {
        throw Errors.business(
          "TERM_DEPOSIT_NOT_MATURE",
          `Sổ tiết kiệm ${id} chưa đến hạn (đáo hạn ${deposit.maturity_date})`
        );
      }

      const principal = Number(deposit.principal_amount);
      const rate = Number(deposit.interest_rate);
      const lastTo = (await termDepositRepository.lastPostingPeriodTo(id, conn)) ?? deposit.start_date;

      let interest: number;
      let periodFrom: string;
      if (deposit.payout_method === "monthly") {
        const days = daysBetween(lastTo, deposit.maturity_date);
        interest = simpleInterest(principal, rate, days, deposit.day_count_convention);
        periodFrom = lastTo;
      } else if (deposit.interest_method === "compound") {
        interest = compoundInterestFullTerm(principal, rate, deposit.term_months);
        periodFrom = deposit.start_date;
      } else {
        const days = daysBetween(deposit.start_date, deposit.maturity_date);
        interest = simpleInterest(principal, rate, days, deposit.day_count_convention);
        periodFrom = deposit.start_date;
      }
      const interestStr = interest.toFixed(2);

      const account = await accountRepository.findByIdForUpdate(deposit.account_id, conn);
      if (!account) throw Errors.notFound("account", deposit.account_id);

      let renewed: TermDeposit | null = null;
      let txnAmount: string;
      let txnType: "deposit" | "interest";
      let categoryName: string;
      let description: string;

      if (deposit.auto_renewal) {
        const newPrincipal = (principal + interest).toFixed(2);
        renewed = await termDepositRepository.create(
          {
            account_id: deposit.account_id,
            principal_amount: newPrincipal,
            interest_rate: deposit.interest_rate,
            term_months: deposit.term_months,
            interest_method: deposit.interest_method,
            payout_method: deposit.payout_method,
            day_count_convention: deposit.day_count_convention,
            early_withdrawal_rate: deposit.early_withdrawal_rate,
            auto_renewal: deposit.auto_renewal,
            start_date: deposit.maturity_date,
            maturity_date: addMonthsISO(deposit.maturity_date, deposit.term_months),
            renewed_from_id: deposit.term_deposit_id,
          },
          conn
        );
        // Ghi nhận transaction loại 'interest' để có dấu vết lãi phát sinh, nhưng KHÔNG
        // cộng vào account.balance vì lãi đã nhập thẳng vào gốc của sổ mới.
        categoryName = "Interest";
        txnAmount = interestStr;
        txnType = "interest";
        description = `Lãi đáo hạn nhập gốc, tái tục sổ tiết kiệm #${id} → #${renewed.term_deposit_id}`;
      } else {
        categoryName = "Deposit";
        txnAmount = (principal + interest).toFixed(2);
        txnType = "deposit";
        description = `Tất toán đáo hạn sổ tiết kiệm #${id}`;
      }

      const categoryId = await categoryIdByName(categoryName, conn);
      const txn = await transactionRepository.create(
        {
          account_id: deposit.account_id,
          category_id: categoryId,
          txn_type: txnType,
          amount: txnAmount,
          currency: account.currency,
          description,
        },
        conn
      );
      if (deposit.auto_renewal) {
        // Tái tục: lãi nhập thẳng vào gốc sổ mới, không qua tài khoản thanh toán —
        // Nợ 5000 (chi phí lãi phát sinh) / Có 2100 (dư nợ phải trả tăng thêm đúng
        // bằng phần lãi vừa nhập gốc). Nếu lãi = 0 (vd term_months quá ngắn) thì
        // không có gì để hạch toán, bỏ qua.
        if (interest > 0) {
          await glService.postExplicit("5000", "2100", interestStr, txn.transaction_id, conn, description, asOf);
        }
      } else {
        await accountRepository.adjustBalance(deposit.account_id, txnAmount, conn);
        // Tất toán: tách Nợ 2100 (hoàn gốc) + Nợ 5000 (chi phí lãi) / Có 2000 (tổng
        // tiền trả vào tài khoản thanh toán) — cùng cấu trúc với rút trước hạn.
        const glLines: { accountCode: string; side: "debit" | "credit"; amount: string }[] = [
          { accountCode: "2100", side: "debit", amount: deposit.principal_amount },
        ];
        if (interest > 0) glLines.push({ accountCode: "5000", side: "debit", amount: interestStr });
        glLines.push({ accountCode: "2000", side: "credit", amount: txnAmount });
        await glService.postExplicitJournal(glLines, txn.transaction_id, conn, description, asOf);
      }

      await termDepositRepository.updateStatus(id, "matured", asOf, conn);

      const posting = await termDepositRepository.addPosting(
        {
          term_deposit_id: id,
          posting_type: "maturity_settlement",
          period_from: periodFrom,
          period_to: deposit.maturity_date,
          days: daysBetween(periodFrom, deposit.maturity_date),
          interest_amount: interestStr,
          transaction_id: txn.transaction_id,
        },
        conn
      );

      const updated = await termDepositRepository.findById(id, conn);
      return { deposit: updated!, posting, renewed };
    });
  },
};
