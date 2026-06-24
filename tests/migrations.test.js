import test from "node:test";
import assert from "node:assert/strict";
import { loadMigrations } from "../packages/db/src/repository.js";

test("database migrations are ordered and include persistence hardening", async () => {
  const migrations = await loadMigrations();
  assert.deepEqual(migrations.map((migration) => migration.id), ["0001_initial", "0002_persistence_hardening", "0003_ai_evidence_intelligence", "0004_production_file_intelligence", "0005_pilot_readiness_hardening"]);
  assert.match(migrations[0].sql, /CREATE TABLE IF NOT EXISTS audit_packets/);
  assert.match(migrations[1].sql, /selected_rules_pack_id/);
  assert.match(migrations[1].sql, /idx_evidence_org_facility_active_created/);
  assert.match(migrations[2].sql, /CREATE TABLE IF NOT EXISTS evidence_ai_analyses/);
  assert.match(migrations[2].sql, /idx_ai_analyses_org_facility_status/);
  assert.match(migrations[3].sql, /CREATE TABLE IF NOT EXISTS evidence_processing_jobs/);
  assert.match(migrations[3].sql, /idx_processing_jobs_one_active_per_evidence/);
  assert.match(migrations[3].sql, /idx_ai_analyses_current_evidence/);
  assert.match(migrations[4].sql, /lease_expires_at/);
  assert.match(migrations[4].sql, /dead_letter/);
  assert.match(migrations[4].sql, /deleted_by_user_id/);
});
