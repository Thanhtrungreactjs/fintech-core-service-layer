import { customerRepository, CustomerFilter, CreateCustomerInput, UpdateCustomerInput } from "../repositories/customerRepository";
import { Customer, KycStatus } from "../types/domain";
import { Errors } from "../utils/errors";
import { Pagination, toLimitOffset } from "../utils/pagination";

export const customerService = {
  async create(input: CreateCustomerInput): Promise<Customer> {
    const existing = await customerRepository.findByEmail(input.email);
    if (existing) {
      throw Errors.conflict("CUSTOMER_EMAIL_TAKEN", `Email ${input.email} đã được sử dụng`);
    }
    if (input.referred_by !== undefined && input.referred_by !== null) {
      const referrer = await customerRepository.findById(input.referred_by);
      if (!referrer) throw Errors.notFound("customer", input.referred_by);
    }
    return customerRepository.create(input);
  },

  async getById(id: number): Promise<Customer> {
    const customer = await customerRepository.findById(id);
    if (!customer) throw Errors.notFound("customer", id);
    return customer;
  },

  async search(filter: CustomerFilter, pagination: Pagination) {
    const { limit, offset } = toLimitOffset(pagination);
    const { rows, total } = await customerRepository.search(filter, limit, offset);
    return { rows, total };
  },

  async update(id: number, input: UpdateCustomerInput): Promise<Customer> {
    await this.getById(id);
    await customerRepository.update(id, input);
    return this.getById(id);
  },

  /** KYC là nghiệp vụ nhạy cảm: chỉ cho chuyển 1 chiều pending -> verified/rejected (api-design.md mục "Customers"). */
  async updateKyc(id: number, target: KycStatus): Promise<Customer> {
    const customer = await this.getById(id);
    if (target === "pending") {
      throw Errors.business("KYC_INVALID_TRANSITION", "Không thể đặt lại kyc_status về pending");
    }
    if (customer.kyc_status !== "pending") {
      throw Errors.business(
        "KYC_INVALID_TRANSITION",
        `Khách hàng ${id} đã ở trạng thái KYC '${customer.kyc_status}', không thể chuyển tiếp`
      );
    }
    await customerRepository.updateKycStatus(id, target);
    return this.getById(id);
  },

  async getReferrals(id: number): Promise<Customer[]> {
    await this.getById(id);
    return customerRepository.findReferrals(id);
  },
};
