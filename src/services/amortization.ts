export interface AmortizationRow {
  installment_no: number;
  due_date: string;
  amount_due: string;
  principal_component: string;
  interest_component: string;
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Lịch trả góp theo phương pháp dư nợ giảm dần, trả đều mỗi kỳ (French amortization).
 * annualRatePercent: interest_rate của loans (vd 12.5 nghĩa là 12.5%/năm).
 * Kỳ cuối được điều chỉnh phần dư làm tròn để tổng principal_component == principal.
 */
export function buildAmortizationSchedule(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
  disbursedDate: string
): AmortizationRow[] {
  const monthlyRate = annualRatePercent / 100 / 12;
  const installment =
    monthlyRate === 0
      ? principal / termMonths
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -termMonths));

  const rows: AmortizationRow[] = [];
  let remaining = principal;

  for (let i = 1; i <= termMonths; i++) {
    const interestComponent = remaining * monthlyRate;
    let principalComponent = installment - interestComponent;
    if (i === termMonths) {
      // Kỳ cuối: trả hết phần dư nợ còn lại để tránh lệch số do làm tròn tích luỹ.
      principalComponent = remaining;
    }
    const amountDue = principalComponent + interestComponent;
    remaining -= principalComponent;

    rows.push({
      installment_no: i,
      due_date: addMonths(disbursedDate, i),
      amount_due: amountDue.toFixed(2),
      principal_component: principalComponent.toFixed(2),
      interest_component: interestComponent.toFixed(2),
    });
  }

  return rows;
}
