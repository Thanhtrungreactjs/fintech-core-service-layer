import { withTransaction } from "../db/pool";
import { accountRepository } from "../repositories/accountRepository";
import { cardRepository } from "../repositories/cardRepository";
import { merchantRepository } from "../repositories/merchantRepository";
import { transactionRepository, TransactionFilter } from "../repositories/transactionRepository";
import { transactionCategoryService } from "./transactionCategoryService";
import { fraudAlertService } from "./fraudAlertService";
import { glService } from "./glService";
import { balanceEffect } from "./transactionMath";
import { FraudAlert, Transaction, TxnType } from "../types/domain";
import { Errors } from "../utils/errors";
import { Pagination, toLimitOffset } from "../utils/pagination";

export interface CreateTransactionRequest {
  account_id: number;
  related_account_id?: number | null;
  card_id?: number | null;
  merchant_id?: number | null;
  category_id: number;
  txn_type: TxnType;
  amount: string;
  currency?: string;
  description?: string | null;
}

const DEBIT_LIKE: TxnType[] = ["withdrawal", "transfer"];

export const transactionService = {
  async create(input: CreateTransactionRequest): Promise<Transaction & { fraud_alert: FraudAlert | null }> {
    if (input.txn_type === "transfer") {
      if (!input.related_account_id) {
        throw Errors.validation("related_account_id là bắt buộc khi txn_type = 'transfer'");
      }
      if (input.related_account_id === input.account_id) {
        throw Errors.validation("related_account_id không được trùng account_id");
      }
    } else if (input.related_account_id) {
      throw Errors.validation(`related_account_id không được set khi txn_type = '${input.txn_type}'`);
    }

    await transactionCategoryService.getById(input.category_id);
    if (input.merchant_id !== undefined && input.merchant_id !== null) {
      const merchant = await merchantRepository.findById(input.merchant_id);
      if (!merchant) throw Errors.notFound("merchant", input.merchant_id);
    }
    if (input.card_id !== undefined && input.card_id !== null) {
      const card = await cardRepository.findById(input.card_id);
      if (!card) throw Errors.notFound("card", input.card_id);
      if (card.account_id !== input.account_id) {
        throw Errors.validation(`Card ${input.card_id} không thuộc account ${input.account_id}`);
      }
    }

    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw Errors.validation("amount phải là số dương");
    }

    const created = await withTransaction(async (conn) => {
      const account = await accountRepository.findByIdForUpdate(input.account_id, conn);
      if (!account) throw Errors.notFound("account", input.account_id);
      if (account.status !== "active") {
        throw Errors.business(
          "ACCOUNT_NOT_ACTIVE",
          `Tài khoản ${input.account_id} không ở trạng thái active`
        );
      }

      const relatedAccount = input.related_account_id
        ? await accountRepository.findByIdForUpdate(input.related_account_id, conn)
        : null;
      if (input.related_account_id && !relatedAccount) {
        throw Errors.notFound("account", input.related_account_id);
      }
      if (relatedAccount && relatedAccount.status !== "active") {
        throw Errors.business(
          "ACCOUNT_NOT_ACTIVE",
          `Tài khoản đích ${input.related_account_id} không ở trạng thái active`
        );
      }

      // amount/currency của transactions chỉ có 1 cặp giá trị — nếu currency khai báo khác
      // currency thật của account, balance vẫn bị cộng/trừ y nguyên con số mà KHÔNG quy đổi
      // gì cả (bug im lặng, sai số dư thật). Chặn cứng ở đây; muốn đổi tiền tệ phải qua
      // POST /fx-transfers (dùng đúng bảng exchange_rates, tách rõ 2 khoản tiền 2 bên).
      const txnCurrency = input.currency ?? account.currency;
      if (txnCurrency !== account.currency) {
        throw Errors.validation(
          `currency '${txnCurrency}' không khớp tiền tệ tài khoản ${input.account_id} ('${account.currency}') — dùng POST /fx-transfers để chuyển đổi ngoại tệ`
        );
      }
      if (relatedAccount && relatedAccount.currency !== account.currency) {
        throw Errors.validation(
          `Không thể transfer trực tiếp giữa 2 tài khoản khác tiền tệ (${account.currency} vs ${relatedAccount.currency}) — dùng POST /fx-transfers`
        );
      }

      if (DEBIT_LIKE.includes(input.txn_type) && Number(account.balance) < amount) {
        throw Errors.business(
          "INSUFFICIENT_BALANCE",
          `Tài khoản ${input.account_id} không đủ số dư cho giao dịch ${amount}`
        );
      }

      const txn = await transactionRepository.create(
        {
          account_id: input.account_id,
          related_account_id: input.related_account_id ?? null,
          card_id: input.card_id ?? null,
          merchant_id: input.merchant_id ?? null,
          category_id: input.category_id,
          txn_type: input.txn_type,
          amount: input.amount,
          currency: input.currency ?? account.currency,
          description: input.description ?? null,
        },
        conn
      );

      const effect = balanceEffect(input.txn_type);
      await accountRepository.adjustBalance(
        input.account_id,
        (effect.primary * amount).toFixed(2),
        conn
      );
      if (input.related_account_id) {
        await accountRepository.adjustBalance(
          input.related_account_id,
          (effect.related * amount).toFixed(2),
          conn
        );
      }

      await glService.postByTxnType(txn, conn);

      return txn;
    });

    // Rule-based fraud check chạy ngay sau khi ghi transaction — trả kèm alert (nếu có) trong
    // response để người tạo giao dịch thấy NGAY, thay vì phải tự đoán rồi qua tab khác tra cứu.
    const fraudAlert = await fraudAlertService.evaluateAndFlag(created);
    return { ...created, fraud_alert: fraudAlert };
  },

  async getById(id: number): Promise<Transaction> {
    const txn = await transactionRepository.findById(id);
    if (!txn) throw Errors.notFound("transaction", id);
    return txn;
  },

  async listByAccount(accountId: number, filter: TransactionFilter, pagination: Pagination) {
    const account = await accountRepository.findById(accountId);
    if (!account) throw Errors.notFound("account", accountId);
    const { limit, offset } = toLimitOffset(pagination);
    return transactionRepository.findByAccount(accountId, filter, limit, offset);
  },

  /**
   * Đảo giao dịch: không xoá bản gốc (api-design.md mục "Transactions").
   * Đánh dấu bản gốc status='reversed', ghi thêm 1 transaction mới mang
   * hiệu ứng balance ngược lại để số dư tài khoản được hoàn nguyên.
   */
  async reverse(id: number): Promise<Transaction> {
    return withTransaction(async (conn) => {
      const original = await transactionRepository.findByIdForUpdate(id, conn);
      if (!original) throw Errors.notFound("transaction", id);
      if (original.status !== "completed") {
        throw Errors.business(
          "TRANSACTION_NOT_REVERSIBLE",
          `Giao dịch ${id} ở trạng thái '${original.status}', không thể đảo`
        );
      }

      await accountRepository.findByIdForUpdate(original.account_id, conn);
      if (original.related_account_id) {
        await accountRepository.findByIdForUpdate(original.related_account_id, conn);
      }

      const reversal = await transactionRepository.create(
        {
          account_id: original.account_id,
          related_account_id: original.related_account_id,
          card_id: original.card_id,
          merchant_id: original.merchant_id,
          category_id: original.category_id,
          txn_type: original.txn_type,
          amount: original.amount,
          currency: original.currency,
          description: `Reversal of transaction #${original.transaction_id}`,
        },
        conn
      );

      const effect = balanceEffect(original.txn_type);
      const amount = Number(original.amount);
      // Đảo dấu so với hiệu ứng gốc để hoàn nguyên balance.
      await accountRepository.adjustBalance(
        original.account_id,
        (-effect.primary * amount).toFixed(2),
        conn
      );
      if (original.related_account_id) {
        await accountRepository.adjustBalance(
          original.related_account_id,
          (-effect.related * amount).toFixed(2),
          conn
        );
      }

      await transactionRepository.updateStatus(original.transaction_id, "reversed", conn);
      // invert=true: bản ghi đảo mang cùng txn_type với gốc (chỉ balance đổi dấu qua
      // -effect ở trên), nên bút toán GL cũng phải đảo Nợ/Có để triệt tiêu đúng ảnh
      // hưởng gốc thay vì lặp lại y hệt (nếu không sẽ nhân đôi thay vì hoàn nguyên).
      await glService.postByTxnType(reversal, conn, { invert: true });
      return reversal;
    });
  },
};
