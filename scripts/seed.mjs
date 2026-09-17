import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.DB_SSL ?? "true") === "true" ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  await client.query(
    `INSERT INTO transaction_categories (category_name, category_group) VALUES
       ('Deposit', 'income'), ('Withdrawal', 'spending'), ('Transfer', 'transfer')
     ON CONFLICT (category_name) DO NOTHING`
  );
  console.log("Seed completed.");
} finally {
  await client.end();
}
