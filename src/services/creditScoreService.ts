import { customerRepository } from "../repositories/customerRepository";
import { accountRepository } from "../repositories/accountRepository";
import { loanRepository } from "../repositories/loanRepository";
import { loanPaymentRepository } from "../repositories/loanPaymentRepository";
import { fraudAlertRepository } from "../repositories/fraudAlertRepository";
import { Errors } from "../utils/errors";

export type CreditScoreGrade = "excellent" | "very_good" | "good" | "fair" | "poor";

export interface CreditScoreFactor {
  factor: string;
  label: string;
  points: number;
  detail: string;
}

export interface CreditScoreResult {
  customer_id: number;
  score: number;
  score_min: number;
  score_max: number;
  grade: CreditScoreGrade;
  grade_label: string;
  recommendation: string;
  factors: CreditScoreFactor[];
  computed_at: string;
}

const SCORE_MIN = 300;
const SCORE_MAX = 850;
const BASE_SCORE = 550;

function clampScore(n: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, Math.round(n)));
}

function gradeOf(score: number): { grade: CreditScoreGrade; label: string } {
  if (score >= 800) return { grade: "excellent", label: "Xuất sắc" };
  if (score >= 740) return { grade: "very_good", label: "Rất tốt" };
  if (score >= 670) return { grade: "good", label: "Tốt" };
  if (score >= 580) return { grade: "fair", label: "Trung bình" };
  return { grade: "poor", label: "Yếu / rủi ro cao" };
}

function recommendationOf(grade: CreditScoreGrade): string {
  switch (grade) {
    case "excellent":
    case "very_good":
      return "Đủ điều kiện vay — có thể xem xét ưu đãi lãi suất.";
    case "good":
      return "Đủ điều kiện vay ở điều kiện thông thường.";
    case "fair":
      return "Cân nhắc thêm — có thể yêu cầu tài sản đảm bảo hoặc người đồng vay.";
    case "poor":
      return "Không khuyến nghị cấp tín dụng mới cho đến khi khách hàng cải thiện lịch sử trả nợ.";
  }
}

/**
 * Chấm điểm tín dụng nội bộ, mô phỏng theo cách các core banking (vd T24) tổng hợp dữ liệu hành
 * vi có sẵn trong hệ thống thành 1 điểm số duy nhất phục vụ xét duyệt vay — KHÔNG phải điểm CIC
 * hay điểm của 1 tổ chức xếp hạng tín dụng thật (T24 thật cũng không tự chấm điểm, luôn lấy điểm
 * từ CIC/bureau ngoài rồi lưu lại). Thang điểm 300-850 mô phỏng theo thang phổ biến kiểu FICO.
 * Trọng số theo nhóm nhân tố tương tự FICO (lịch sử trả nợ ~35%, dư nợ/tỷ lệ sử dụng ~30%, độ dài
 * lịch sử ~15%, định danh/khác ~20%) nhưng công thức trong từng nhóm là tự đặt cho mục đích demo,
 * không phải công thức bureau thật (vốn không công bố công khai).
 */
