import { transactionCategoryRepository } from "../repositories/transactionCategoryRepository";
import { TransactionCategory } from "../types/domain";
import { Errors } from "../utils/errors";

export const transactionCategoryService = {
  async list(): Promise<TransactionCategory[]> {
    return transactionCategoryRepository.findAll();
  },

  async getById(id: number): Promise<TransactionCategory> {
    const category = await transactionCategoryRepository.findById(id);
    if (!category) throw Errors.notFound("transaction_category", id);
    return category;
  },
};
