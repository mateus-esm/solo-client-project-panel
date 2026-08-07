/**
 * migrate.mjs — run additive SQL migrations exactly once.
 *
 * Usage:  pnpm --filter @workspace/db migrate
 *
 * Maintains a `schema_migrations` table that records which files have been
 * applied. Each migration runs inside a transaction and is skipped on
 * subsequent invocations, so the runner is safe to call on every deploy.
 *
 * Files: lib/db/migrations/*.sql, applied in lexicographic order.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL must be set.");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "migrations");

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

// Ensure the tracking table exists (idempotent, no migration file needed).
await client.query(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text      PRIMARY KEY,
    applied_at timestamp NOT NULL DEFAULT now()
  )
`);

// Collect already-applied migrations.
const { rows: applied } = await client.query(
  "SELECT filename FROM schema_migrations"
);
const appliedSet = new Set(applied.map((r) => r.filename));

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // lexicographic — 001_… before 002_…

let ran = 0;
for (const file of files) {
  if (appliedSet.has(file)) {
    console.log(`  ─ ${file} (already applied, skipping)`);
    continue;
  }

  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  console.log(`  ▶ ${file}`);

  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1)",
      [file]
    );
    await client.query("COMMIT");
    console.log(`  ✓ ${file}`);
    ran++;
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`  ✗ ${file} — rolled back:`, err.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log(
  ran === 0
    ? "No new migrations to apply."
    : `Done — applied ${ran} migration(s).`
);