export const creditScoreService = {
  async assess(customerId: number): Promise<CreditScoreResult> {
    const customer = await customerRepository.findById(customerId);
    if (!customer) throw Errors.notFound("customer", customerId);

    const [accountsResult, loans, payments, fraudCounts] = await Promise.all([
      accountRepository.findByCustomer(customerId, 1000, 0),
      loanRepository.findByCustomer(customerId),
      loanPaymentRepository.findByCustomer(customerId),
      fraudAlertRepository.countByCustomer(customerId),
    ]);
    const accounts = accountsResult.rows;

    const factors: CreditScoreFactor[] = [];
    let score = BASE_SCORE;

    // 1) Lịch sử trả nợ (~35%) — trọng số lớn nhất, giống nguyên tắc chấm điểm tín dụng thật
    const today = new Date().toISOString().slice(0, 10);
    const onTime = payments.filter((p) => p.paid_date && p.paid_date <= p.due_date).length;
    const late = payments.filter((p) => p.paid_date && p.paid_date > p.due_date).length;
    const overdueUnpaid = payments.filter((p) => !p.paid_date && p.due_date < today).length;
    const considered = onTime + late + overdueUnpaid;
    if (considered > 0) {
      const onTimeRatio = onTime / considered;
      const points = Math.round((onTimeRatio - 0.5) * 300);
      score += points;
      factors.push({
        factor: "payment_history",
        label: "Lịch sử trả nợ",
        points,
        detail: `${onTime}/${considered} kỳ trả nợ đúng hạn (${late} kỳ trễ hạn, ${overdueUnpaid} kỳ quá hạn chưa trả)`,
      });
    } else {
      factors.push({
        factor: "payment_history",
        label: "Lịch sử trả nợ",
        points: 0,
        detail: "Khách hàng chưa từng vay — chưa có lịch sử trả nợ để đánh giá",
      });
    }

    const defaultedLoans = loans.filter((l) => l.status === "defaulted").length;
    if (defaultedLoans > 0) {
      const points = -Math.min(150, defaultedLoans * 80);
      score += points;
      factors.push({
        factor: "defaulted_loans",
        label: "Nợ xấu",
        points,
        detail: `${defaultedLoans} khoản vay đã chuyển trạng thái nợ xấu (defaulted)`,
      });
    }

    // 2) Dư nợ đang vay so với tổng số dư tài khoản (~30%) — mô phỏng "tỷ lệ sử dụng tín dụng"
    const activeLoans = loans.filter((l) => l.status === "active");
    const totalPrincipal = activeLoans.reduce((s, l) => s + Number(l.principal_amount), 0);
    const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
    if (totalPrincipal > 0 || totalBalance > 0) {
      const ratio = totalPrincipal / (totalBalance + 1);
      let points: number;
      if (ratio <= 0.3) points = 60;
      else if (ratio <= 1) points = 20;
      else if (ratio <= 3) points = -40;
      else points = -90;
      score += points;
      factors.push({
        factor: "debt_to_balance",
        label: "Dư nợ / số dư",
        points,
        detail: `Tổng dư nợ đang active ${totalPrincipal.toLocaleString("vi-VN")} so với tổng số dư các tài khoản ${totalBalance.toLocaleString("vi-VN")}`,
      });
    }

    // 3) Độ dài quan hệ với ngân hàng (~15%)
    const monthsSinceOpen = Math.max(
      0,
      Math.floor((Date.now() - new Date(customer.created_at).getTime()) / (30 * 86400000))
    );
    const tenurePoints = Math.min(50, Math.round(monthsSinceOpen / 2));
    score += tenurePoints;
    factors.push({
      factor: "credit_history_length",
      label: "Độ dài quan hệ",
      points: tenurePoints,
      detail: `Khách hàng đã mở tài khoản được ${monthsSinceOpen} tháng`,
    });

    // 4) Định danh KYC (~10%) — rejected là dấu hiệu rủi ro danh tính nghiêm trọng
    let kycPoints = 0;
    if (customer.kyc_status === "verified") kycPoints = 30;
    else if (customer.kyc_status === "rejected") kycPoints = -100;
    score += kycPoints;
    factors.push({
      factor: "kyc_status",
      label: "Định danh KYC",
      points: kycPoints,
      detail: `Trạng thái KYC hiện tại: ${customer.kyc_status}`,
    });

    // 5) Cảnh báo gian lận (~10%)
    const confirmedFraud = fraudCounts.closed_confirmed ?? 0;
    const pendingFraud = (fraudCounts.open ?? 0) + (fraudCounts.reviewing ?? 0);
    const fraudPoints = -Math.min(150, confirmedFraud * 60) - Math.min(60, pendingFraud * 15);
    if (fraudPoints !== 0) {
      score += fraudPoints;
      factors.push({
        factor: "fraud_alerts",
        label: "Cảnh báo gian lận",
        points: fraudPoints,
        detail: `${confirmedFraud} cảnh báo đã xác nhận gian lận, ${pendingFraud} cảnh báo đang chờ xử lý`,
      });
    }

    // 6) Tài khoản bị đóng băng/đóng — dấu hiệu bất thường trong vận hành
    const frozenOrClosed = accounts.filter((a) => a.status === "frozen" || a.status === "closed").length;
    if (frozenOrClosed > 0) {
      const points = -Math.min(60, frozenOrClosed * 20);
      score += points;
      factors.push({
        factor: "account_status",
        label: "Trạng thái tài khoản",
        points,
        detail: `${frozenOrClosed} tài khoản đang bị đóng băng hoặc đã đóng`,
      });
    }

    const finalScore = clampScore(score);
    const { grade, label } = gradeOf(finalScore);

    return {
      customer_id: customerId,
      score: finalScore,
      score_min: SCORE_MIN,
      score_max: SCORE_MAX,
      grade,
      grade_label: label,
      recommendation: recommendationOf(grade),
      factors,
      computed_at: new Date().toISOString(),
    };
  },
};
