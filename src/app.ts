import path from "node:path";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { apiRouter } from "./routes";
import { openapiSpec } from "./config/openapi";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.use("/api/v1", apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
