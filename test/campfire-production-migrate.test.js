"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseStatements } = require("../scripts/campfire-production-migrate");

test("Campfire migration contains exactly four additive tables and six additive indexes", () => {
  const script = fs.readFileSync(path.join(__dirname,"../db/migrations/20261106_campfire_interactions.sql"),"utf8");
  const statements = parseStatements(script);
  assert.equal(statements.length,10);
  assert.equal(statements.filter(x => /^CREATE TABLE/.test(x)).length,4);
  assert.equal(statements.filter(x => /^CREATE INDEX/.test(x)).length,6);
  assert.ok(statements.every(x => /^CREATE (?:TABLE|INDEX) IF NOT EXISTS campfire_/.test(x)));
  assert.ok(statements.every(x => !/DROP|TRUNCATE|ALTER TABLE|DELETE FROM/i.test(x)));
});
test("Campfire migration parser rejects nonadditive or suspicious scripts", () => {
  assert.throws(() => parseStatements("DROP TABLE campfire_comments;"),/refused/);
  assert.throws(() => parseStatements("SELECT 1;"),/refused/);
});


test("Global guest quotas use an additive table and expiry index", () => {
  const file = fs.readFileSync(path.join(__dirname,"../db/migrations/20261110_campfire_guest_limits.sql"),"utf8");
  const statements = parseStatements(file,2);
  assert.equal(statements.length,2);
  assert.match(statements[0],/^CREATE TABLE IF NOT EXISTS campfire_write_limits/);
  assert.match(statements[1],/^CREATE INDEX IF NOT EXISTS campfire_write_limits_expiry_idx/);
  assert.doesNotMatch(file,/DROP|TRUNCATE|ALTER TABLE|raw_ip|latitude|longitude/i);
});
