import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

export const runCobBody = z.object({ as_of_date: z.string().date().optional() });
export const listCobRunsQuery = paginationSchema;
