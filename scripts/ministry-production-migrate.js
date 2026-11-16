"use strict";

/*
 * Additive installation of the prayer and stewardship schemas for BUDAO Daily.
 * Runs only during Vercel production builds. Existing tables and data remain
 * untouched. Read from checked-in migration files; never accept remote SQL.
 */
const fs = require("node:fs");
const path = require("node:path");

const migrations = [
  "0001_stewardship_identity.sql",
  "0002_prayer_requests.sql"
];
const required = {
  prayer_requests: ["created_at", "status", "wants_reply", "completed_at"],
  prayer_audit_events: ["created_at", "event_type"],
  stewardship_audit_events: ["created_at", "event_type"]
};

function parseMigration(source) {
  const noComments = source.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
  const statements = noComments.split(";").map(s => s.trim()).filter(Boolean);
  if (!statements.length || statements.some(s =>
    !/^CREATE (?:EXTENSION|TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS\s/i.test(s)
  )) throw Error("BUDAO ministry schema migration refused: non-additive SQL");
  return statements;
}

async function verify(sql) {
  const tables = Object.keys(required);
  const rows = await sql(
    "SELECT table_name,column_name FROM information_schema.columns " +
    "WHERE table_schema='public' AND table_name IN ('prayer_requests'," +
    "'prayer_audit_events','stewardship_audit_events')"
  );
  for (const table of tables) {
    const names = new Set(rows.filter(r => r.table_name === table).map(r => r.column_name));
    for (const column of required[table]) {
      if (!names.has(column)) throw Error("Ministry schema validation failed: " + table + "." + column);
    }
  }
}

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    process.stdout.write("Ministry schema migration skipped outside production.\n");
    return;
  }
  if (!process.env.DATABASE_URL) throw Error("Ministry schema: DATABASE_URL not configured");
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  for (const filename of migrations) {
    const source = fs.readFileSync(path.join(__dirname, "..", "db", "migrations", filename), "utf8");
    for (const statement of parseMigration(source)) await sql(statement);
  }
  await verify(sql);
  process.stdout.write("Ministry schema ready: prayer and stewardship tables verified.\n");
}

if (require.main === module) main().catch(error => {
  console.error("Ministry schema preparation failed:", error.code || error.name || "unknown");
  process.exitCode = 1;
});
module.exports = { parseMigration, verify };
