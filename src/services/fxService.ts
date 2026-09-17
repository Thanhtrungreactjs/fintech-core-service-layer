import { withTransaction } from "../db/pool";
import { accountRepository } from "../repositories/accountRepository";
import { transactionRepository } from "../repositories/transactionRepository";
import { transactionCategoryRepository } from "../repositories/transactionCategoryRepository";
import { exchangeRateService } from "./exchangeRateService";
import { glService } from "./glService";
import { Transaction } from "../types/domain";
import { Errors } from "../utils/errors";

const BASE_CURRENCY = "VND";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface FxConvertRequest {
  from_account_id: number;
  to_account_id: number;
  from_amount: string;
  rate_date?: string;
}

export interface FxConvertResult {
  from_transaction: Transaction;
  to_transaction: Transaction;
  rate: string;
  to_amount: string;
}

export const fxService = {
  /**
   * Chuyển đổi ngoại tệ giữa 2 tài khoản khác currency, dùng tỷ giá as-of từ bảng
   * exchange_rates (bảng này tồn tại từ schema gốc nhưng chưa từng được dùng thật ở đâu
   * trong service layer trước đây). Đơn giản hoá: sổ cái (gl_entries) chỉ giữ 1 con số
   * cho mỗi bút toán — không có cột currency — nên coi VND là "base/functional currency"
   * của toàn hệ thống; mọi cặp quy đổi PHẢI có 1 chân là VND để GL luôn hạch toán đúng
   * bằng con số VND thực (quy đổi ngoại tệ <-> ngoại tệ trực tiếp không hỗ trợ ở bản demo
   * này — thực tế ngân hàng cũng thường route qua base currency chứ không báo giá chéo
   * trực tiếp cho mọi cặp).
   */
  async convert(input: FxConvertRequest): Promise<FxConvertResult> {
    const fromAmount = Number(input.from_amount);
    if (!Number.isFinite(fromAmount) || fromAmount <= 0) {
      throw Errors.validation("from_amount phải là số dương");
    }
    if (input.from_account_id === input.to_account_id) {
      throw Errors.validation("from_account_id và to_account_id không được trùng nhau");
    }
    const rateDate = input.rate_date ?? todayISO();

    return withTransaction(async (conn) => {
      const fromAccount = await accountRepository.findByIdForUpdate(input.from_account_id, conn);
      if (!fromAccount) throw Errors.notFound("account", input.from_account_id);
      const toAccount = await accountRepository.findByIdForUpdate(input.to_account_id, conn);
      if (!toAccount) throw Errors.notFound("account", input.to_account_id);

      if (fromAccount.status !== "active") {
        throw Errors.business("ACCOUNT_NOT_ACTIVE", `Tài khoản ${input.from_account_id} không ở trạng thái active`);
      }
      if (toAccount.status !== "active") {
        throw Errors.business("ACCOUNT_NOT_ACTIVE", `Tài khoản ${input.to_account_id} không ở trạng thái active`);
      }
      if (fromAccount.currency === toAccount.currency) {
        throw Errors.validation(
          `2 tài khoản cùng tiền tệ (${fromAccount.currency}) — dùng POST /transactions (txn_type='transfer') thay vì FX`
        );
      }
      if (fromAccount.currency !== BASE_CURRENCY && toAccount.currency !== BASE_CURRENCY) {
        throw Errors.validation(
          `Chỉ hỗ trợ quy đổi giữa ${BASE_CURRENCY} và 1 ngoại tệ khác — không hỗ trợ quy đổi trực tiếp ${fromAccount.currency} <-> ${toAccount.currency}`
        );
      }
      if (Number(fromAccount.balance) < fromAmount) {
        throw Errors.business(
          "INSUFFICIENT_BALANCE",
          `Tài khoản ${input.from_account_id} không đủ số dư để quy đổi ${fromAmount} ${fromAccount.currency}`
        );
      }

      const rate = await exchangeRateService.getAsOf(fromAccount.currency, toAccount.currency, rateDate);
      const toAmount = (fromAmount * Number(rate.rate)).toFixed(2);
      // Chân VND (dù là bên from hay to) chính là con số dùng để hạch toán sổ cái.
      const baseAmount = fromAccount.currency === BASE_CURRENCY ? input.from_amount : toAmount;

      const transferCategory = await transactionCategoryRepository.findByName("Transfer", conn);
      if (!transferCategory) {
        throw Errors.business("CATEGORY_MISSING", `Danh mục giao dịch 'Transfer' chưa tồn tại`);
      }

      const description = `Quy đổi ngoại tệ ${fromAccount.currency}->${toAccount.currency} @ ${rate.rate} (tỷ giá ${rate.rate_date})`;

      const fromTxn = await transactionRepository.create(
        {
          account_id: input.from_account_id,
          related_account_id: input.to_account_id,
          category_id: transferCategory.category_id,
          txn_type: "withdrawal",
          amount: input.from_amount,
          currency: fromAccount.currency,
          description,
        },
        conn
      );
      await accountRepository.adjustBalance(input.from_account_id, (-fromAmount).toFixed(2), conn);

      const toTxn = await transactionRepository.create(
        {
          account_id: input.to_account_id,
          related_account_id: input.from_account_id,
          category_id: transferCategory.category_id,
          txn_type: "deposit",
          amount: toAmount,
          currency: toAccount.currency,
          description,
        },
        conn
      );
      await accountRepository.adjustBalance(input.to_account_id, toAmount, conn);

      // Nợ/Có cùng TK 2000 (Tiền gửi thanh toán) — tiền vẫn nằm trong nhóm "khách hàng gửi",
      // chỉ đổi mẫu tiền tệ, không phát sinh tài sản/nợ mới -> net = 0, đúng bản chất kế toán.
      const glTxnId = fromAccount.currency === BASE_CURRENCY ? fromTxn.transaction_id : toTxn.transaction_id;
      await glService.postExplicit("2000", "2000", baseAmount, glTxnId, conn, description, rateDate);

      return { from_transaction: fromTxn, to_transaction: toTxn, rate: rate.rate, to_amount: toAmount };
    });
  },
};
