import test from "node:test";
import assert from "node:assert/strict";
import { loadMigrations } from "../packages/db/src/repository.js";

test("database migrations are ordered and include persistence hardening", async () => {
  const migrations = await loadMigrations();
  assert.deepEqual(migrations.map((migration) => migration.id), ["0001_initial", "0002_persistence_hardening"]);
  assert.match(migrations[0].sql, /CREATE TABLE IF NOT EXISTS audit_packets/);
  assert.match(migrations[1].sql, /selected_rules_pack_id/);
  assert.match(migrations[1].sql, /idx_evidence_org_facility_active_created/);
});
