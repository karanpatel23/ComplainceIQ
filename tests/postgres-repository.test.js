import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PostgresRepository } from "../packages/db/src/postgres-repository.js";
import { runMigrations } from "../packages/db/src/migration-runner.js";
import { createPostgresPool } from "../packages/db/src/postgres-pool.js";
import { loadMigrations } from "../packages/db/src/repository.js";
import { parseEvidenceInput, parseFacilityInput } from "../packages/shared/src/index.js";
import { generateReview } from "../packages/rules/src/index.js";
import { MockEvidenceAiProvider } from "../packages/ai/src/index.js";
import { createEvidenceAiService } from "../apps/api/src/evidence-ai-service.js";
import { createPrivateStorage } from "../apps/api/src/storage.js";

test("postgres repository persists facilities, evidence, reviews, matches, and packets", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const schema = `ciq_test_${randomUUID().replaceAll("-", "")}`;
  const adminPool = await createPostgresPool(process.env.TEST_DATABASE_URL);
  await adminPool.query(`CREATE SCHEMA "${schema}"`);
  const scopedUrl = new URL(process.env.TEST_DATABASE_URL);
  scopedUrl.searchParams.set("options", `-c search_path=${schema}`);
  const pool = await createPostgresPool(scopedUrl.toString());
  try {
    await runMigrations(pool, await loadMigrations());
  } finally {
    await pool.end();
  }

  const repo = new PostgresRepository(scopedUrl.toString());
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
    const storage = createPrivateStorage({ storageBackend: "local", uploadStorageBackend: "local", uploadDir: await mkdtemp(path.join(os.tmpdir(), "ciq-pg-storage-")), maxUploadMb: 1 });
    const saved = await storage.saveBuffer(Buffer.from("Lockout Tagout procedure 2026-01-01"), "loto.txt");
    const evidence = await repo.createEvidence(parseEvidenceInput({
      facilityId: facility.id,
      title: "LOTO procedure",
      evidenceType: "other",
      status: "pending",
      fileReference: saved.fileReference,
      fileName: "loto.txt",
      fileSha256: saved.sha256,
      scanStatus: "scan_clean"
    }, org.id, user.id));
    let generated = generateReview({ facility, evidence: [evidence], now: new Date("2026-06-18T12:00:00Z") });
    await repo.saveApplicableRules(org.id, facility.id, generated.rulesPack.rulesPackId, generated.applicableRules);
    const enqueuedJob = await repo.enqueueProcessingJob({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id, createdByUserId: user.id, maxAttempts: 3 });
    const job = await repo.claimNextProcessingJob({ workerId: "postgres-integration", leaseToken: randomUUID(), leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() });
    assert.equal(job.id, enqueuedJob.id);
    const aiConfig = { aiEnabled: true, aiProvider: "mock", aiMaxFileTextChars: 1_000, aiConfidenceThreshold: 0.8, aiReviewRequiredThreshold: 0.7, maxUploadMb: 1 };
    const service = createEvidenceAiService({ config: aiConfig, repo, storage, provider: new MockEvidenceAiProvider(aiConfig) });
    await service.processEvidence({ organizationId: org.id, evidenceId: evidence.id, userId: user.id, processingJobId: job.id });
    await repo.completeProcessingJob(org.id, job.id, job.leaseToken);
    await service.reviewEvidence({ organizationId: org.id, evidenceId: evidence.id, reviewer: user, reviewInput: { action: "accept_ai", evidenceType: null, ruleId: null, notes: "Reviewed." } });
    await service.reviewEvidence({ organizationId: org.id, evidenceId: evidence.id, reviewer: user, reviewInput: { action: "mark_accepted", evidenceType: null, ruleId: null, notes: "Accepted." } });
    const persistedEvidence = await repo.getEvidence(org.id, evidence.id);
    const persistedAnalysis = await repo.getAiAnalysis(org.id, evidence.id);
    generated = generateReview({ facility, evidence: [persistedEvidence], aiAnalyses: [persistedAnalysis], now: new Date("2026-06-18T12:00:00Z") });
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
    const restarted = new PostgresRepository(scopedUrl.toString());
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
      assert.equal((await restarted.getAiAnalysis(org.id, evidence.id)).detectedEvidenceType, "loto_procedures");
      assert.equal((await restarted.getAiAnalysisHistory(org.id, evidence.id))[0].analysisVersion, 1);
      assert.equal((await restarted.listProcessingJobs(org.id, facility.id))[0].status, "completed");
      assert.equal((await restarted.listAuditPackets(org.id, facility.id))[0].id, packet.id);
      assert.ok((await restarted.listAuditLogs(org.id, facility.id)).some((entry) => entry.action === "packet.exported"));
      const otherOrg = await restarted.createOrganization({ name: `Other ${suffix}` });
      await assert.rejects(() => restarted.getAiAnalysis(otherOrg.id, evidence.id), /another organization/);
    } finally {
      await restarted.close();
    }
  } finally {
    await repo.close();
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  }
});
