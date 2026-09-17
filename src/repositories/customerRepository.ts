import { pool } from "../db/pool";
import { Customer, KycStatus } from "../types/domain";

export interface CustomerFilter {
  email?: string;
  kycStatus?: KycStatus;
  referredBy?: number;
}

export interface CreateCustomerInput {
  full_name: string;
  email: string;
  phone?: string | null;
  dob?: string | null;
  country?: string | null;
  referred_by?: number | null;
}

export interface UpdateCustomerInput {
  full_name?: string;
  phone?: string | null;
  dob?: string | null;
  country?: string | null;
}

export const customerRepository = {
  async findById(id: number): Promise<Customer | null> {
    const { rows } = await pool.query<Customer>(
      `SELECT * FROM customers WHERE customer_id = :id`,
      { id }
    );
    return rows[0] ?? null;
  },

  async findByEmail(email: string): Promise<Customer | null> {
    const { rows } = await pool.query<Customer>(
      `SELECT * FROM customers WHERE email = :email`,
      { email }
    );
    return rows[0] ?? null;
  },

  async search(filter: CustomerFilter, limit: number, offset: number) {
    const where: string[] = [];
    const params: Record<string, unknown> = { limit, offset };

    if (filter.email) {
      where.push("email = :email");
      params.email = filter.email;
    }
    if (filter.kycStatus) {
      where.push("kyc_status = :kycStatus");
      params.kycStatus = filter.kycStatus;
    }
    if (filter.referredBy !== undefined) {
      where.push("referred_by = :referredBy");
      params.referredBy = filter.referredBy;
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows } = await pool.query<Customer>(
      `SELECT * FROM customers ${whereClause} ORDER BY customer_id DESC LIMIT :limit OFFSET :offset`,
      params
    );
    const { rows: countRows } = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM customers ${whereClause}`,
      params
    );
    return { rows, total: Number(countRows[0]?.total ?? 0) };
  },

  async findReferrals(customerId: number): Promise<Customer[]> {
    const { rows } = await pool.query<Customer>(
      `SELECT * FROM customers WHERE referred_by = :customerId ORDER BY customer_id DESC`,
      { customerId }
    );
    return rows;
  },

  async create(input: CreateCustomerInput): Promise<Customer> {
    const { rows } = await pool.query<Customer>(
      `INSERT INTO customers (full_name, email, phone, dob, country, referred_by)
       VALUES (:full_name, :email, :phone, :dob, :country, :referred_by)
       RETURNING *`,
      {
        full_name: input.full_name,
        email: input.email,
        phone: input.phone ?? null,
        dob: input.dob ?? null,
        country: input.country ?? null,
        referred_by: input.referred_by ?? null,
      }
    );
    return rows[0];
  },

  async update(id: number, input: UpdateCustomerInput): Promise<void> {
    const fields = Object.entries(input).filter(([, v]) => v !== undefined);
    if (fields.length === 0) return;
    const setClause = fields.map(([k]) => `${k} = :${k}`).join(", ");
    await pool.query(`UPDATE customers SET ${setClause} WHERE customer_id = :id`, {
      ...input,
      id,
    });
  },

  async updateKycStatus(id: number, kycStatus: KycStatus): Promise<void> {
    await pool.query(`UPDATE customers SET kyc_status = :kycStatus WHERE customer_id = :id`, {
      id,
      kycStatus,
    });
  },
};
