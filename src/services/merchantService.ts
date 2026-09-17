import { merchantRepository } from "../repositories/merchantRepository";
import { Pagination, toLimitOffset } from "../utils/pagination";

export const merchantService = {
  async list(pagination: Pagination) {
    const { limit, offset } = toLimitOffset(pagination);
    return merchantRepository.findAll(limit, offset);
  },
};
