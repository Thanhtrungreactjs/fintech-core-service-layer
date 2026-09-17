import { z } from "zod";

export function idParam(paramName: string) {
  return z.object({ [paramName]: z.coerce.number().int().positive() });
}
