import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresRepository } from "../packages/db/src/postgres-repository.js";
import { runMigrations } from "../packages/db/src/migration-runner.js";
import { createPostgresPool } from "../packages/db/src/postgres-pool.js";
import { loadMigrations } from "../packages/db/src/repository.js";
import { parseEvidenceInput, parseFacilityInput } from "../packages/shared/src/index.js";
import { generateReview } from "../packages/rules/src/index.js";

test("postgres repository persists facilities, evidence, reviews, matches, and packets", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = await createPostgresPool(process.env.TEST_DATABASE_URL);
  try {
    await runMigrations(pool, await loadMigrations());
  } finally {
    await pool.end();
  }

  const repo = new PostgresRepository(process.env.TEST_DATABASE_URL);
  await repo.init();
  const suffix = randomUUID();
  try {
    const org = await repo.createOrganization({ name: `Tenant ${suffix}` });
    const user = await repo.createUser({ organizationId: org.id, email: `admin-${suffix}@example.com`, passwordHash: "hash", name: "Admin", role: "admin", isActive: true });
    const facility = await repo.createFacility(parseFacilityInput({
      name: `Plant ${suffix}`,
      country: "US",
      stateProvince: "OH",
      region: "OH",
      industry: "industrial_manufacturing",
      facilityType: "fabrication",
      employeeCount: 40,
      hazardProfile: { machinery: true, lockoutTagout: true }
    }, org.id));
    const evidence = await repo.createEvidence(parseEvidenceInput({
      facilityId: facility.id,
      title: "LOTO procedure",
      evidenceType: "loto_procedures",
      status: "accepted"
    }, org.id, user.id));
    const generated = generateReview({ facility, evidence: [evidence], now: new Date("2026-06-18T12:00:00Z") });
    await repo.saveApplicableRules(org.id, facility.id, generated.rulesPack.rulesPackId, generated.applicableRules);
    const review = await repo.createReview({
      organizationId: org.id,
      facilityId: facility.id,
      rulesPackId: generated.rulesPack.rulesPackId,
      country: generated.country,
      region: generated.region,
      readinessScore: generated.readinessScore,
      scoreExplanation: generated.scoreExplanation,
      summary: generated.summary,
      generatedByUserId: user.id,
      evidenceMatches: generated.evidenceMatches,
      gapRows: generated.gapRows,
      findings: generated.findings,
      actionPlan: generated.actionPlan
    });
    const packet = await repo.createAuditPacket({
      organizationId: org.id,
      facilityId: facility.id,
      reviewId: review.id,
      title: "Industrial Audit Readiness Packet",
      fileReference: "packet.pdf",
      generatedByUserId: user.id,
      country: facility.country,
      region: facility.region,
      rulesPackId: generated.rulesPack.rulesPackId,
      status: "generated"
    });
    await repo.logAudit({ organizationId: org.id, facilityId: facility.id, actorUserId: user.id, action: "packet.exported", entityType: "audit_packet", entityId: packet.id });

    await repo.close();
    const restarted = new PostgresRepository(process.env.TEST_DATABASE_URL);
    await restarted.init();
    try {
      const persistedFacility = await restarted.getFacility(org.id, facility.id);
      assert.equal(persistedFacility.id, facility.id);
      assert.equal(persistedFacility.selectedRulesPackId, generated.rulesPack.rulesPackId);
      assert.equal((await restarted.listEvidence(org.id, facility.id))[0].id, evidence.id);
      const persistedReview = await restarted.getReview(org.id, review.id);
      assert.equal(persistedReview.readinessScore, generated.readinessScore);
      assert.deepEqual(persistedReview.scoreExplanation, generated.scoreExplanation);
      assert.equal((await restarted.getGapRows(org.id, review.id)).length, generated.gapRows.length);
      assert.equal((await restarted.getActionItems(org.id, review.id)).length, generated.actionPlan.length);
      assert.ok((await restarted.getEvidenceMatches(org.id, facility.id)).some((match) => match.evidenceId === evidence.id));
      assert.equal((await restarted.listAuditPackets(org.id, facility.id))[0].id, packet.id);
      assert.ok((await restarted.listAuditLogs(org.id, facility.id)).some((entry) => entry.action === "packet.exported"));
    } finally {
      await restarted.close();
    }
  } finally {
    await repo.close();
  }
});
