import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(200).default(20),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function toLimitOffset(p: Pagination): { limit: number; offset: number } {
  return { limit: p.size, offset: (p.page - 1) * p.size };
}
