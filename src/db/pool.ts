import { Pool, PoolClient, QueryResult, QueryResultRow, types } from "pg";
import { env } from "../config/env";

// node-postgres trả BIGINT (OID 20) dạng string mặc định để tránh mất độ chính xác
// ngoài Number.MAX_SAFE_INTEGER. Các PK/FK trong schema này (customer_id, account_id...)
// không bao giờ đạt tới ngưỡng đó, nên parse thẳng về number để khớp domain types và
// tránh so sánh "1" !== 1 sai ở tầng service. DECIMAL/NUMERIC (money) vẫn giữ dạng string
// (không đăng ký type parser) vì đó là nơi thực sự cần chính xác tuyệt đối.
types.setTypeParser(20, (val: string) => parseInt(val, 10));

// node-postgres mặc định parse DATE (OID 1082) thành đối tượng JS Date ở giờ 00:00
// theo timezone của server, rồi lệch ngày khi serialize sang ISO string (UTC) — vd
// "2026-06-06" bị trả về thành "2026-06-06T17:00:00.000Z" (lùi 1 ngày ở UTC+7). Toàn
// bộ domain type khai báo các cột DATE (dob, disbursed_date, due_date, expiry_date,
// rate_date, start_date, maturity_date...) là string "YYYY-MM-DD" thuần và các phép
// tính lãi (termDepositMath) cộng/trừ ngày trực tiếp trên string đó — giữ nguyên chuỗi
// thô từ Postgres, không qua Date object, để tránh lệch ngày.
types.setTypeParser(1082, (val: string) => val);

// Tương tự DATE: TIMESTAMPTZ (OID 1184) mặc định cũng bị pg parse thành đối tượng
// JS Date thay vì string. JSON.stringify(Date) tự gọi .toISOString() nên response
// JSON vẫn "trông đúng", nhưng code gọi trực tiếp string method (vd .slice()) trên
// giá trị field như txn_timestamp/created_at (domain type khai báo là string) sẽ
// crash. Parse thủ công về ISO string (giữ nguyên format "...T...Z" như trước, chỉ
// khác là string thật thay vì Date) để khớp domain types mà không đổi format API.
types.setTypeParser(1184, (val: string) => new Date(val).toISOString());

export const pgPool = new Pool({
  connectionString: env.db.connectionString,
  max: env.db.connectionLimit,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : undefined,
});

/** Chuyển placeholder kiểu `:name` (dễ đọc trong SQL) sang `$1..$n` mà node-postgres yêu cầu. */
function toPositional(sql: string, params: Record<string, unknown>): { text: string; values: unknown[] } {
  const values: unknown[] = [];
  // (?<!:) loại trừ toán tử cast "::type" của Postgres (vd :responseBody::jsonb)
  // — nếu không, ":jsonb" trong "::jsonb" sẽ bị hiểu nhầm thành 1 bind param.
  const text = sql.replace(/(?<!:):(\w+)/g, (_match, name: string) => {
    if (!(name in params)) {
      throw new Error(`Missing bind param :${name} for query`);
    }
    values.push(params[name]);
    return `$${values.length}`;
  });
  return { text, values };
}

export interface Executor {
  query<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: Record<string, unknown>
  ): Promise<QueryResult<T>>;
}

function wrap(runner: Pool | PoolClient): Executor {
  return {
    async query<T extends QueryResultRow>(sql: string, params: Record<string, unknown> = {}) {
      const { text, values } = toPositional(sql, params);
      return runner.query<T>(text, values);
    },
  };
}

export const pool: Executor = wrap(pgPool);

/** Chạy 1 loạt thao tác trong cùng 1 DB transaction (dùng cho các nghiệp vụ nhiều bước). */
export async function withTransaction<T>(work: (exec: Executor) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(wrap(client));
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
