import { accountTypeRepository } from "../repositories/accountTypeRepository";
import { AccountType } from "../types/domain";
import { Errors } from "../utils/errors";

export const accountTypeService = {
  async list(): Promise<AccountType[]> {
    return accountTypeRepository.findAll();
  },

  async getById(id: number): Promise<AccountType> {
    const type = await accountTypeRepository.findById(id);
    if (!type) throw Errors.notFound("account_type", id);
    return type;
  },

  async create(typeName: string, interestRate: number): Promise<AccountType> {
    return accountTypeRepository.create(typeName, interestRate);
  },
};
