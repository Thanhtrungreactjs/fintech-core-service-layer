import { createWorker } from "tesseract.js";
import { ekycRepository } from "../repositories/ekycRepository";
import { customerService } from "./customerService";
import { EkycVerification, EkycDecision } from "../types/domain";

/**
 * eKYC chạy thật bằng thư viện mã nguồn mở, KHÔNG dùng vendor eKYC thương mại:
 *  - OCR đọc giấy tờ: tesseract.js (chạy ở backend, nhận ảnh giấy tờ do client upload).
 *  - Đối chiếu khuôn mặt: @vladmandic/face-api chạy Ở TRÌNH DUYỆT (public/index.html) —
 *    client tự tính face_match_score (0-100) rồi gửi kèm lên đây, backend không tự làm
 *    face-matching (tránh phụ thuộc node-canvas — build native rất hay lỗi trên Windows).
 * KHÔNG có: chống giả mạo/liveness thật (chỉ so 1 ảnh tĩnh, không phát hiện ảnh chụp lại
 * ảnh), không đọc chip NFC, không tra cứu cơ sở dữ liệu dân cư — khác hẳn eKYC ngân hàng
 * thật (xem giải thích đã trao đổi: T24 thật cũng không tự làm phần này, luôn gọi ra 1 nhà
 * cung cấp eKYC chuyên biệt bên ngoài rồi nhận kết quả về).
 */

const FACE_MATCH_THRESHOLD = 60;
const NAME_MATCH_THRESHOLD = 70;
const REJECT_THRESHOLD = 30;

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function nameSimilarity(a: string, b: string): number {
  const s1 = normalizeName(a);
  const s2 = normalizeName(b);
  if (!s1 || !s2) return 0;
  const dist = levenshtein(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return Math.max(0, (1 - dist / maxLen) * 100);
}

interface ExtractedFields {
  full_name: string | null;
  id_number: string | null;
  dob: string | null;
}

/** Regex heuristic cho CCCD/CMND Việt Nam — OCR thật không hoàn hảo nên chỉ cố gắng bắt
 * đúng phần lớn trường hợp, không đảm bảo đọc đúng 100% (giống thực tế mọi engine OCR). */
function extractFields(rawText: string): ExtractedFields {
  const idMatch = rawText.match(/\b\d{9}(\d{3})?\b/);
  const dobMatch = rawText.match(/(\d{2})[/\-.](\d{2})[/\-.](\d{4})/);
  const dob = dobMatch ? `${dobMatch[3]}-${dobMatch[2]}-${dobMatch[1]}` : null;

  const nameLineMatch = rawText.match(/(?:Họ và tên|Ho va ten|Full name|Name)[:\s]*\n?([A-ZÀ-Ỹ\s]{3,60})/i);
  const full_name = nameLineMatch ? nameLineMatch[1].trim().replace(/\s+/g, " ") : null;

  return { full_name, id_number: idMatch ? idMatch[0] : null, dob };
}

export const ekycService = {
  async verify(
    customerId: number,
    idImageBuffer: Buffer,
    faceMatchScore: number | null
  ): Promise<EkycVerification> {
    const customer = await customerService.getById(customerId);

    const worker = await createWorker(["vie", "eng"]);
    let ocrText = "";
    let ocrConfidence = 0;
    try {
      const { data } = await worker.recognize(idImageBuffer);
      ocrText = data.text;
      ocrConfidence = data.confidence;
    } finally {
      await worker.terminate();
    }

    const extracted = extractFields(ocrText);
    const nameMatchScore = extracted.full_name ? nameSimilarity(extracted.full_name, customer.full_name) : 0;

    let decision: EkycDecision;
    let reason: string;
    if (faceMatchScore === null) {
      decision = "manual_review";
      reason = "Chưa có kết quả đối chiếu khuôn mặt — cần checker xem xét thủ công";
    } else if (faceMatchScore >= FACE_MATCH_THRESHOLD && nameMatchScore >= NAME_MATCH_THRESHOLD) {
      decision = "verified";
      reason = `Khớp khuôn mặt ${faceMatchScore.toFixed(1)}% và tên trích xuất từ giấy tờ khớp ${nameMatchScore.toFixed(1)}% với hồ sơ`;
    } else if (faceMatchScore < REJECT_THRESHOLD || nameMatchScore < REJECT_THRESHOLD) {
      decision = "rejected";
      reason = `Không khớp: khuôn mặt ${faceMatchScore.toFixed(1)}%, tên ${nameMatchScore.toFixed(1)}%`;
    } else {
      decision = "manual_review";
      reason = `Kết quả chưa đủ rõ ràng (khuôn mặt ${faceMatchScore.toFixed(1)}%, tên ${nameMatchScore.toFixed(1)}%) — cần checker xem xét thủ công`;
    }

    let kycStatusApplied = false;
    if ((decision === "verified" || decision === "rejected") && customer.kyc_status === "pending") {
      await customerService.updateKyc(customerId, decision);
      kycStatusApplied = true;
    }

    return ekycRepository.create({
      customer_id: customerId,
      extracted_full_name: extracted.full_name,
      extracted_id_number: extracted.id_number,
      extracted_dob: extracted.dob,
      ocr_confidence: ocrConfidence,
      name_match_score: nameMatchScore,
      face_match_score: faceMatchScore,
      decision,
      reason,
      kyc_status_applied: kycStatusApplied,
    });
  },

  async listByCustomer(customerId: number): Promise<EkycVerification[]> {
    await customerService.getById(customerId);
    return ekycRepository.findByCustomer(customerId);
  },
};
