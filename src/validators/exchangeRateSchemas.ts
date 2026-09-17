import { z } from "zod";

export const getExchangeRateQuery = z.object({
  from: z.string().length(3),
  to: z.string().length(3),
  date: z.string().date(),
});

export const createExchangeRateBody = z.object({
  currency_from: z.string().length(3),
  currency_to: z.string().length(3),
  rate: z.coerce.number().positive(),
  rate_date: z.string().date(),
});
