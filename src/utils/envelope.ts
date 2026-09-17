export interface PageMeta {
  total: number;
  page: number;
  size: number;
}

export function success<T>(data: T, meta?: PageMeta) {
  return meta !== undefined
    ? { status: "SUCCESS" as const, data, error: null, meta }
    : { status: "SUCCESS" as const, data, error: null };
}

export function failure(code: string, message: string) {
  return { status: "ERROR" as const, data: null, error: { code, message } };
}
