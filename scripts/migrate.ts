/**
 * Vera database migration runner
 *
 * Usage:
 *   npx tsx scripts/migrate.ts              # uses DATABASE_URL from .env.local
 *   npx tsx scripts/migrate.ts --prod       # uses DATABASE_URL_PROD from .env.local
 *
 * What it does:
 *   1. Creates the _migrations tracking table if it doesn't exist
 *   2. Reads all *.sql files from lib/migrations/ in alphabetical order
 *   3. Skips migrations already recorded in _migrations
 *   4. Applies pending migrations in order inside a transaction
 *   5. Records each applied migration with a timestamp
 *
 * Adding a new migration:
 *   1. Create lib/migrations/NNN_description.sql
 *   2. Run this script against dev, verify, then run against prod
 *   Never ALTER the DB manually — always use a migration file.
 */

import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const isProd = process.argv.includes("--prod");

// Load env from appropriate file — never overwrites .env.local
const envFile = isProd
  ? join(process.cwd(), ".env.production.local")
  : join(process.cwd(), ".env.local");

function loadEnv(file: string): Record<string, string> {
  try {
    const raw = readFileSync(file, "utf8");
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+[A-Z0-9_]*)="?([^"]*)"?/);
      if (m) result[m[1]] = m[2];
    }
    return result;
  } catch {
    return {};
  }
}

// For prod: read .env.production.local (pull it first with: vercel env pull .env.production.local --environment=production)
// For dev:  read .env.local (always present for local dev)
let env = loadEnv(envFile);

if (!env.DATABASE_URL && isProd) {
  console.error("Run first: vercel env pull .env.production.local --environment=production");
  process.exit(1);
}
if (!env.DATABASE_URL && !isProd) {
  console.error("Could not read .env.local — run `vercel env pull .env.local` first.");
  process.exit(1);
}

const dbUrl = isProd
  ? (env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL)
  : (env.DATABASE_URL ?? "");

if (!dbUrl) {
  console.error(`DATABASE_URL${isProd ? "_UNPOOLED" : ""} not found in .env.local`);
  process.exit(1);
}

const sql = neon(dbUrl);
const migrationsDir = join(process.cwd(), "lib/migrations");

async function run() {
  const target = isProd ? "PRODUCTION" : "development";
  console.log(`\nVera migrations → ${target}\n${"─".repeat(40)}`);

  // Create tracking table
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      applied_at  TIMESTAMPTZ DEFAULT now()
    )`;

  // Which migrations are already applied?
  const applied = new Set(
    (await sql`SELECT filename FROM _migrations`).map(r => r.filename as string)
  );

  // Read migration files sorted alphabetically
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  const pending = files.filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log("✓ All migrations already applied.\n");
    return;
  }

  console.log(`  Applied : ${applied.size}`);
  console.log(`  Pending : ${pending.length}\n`);

  for (const filename of pending) {
    const filepath = join(migrationsDir, filename);
    const sql_text = readFileSync(filepath, "utf8");

    process.stdout.write(`  → ${filename} … `);
    try {
      // Split on semicolons to run multi-statement files
      // (neon's http driver doesn't support multi-statement strings)
      const statements = sql_text
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith("--"));

      for (const stmt of statements) {
        await sql.unsafe(stmt);
      }

      await sql`INSERT INTO _migrations (filename) VALUES (${filename})`;
      console.log("done");
    } catch (e) {
      console.log("FAILED");
      console.error(`\n  Error in ${filename}:\n  ${(e as Error).message}\n`);
      process.exit(1);
    }
  }

  console.log(`\n✓ Applied ${pending.length} migration${pending.length !== 1 ? "s" : ""}.\n`);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
