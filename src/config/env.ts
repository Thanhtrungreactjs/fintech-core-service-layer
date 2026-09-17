import "dotenv/config";

function buildConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.DB_HOST ?? "localhost";
  const port = process.env.DB_PORT ?? "5432";
  const user = process.env.DB_USER ?? "postgres";
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME ?? "postgres";
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  db: {
    connectionString: buildConnectionString(),
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    // Supabase (và hầu hết Postgres managed) yêu cầu SSL; tắt được cho DB local qua DB_SSL=false.
    ssl: (process.env.DB_SSL ?? "true") === "true",
  },
  fraudAmountThreshold: Number(process.env.FRAUD_AMOUNT_THRESHOLD ?? 50_000_000),
  // Demo-only fallback — BẮT BUỘC đặt JWT_SECRET riêng qua .env khi dùng ngoài môi trường demo.
  jwtSecret: process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
  // Lịch chạy COB tự động (cú pháp cron chuẩn) — mặc định 00:00 mỗi ngày, giống giờ COB
  // thật của ngân hàng chạy sau khi hết giờ giao dịch trong ngày.
  cobCronSchedule: process.env.COB_CRON_SCHEDULE ?? "0 0 * * *",
};
