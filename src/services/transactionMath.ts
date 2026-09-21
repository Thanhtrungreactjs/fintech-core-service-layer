import { Transaction, TxnType } from "../types/domain";

const CREDIT_TYPES: TxnType[] = ["deposit", "interest"];
const DEBIT_TYPES: TxnType[] = ["withdrawal", "payment", "fee"];

/** Chiều ảnh hưởng lên balance của account_id/related_account_id cho từng txn_type. */
export function balanceEffect(txnType: TxnType): { primary: 1 | -1; related: 1 | -1 } {
  if (txnType === "transfer") return { primary: -1, related: 1 };
  if (CREDIT_TYPES.includes(txnType)) return { primary: 1, related: 1 };
  if (DEBIT_TYPES.includes(txnType)) return { primary: -1, related: -1 };
  throw new Error(`Unknown txn_type: ${txnType}`);
}

// transactionService.reverse() lưu bản ghi đảo với CÙNG txn_type như bản gốc (chỉ mô tả khác —
// "Reversal of transaction #N") nhưng áp dụng balance NGƯỢC DẤU so với txn_type đó (xem
// accountRepository.adjustBalance(..., -effect...) trong transactionService.reverse()). Nếu tính
// signedDelta thẳng theo txn_type như giao dịch thường sẽ SAI DẤU cho riêng bản ghi đảo này — số
// dư chạy dồn sẽ lệch khỏi accounts.balance thật đúng bằng 2 lần số tiền của mỗi giao dịch đã đảo.
const REVERSAL_DESCRIPTION_PREFIX = "Reversal of transaction #";

/** Delta (có dấu) mà 1 transaction gây ra lên balance của `accountId`, xét cả 2 vai trò account_id/related_account_id. */
export function signedDelta(txn: Transaction, accountId: number): number {
  const amount = Number(txn.amount);
  const effect = balanceEffect(txn.txn_type);
  const sign = txn.description?.startsWith(REVERSAL_DESCRIPTION_PREFIX) ? -1 : 1;
  if (txn.account_id === accountId) return sign * effect.primary * amount;
  if (txn.related_account_id === accountId) return sign * effect.related * amount;
  return 0;
}
