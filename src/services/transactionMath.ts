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

/** Delta (có dấu) mà 1 transaction gây ra lên balance của `accountId`, xét cả 2 vai trò account_id/related_account_id. */
export function signedDelta(txn: Transaction, accountId: number): number {
  const amount = Number(txn.amount);
  const effect = balanceEffect(txn.txn_type);
  if (txn.account_id === accountId) return effect.primary * amount;
  if (txn.related_account_id === accountId) return effect.related * amount;
  return 0;
}
