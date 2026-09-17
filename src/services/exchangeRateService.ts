import { exchangeRateRepository, CreateExchangeRateInput } from "../repositories/exchangeRateRepository";
import { ExchangeRate } from "../types/domain";
import { AppError } from "../utils/errors";

export const exchangeRateService = {
  async getAsOf(from: string, to: string, date: string): Promise<ExchangeRate> {
    const rate = await exchangeRateRepository.findAsOf(from, to, date);
    if (!rate) {
      throw new AppError(
        "EXCHANGE_RATE_NOT_FOUND",
        `Không có tỷ giá ${from}->${to} tính đến ngày ${date}`,
        404
      );
    }
    return rate;
  },

  async create(input: CreateExchangeRateInput): Promise<ExchangeRate> {
    return exchangeRateRepository.create(input);
  },
};
