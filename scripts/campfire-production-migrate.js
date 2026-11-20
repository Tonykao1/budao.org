"use strict";

/*
 * One-time, additive production Campfire schema install.
 *
 * Vercel production builds have access to DATABASE_URL and run this before
 * deployment. Preview/CI builds never modify any production database.
 *
 * Keep the migration SQL under version control and execute only statements
 * from the trusted local migration file. No network credentials are logged.
 */
const fs = require("node:fs");
const path = require("node:path");

function parseStatements(sqlText, expectedCount = 10) {
  const normalized = sqlText
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");
  const statements = normalized.split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^(BEGIN|COMMIT)$/i.test(statement));
  if (statements.length !== expectedCount || statements.some((statement) =>
    !/^CREATE (?:TABLE|INDEX) IF NOT EXISTS campfire_/i.test(statement)
  )) {
    throw new Error("Campfire migration refused: expected additive CREATE statements");
  }
  return statements;
}

async function main() {
  if (process.env.VERCEL_ENV !== "production") {
    process.stdout.write("Campfire migration skipped outside production.\n");
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("Campfire migration: production DATABASE_URL is not configured");
  }

  const sqlText = fs.readFileSync(
    path.join(__dirname, "..", "db", "migrations", "20261106_campfire_interactions.sql"),
    "utf8"
  );
  const statements = parseStatements(sqlText);
  const guestLimitsSql = fs.readFileSync(
    path.join(__dirname, "..", "db", "migrations", "20261110_campfire_guest_limits.sql"),
    "utf8"
  );
  statements.push(...parseStatements(guestLimitsSql, 2));
  const phase2Sql = fs.readFileSync(
    path.join(__dirname, "..", "db", "migrations", "20261120_campfire_phase2.sql"),
    "utf8"
  );
  statements.push(...parseStatements(phase2Sql, 9));
  const walkSql = fs.readFileSync(
    path.join(__dirname, "..", "db", "migrations", "20261120_campfire_walk_intent.sql"), "utf8"
  );
  statements.push(...parseStatements(walkSql, 1));

  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);
  for (const statement of statements) {
    // SQL comes exclusively from our checked-in migration, never user input.
    // The pinned 0.10.x driver accepts a raw query string (no interpolation).
    await sql(statement);
  }

  const check = await sql(
    "SELECT to_regclass('public.campfire_comments') IS NOT NULL AS comments_ready, " +
    "to_regclass('public.campfire_write_limits') IS NOT NULL AS limits_ready, " +
    "to_regclass('public.campfire_notifications') IS NOT NULL AS notices_ready, " +
    "to_regclass('public.campfire_connections') IS NOT NULL AS connections_ready, " +
    "to_regclass('public.campfire_letters') IS NOT NULL AS letters_ready, " +
    "to_regclass('public.campfire_letter_reports') IS NOT NULL AS reports_ready, " +
    "to_regclass('public.campfire_walk_intentions') IS NOT NULL AS walk_ready"
  );
  if (!check[0] || !check[0].comments_ready || !check[0].limits_ready ||
      !check[0].notices_ready || !check[0].connections_ready || !check[0].letters_ready || !check[0].reports_ready || !check[0].walk_ready) {
    throw new Error("Campfire migration verification failed");
  }
  process.stdout.write("Campfire schema ready: interaction, inbox, mutual consent and letters tables verified.\n");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Campfire schema preparation failed:", err.code || err.name || "unknown");
    process.exitCode = 1;
  });
}

module.exports = { parseStatements };
