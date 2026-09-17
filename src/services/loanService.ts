import { withTransaction, Executor } from "../db/pool";
import { loanRepository } from "../repositories/loanRepository";
import { loanPaymentRepository } from "../repositories/loanPaymentRepository";
import { accountRepository } from "../repositories/accountRepository";
import { transactionRepository } from "../repositories/transactionRepository";
import { transactionCategoryRepository } from "../repositories/transactionCategoryRepository";
import { customerService } from "./customerService";
import { glService } from "./glService";
import { buildAmortizationSchedule } from "./amortization";
import { Loan, LoanPayment } from "../types/domain";
import { Errors } from "../utils/errors";

export interface CreateLoanRequest {
  account_id: number;
  loan_type?: string | null;
  principal_amount: string;
  interest_rate: string;
  term_months: number;
  disbursed_date: string;
}

async function categoryIdByName(name: string, exec: Executor): Promise<number> {
  const category = await transactionCategoryRepository.findByName(name, exec);
  if (!category) {
    throw Errors.business(
      "CATEGORY_MISSING",
      `Danh mục giao dịch '${name}' chưa tồn tại — kiểm tra lại seed transaction_categories`
    );
  }
  return category.category_id;
}

export const loanService = {
  /**
   * Tạo khoản vay, tự sinh lịch trả góp N kỳ, VÀ giải ngân thật vào account_id
   * (cộng balance + ghi transaction + hạch toán GL Nợ 1100 Dư nợ cho vay / Có
   * 2000 Tiền gửi thanh toán — tiền vay không "từ trên trời rơi xuống" mà là
   * ngân hàng ghi nhận 1 tài sản mới (khoản phải thu) đổi lấy nghĩa vụ trả
   * ngay cho khách hàng qua tài khoản của họ).
   */
  async create(customerId: number, input: CreateLoanRequest): Promise<Loan> {
    await customerService.getById(customerId);

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

    return withTransaction(async (conn) => {
      const account = await accountRepository.findByIdForUpdate(input.account_id, conn);
      if (!account) throw Errors.notFound("account", input.account_id);
      if (account.customer_id !== customerId) {
        throw Errors.validation(`Tài khoản ${input.account_id} không thuộc khách hàng ${customerId}`);
      }
      if (account.status !== "active") {
        throw Errors.business(
          "ACCOUNT_NOT_ACTIVE",
          `Tài khoản ${input.account_id} không ở trạng thái active`
        );
      }

      const loan = await loanRepository.create(
        {
          customer_id: customerId,
          account_id: input.account_id,
          loan_type: input.loan_type ?? null,
          principal_amount: input.principal_amount,
          interest_rate: input.interest_rate,
          term_months: input.term_months,
          disbursed_date: input.disbursed_date,
        },
        conn
      );

      const schedule = buildAmortizationSchedule(principal, rate, input.term_months, input.disbursed_date);
      await loanPaymentRepository.bulkCreate(
        schedule.map((row) => ({ loan_id: loan.loan_id, ...row })),
        conn
      );

      const description = `Giải ngân khoản vay #${loan.loan_id}`;
      const depositCategoryId = await categoryIdByName("Deposit", conn);
      const txn = await transactionRepository.create(
        {
          account_id: input.account_id,
          category_id: depositCategoryId,
          txn_type: "deposit",
          amount: input.principal_amount,
          currency: account.currency,
          description,
        },
        conn
      );
      await accountRepository.adjustBalance(input.account_id, principal.toFixed(2), conn);
      await glService.postExplicit("1100", "2000", input.principal_amount, txn.transaction_id, conn, description, input.disbursed_date);

      return loan;
    });
  },

  async getById(id: number): Promise<Loan> {
    const loan = await loanRepository.findById(id);
    if (!loan) throw Errors.notFound("loan", id);
    return loan;
  },

  async listPayments(loanId: number): Promise<LoanPayment[]> {
    await this.getById(loanId);
    return loanPaymentRepository.findByLoan(loanId);
  },

  /**
   * Ghi nhận thanh toán 1 kỳ — trừ tiền thật từ account_id của loan, tách
   * bút toán GL theo đúng cấu phần gốc/lãi (Nợ 2000 tổng số tiền / Có 1100
   * phần gốc + Có 4000 phần lãi), đúng bản chất kế toán: trả gốc là giảm
   * khoản phải thu, trả lãi là ghi nhận thu nhập — không thể gộp chung.
   */
  async payInstallment(
    loanId: number,
    paymentId: number,
    amountPaid: string,
    paidDate: string
  ): Promise<LoanPayment> {
    const amount = Number(amountPaid);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Errors.validation("amount_paid phải là số dương");
    }

    return withTransaction(async (conn) => {
      const loan = await loanRepository.findByIdForUpdate(loanId, conn);
      if (!loan) throw Errors.notFound("loan", loanId);
      if (loan.status !== "active") {
        throw Errors.business("LOAN_NOT_ACTIVE", `Khoản vay ${loanId} không ở trạng thái active`);
      }
      if (!loan.account_id) {
        throw Errors.business(
          "LOAN_ACCOUNT_MISSING",
          `Khoản vay ${loanId} chưa gắn tài khoản trả góp (khoản vay tạo trước khi có module này)`
        );
      }

      const payment = await loanPaymentRepository.findByIdForUpdate(paymentId, conn);
      if (!payment || payment.loan_id !== loanId) {
        throw Errors.notFound("loan_payment", paymentId);
      }
      if (payment.paid_date) {
        throw Errors.business(
          "LOAN_PAYMENT_ALREADY_PAID",
          `Kỳ trả góp ${paymentId} đã được thanh toán`
        );
      }

      const account = await accountRepository.findByIdForUpdate(loan.account_id, conn);
      if (!account) throw Errors.notFound("account", loan.account_id);
      if (account.status !== "active") {
        throw Errors.business(
          "ACCOUNT_NOT_ACTIVE",
          `Tài khoản ${loan.account_id} không ở trạng thái active`
        );
      }
      if (Number(account.balance) < amount) {
        throw Errors.business(
          "INSUFFICIENT_BALANCE",
          `Tài khoản ${loan.account_id} không đủ số dư để trả góp ${amount}`
        );
      }

      const description = `Trả góp khoản vay #${loanId} kỳ ${payment.installment_no}`;
      const withdrawalCategoryId = await categoryIdByName("Withdrawal", conn);
      const txn = await transactionRepository.create(
        {
          account_id: loan.account_id,
          category_id: withdrawalCategoryId,
          txn_type: "payment",
          amount: amountPaid,
          currency: account.currency,
          description,
        },
        conn
      );
      await accountRepository.adjustBalance(loan.account_id, (-amount).toFixed(2), conn);

      // Phân bổ số tiền trả thực tế theo tỉ lệ gốc/lãi đã lên lịch cho kỳ này (trả đúng
      // amount_due thì khớp luôn principal_component/interest_component; trả khác đi vẫn
      // giữ tỉ lệ tương ứng để bút toán GL luôn cân bằng đúng amountPaid thực nhận).
      const amountDue = Number(payment.amount_due);
      const principalComponent = Number(
        (amountDue > 0 ? (Number(payment.principal_component) / amountDue) * amount : amount).toFixed(2)
      );
      // Lấy phần dư đúng bằng amount - principalComponent (đã làm tròn) thay vì tính riêng
      // rồi làm tròn lần nữa — đảm bảo Nợ 2000 luôn khớp tuyệt đối tổng 2 dòng Có bên dưới.
      const interestComponent = Number((amount - principalComponent).toFixed(2));

      const glLines: { accountCode: string; side: "debit" | "credit"; amount: string }[] = [
        { accountCode: "2000", side: "debit", amount: amount.toFixed(2) },
        { accountCode: "1100", side: "credit", amount: principalComponent.toFixed(2) },
      ];
      if (interestComponent > 0) {
        glLines.push({ accountCode: "4000", side: "credit", amount: interestComponent.toFixed(2) });
      }
      await glService.postExplicitJournal(glLines, txn.transaction_id, conn, description, paidDate);

      await loanPaymentRepository.markPaid(paymentId, paidDate, amountPaid, txn.transaction_id, conn);

      const allPayments = await loanPaymentRepository.findByLoan(loanId);
      const stillUnpaid = allPayments.some(
        (p) => p.payment_id !== paymentId && !p.paid_date
      );
      if (!stillUnpaid) {
        await loanRepository.updateStatus(loanId, "closed", conn);
      }

      const updated = await loanPaymentRepository.findById(paymentId, conn);
      if (!updated) throw new Error("Failed to load loan_payment after update");
      return updated;
    });
  },
};
