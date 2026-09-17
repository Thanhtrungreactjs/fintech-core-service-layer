import { z } from "zod";
import { paginationSchema } from "../utils/pagination";

export const glAccountCodeParam = z.object({ code: z.string().min(1).max(10) });
export const listGlEntriesQuery = paginationSchema;
