import { Router } from "express";
import { exchangeRateController } from "../controllers/exchangeRateController";
import { validate } from "../middleware/validate";
import { createExchangeRateBody, getExchangeRateQuery } from "../validators/exchangeRateSchemas";

export const exchangeRateRoutes = Router();

exchangeRateRoutes.get(
  "/",
  validate({ query: getExchangeRateQuery }),
  exchangeRateController.get
);
exchangeRateRoutes.post(
  "/",
  validate({ body: createExchangeRateBody }),
  exchangeRateController.create
);
