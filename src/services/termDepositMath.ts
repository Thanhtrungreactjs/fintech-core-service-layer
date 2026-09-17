import { DayCountConvention } from "../types/domain";

function yearBasis(convention: DayCountConvention): number {
  return convention === "actual_360" ? 360 : 365;
}

function toDate(dateISO: string): Date {
  return new Date(dateISO + "T00:00:00Z");
}

export function daysBetween(fromISO: string, toISO: string): number {
  return Math.round((toDate(toISO).getTime() - toDate(fromISO).getTime()) / 86_400_000);
}

export function addMonthsISO(dateISO: string, months: number): string {
  const d = toDate(dateISO);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Lãi đơn: I = P * r% * số_ngày / cơ_sở_năm (actual/365 hoặc actual/360). */
export function simpleInterest(
  principal: number,
  annualRatePercent: number,
  days: number,
  convention: DayCountConvention
): number {
  if (days <= 0) return 0;
  return (principal * (annualRatePercent / 100) * days) / yearBasis(convention);
}

/**
 * Lãi kép ghép hàng tháng cho trọn kỳ hạn (lãi tháng trước nhập gốc để tính lãi tháng sau):
 * I = P * ((1 + r%/12) ^ termMonths - 1)
 */
export function compoundInterestFullTerm(
  principal: number,
  annualRatePercent: number,
  termMonths: number
): number {
  const monthlyRate = annualRatePercent / 100 / 12;
  return principal * (Math.pow(1 + monthlyRate, termMonths) - 1);
}

/**
 * Rút trước hạn: theo thông lệ ngân hàng VN, sổ KHÔNG được hưởng lãi suất có kỳ hạn
 * đã cam kết (dù chỉ còn thiếu 1 ngày là đáo hạn) — chỉ được tính lãi đơn ở mức lãi
 * suất không kỳ hạn (early_withdrawal_rate, thường 0.1–0.5%/năm) trên đúng số ngày
 * thực gửi. Áp dụng như nhau bất kể sổ gốc dùng phương pháp lãi đơn hay lãi kép.
 */
export function earlyWithdrawalInterest(
  principal: number,
  earlyWithdrawalRatePercent: number,
  elapsedDays: number,
  convention: DayCountConvention
): number {
  return simpleInterest(principal, earlyWithdrawalRatePercent, elapsedDays, convention);
}
