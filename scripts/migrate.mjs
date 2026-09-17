import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const files = [
  path.join(root, "db", "schema.postgres.sql"),
  path.join(root, "db", "migrations", "001_idempotency_keys.sql"),
  path.join(root, "db", "migrations", "002_term_deposits.sql"),
  path.join(root, "db", "migrations", "003_general_ledger.sql"),
  path.join(root, "db", "migrations", "004_maker_checker.sql"),
  path.join(root, "db", "migrations", "005_loan_account_link.sql"),
  path.join(root, "db", "migrations", "006_close_of_business.sql"),
  path.join(root, "db", "migrations", "007_auth_login.sql"),
  path.join(root, "db", "migrations", "008_idempotency_claim.sql"),
  path.join(root, "db", "migrations", "009_ekyc.sql"),
];

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DB_SSL ?? "true") === "true" ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  for (const file of files) {
    const sql = fs.readFileSync(file, "utf8");
    console.log(`Running ${path.relative(root, file)}...`);
    await client.query(sql);
  }
  console.log("Migration completed.");
} finally {
  await client.end();
}
