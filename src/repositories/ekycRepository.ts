import { pool } from "../db/pool";
import { EkycVerification, EkycDecision } from "../types/domain";

export interface CreateEkycVerificationInput {
  customer_id: number;
  extracted_full_name: string | null;
  extracted_id_number: string | null;
  extracted_dob: string | null;
  ocr_confidence: number | null;
  name_match_score: number | null;
  face_match_score: number | null;
  decision: EkycDecision;
  reason: string | null;
  kyc_status_applied: boolean;
}

export const ekycRepository = {
  async create(input: CreateEkycVerificationInput): Promise<EkycVerification> {
    const { rows } = await pool.query<EkycVerification>(
      `INSERT INTO ekyc_verifications
         (customer_id, extracted_full_name, extracted_id_number, extracted_dob,
          ocr_confidence, name_match_score, face_match_score, decision, reason, kyc_status_applied)
       VALUES
         (:customer_id, :extracted_full_name, :extracted_id_number, :extracted_dob,
          :ocr_confidence, :name_match_score, :face_match_score, :decision, :reason, :kyc_status_applied)
       RETURNING *`,
      { ...input }
    );
    return rows[0];
  },

  async findByCustomer(customerId: number): Promise<EkycVerification[]> {
    const { rows } = await pool.query<EkycVerification>(
      `SELECT * FROM ekyc_verifications WHERE customer_id = :customerId ORDER BY verification_id DESC`,
      { customerId }
    );
    return rows;
  },
};
