import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractEvidenceText, MockOcrProvider } from "../packages/ai/src/index.js";
import { generateAuditPacketPdf } from "../packages/pdf/src/index.js";
import { FileRepository } from "../packages/db/src/file-repository.js";
import { parseEvidenceInput, parseFacilityInput } from "../packages/shared/src/index.js";
import { LocalEvidenceProcessingQueue } from "../apps/api/src/processing-queue.js";
import { assertEvidenceDownloadAllowed, canProcessScannedEvidence, ClamAvMalwareScanner, MockMalwareScanner } from "../apps/api/src/malware-scanner.js";
import { createReviewQueueService } from "../apps/api/src/review-queue-service.js";

test("local queue is idempotent and retries failed jobs within the configured bound", async () => {
  const { repo, org, user, facility } = await setupRepository("queue");
  const evidence = await repo.createEvidence(parseEvidenceInput({
    facilityId: facility.id,
    title: "Queued record",
    evidenceType: "loto_procedures",
    scanStatus: "scan_clean"
  }, org.id, user.id));
  let calls = 0;
  const queue = new LocalEvidenceProcessingQueue({
    repo,
    autoStart: false,
    retryBaseMs: 50,
    maxRetries: 3,
    processor: async () => {
      calls += 1;
      if (calls === 1) throw new Error("temporary provider failure");
      return { id: "analysis-1" };
    }
  });

  const first = await queue.enqueue({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id, createdByUserId: user.id });
  const duplicate = await queue.enqueue({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id, createdByUserId: user.id });
  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.duplicate, true);

  await queue.drain();
  let job = await repo.getProcessingJob(org.id, first.id);
  assert.equal(job.status, "queued");
  assert.equal(job.processingAttempts, 1);
  assert.match(job.lastProcessingError, /temporary provider failure/);
  await new Promise((resolve) => setTimeout(resolve, 60));
  await queue.drain();
  job = await repo.getProcessingJob(org.id, first.id);
  assert.equal(job.status, "completed");
  assert.equal(job.processingAttempts, 2);
  assert.equal(calls, 2);
});

test("worker leases heartbeat, recover stale jobs, and reject stale completion", async () => {
  const { repo, org, user, facility } = await setupRepository("leases");
  const evidence = await repo.createEvidence(parseEvidenceInput({ facilityId: facility.id, title: "Lease record", evidenceType: "other", scanStatus: "scan_clean" }, org.id, user.id));
  await repo.enqueueProcessingJob({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id, createdByUserId: user.id, maxAttempts: 3 });
  const first = await repo.claimNextProcessingJob({ workerId: "worker-a", leaseToken: "lease-a", leaseExpiresAt: new Date(Date.now() - 1_000).toISOString() });
  const recovered = await repo.recoverStaleProcessingJobs(new Date().toISOString());
  assert.equal(recovered[0].status, "queued");
  const second = await repo.claimNextProcessingJob({ workerId: "worker-b", leaseToken: "lease-b", leaseExpiresAt: new Date(Date.now() + 60_000).toISOString() });
  assert.equal(second.id, first.id);
  await assert.rejects(() => repo.completeProcessingJob(org.id, first.id, first.leaseToken), (error) => error.code === "JOB_LEASE_LOST");
  await repo.heartbeatProcessingJob(org.id, second.id, { leaseToken: second.leaseToken, leaseExpiresAt: new Date(Date.now() + 120_000).toISOString() });
  assert.ok((await repo.getProcessingJob(org.id, second.id)).heartbeatAt);
  assert.equal((await repo.completeProcessingJob(org.id, second.id, second.leaseToken)).status, "completed");
});

test("expired final-attempt jobs enter dead letter and two workers do not process one job twice", async () => {
  const { repo, org, user, facility } = await setupRepository("dead-letter");
  const evidence = await repo.createEvidence(parseEvidenceInput({ facilityId: facility.id, title: "Dead-letter record", evidenceType: "other", scanStatus: "scan_clean" }, org.id, user.id));
  await repo.enqueueProcessingJob({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id, createdByUserId: user.id, maxAttempts: 1 });
  await repo.claimNextProcessingJob({ workerId: "worker-a", leaseToken: "lease-final", leaseExpiresAt: new Date(Date.now() - 1_000).toISOString() });
  assert.equal((await repo.recoverStaleProcessingJobs(new Date().toISOString()))[0].status, "dead_letter");

  const secondEvidence = await repo.createEvidence(parseEvidenceInput({ facilityId: facility.id, title: "Concurrent record", evidenceType: "other", scanStatus: "scan_clean" }, org.id, user.id));
  let calls = 0;
  const processor = async () => { calls += 1; return { id: "analysis-concurrent" }; };
  const queueA = new LocalEvidenceProcessingQueue({ repo, processor, autoStart: false, workerId: "queue-a" });
  const queueB = new LocalEvidenceProcessingQueue({ repo, processor, autoStart: false, workerId: "queue-b" });
  await queueA.enqueue({ organizationId: org.id, facilityId: facility.id, evidenceId: secondEvidence.id, createdByUserId: user.id });
  await Promise.all([queueA.drain(), queueB.drain()]);
  assert.equal(calls, 1);
  assert.equal((await repo.listProcessingJobs(org.id, facility.id)).find((job) => job.evidenceId === secondEvidence.id).status, "completed");
});

test("graceful queue shutdown waits for active work", async () => {
  const { repo, org, user, facility } = await setupRepository("shutdown");
  const evidence = await repo.createEvidence(parseEvidenceInput({ facilityId: facility.id, title: "Shutdown record", evidenceType: "other", scanStatus: "scan_clean" }, org.id, user.id));
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const queue = new LocalEvidenceProcessingQueue({ repo, autoStart: false, workerId: "shutdown-worker", heartbeatMs: 5, leaseMs: 50, processor: async () => { await gate; return { id: "analysis-shutdown" }; } });
  await queue.enqueue({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id, createdByUserId: user.id });
  const drain = queue.drain();
  await new Promise((resolve) => setTimeout(resolve, 15));
  const running = await repo.listProcessingJobs(org.id, facility.id);
  assert.equal(running[0].status, "processing");
  assert.ok(running[0].heartbeatAt);
  const stopping = queue.stop({ timeoutMs: 500 });
  release();
  assert.equal((await stopping).drained, true);
  await drain;
  assert.equal((await repo.getProcessingJob(org.id, running[0].id)).status, "completed");
});

test("PDF extraction succeeds, truncates safely, and corrupt or scanned files fail safely", async () => {
  const pdf = generateAuditPacketPdf(packetFixture());
  const extracted = await extractEvidenceText({ buffer: pdf, fileName: "packet.pdf", evidence: { title: "Packet" }, maxChars: 180, maxBytes: 1_000_000 });
  assert.equal(extracted.textExtractionStatus, "extracted");
  assert.equal(extracted.text.length, 180);
  assert.equal(extracted.truncated, true);

  const corrupt = await extractEvidenceText({ buffer: Buffer.from("%PDF-corrupt"), fileName: "broken.pdf", evidence: { title: "Broken" }, maxChars: 500, maxBytes: 1_000_000 });
  assert.equal(corrupt.textExtractionStatus, "extraction_failed");
  assert.match(corrupt.warning, /could not be read|corrupt/i);

  const image = await extractEvidenceText({ buffer: Buffer.from([137, 80, 78, 71]), fileName: "scan.png", evidence: { title: "Scan" }, maxChars: 500, maxBytes: 1_000_000 });
  assert.equal(image.textExtractionStatus, "ocr_required");
  const ocr = new MockOcrProvider(() => ({ text: "Forklift training scan", confidence: 0.8, issues: [] }));
  assert.equal((await ocr.extractTextFromImage({ buffer: Buffer.from("image") })).text, "Forklift training scan");
});

test("malware scanning supports clean processing and blocks suspicious downloads", async () => {
  const cleanScanner = new MockMalwareScanner(() => ({ status: "scan_clean" }));
  const clean = await cleanScanner.scanBuffer({ buffer: Buffer.from("safe") });
  assert.equal(clean.status, "scan_clean");
  assert.equal(canProcessScannedEvidence({ scanStatus: clean.status }, { isProduction: true }), true);

  const suspiciousScanner = new MockMalwareScanner(() => ({ status: "scan_suspicious", error: "test signature" }));
  const suspicious = await suspiciousScanner.scanBuffer({ buffer: Buffer.from("unsafe") });
  assert.equal(suspicious.status, "scan_suspicious");
  assert.throws(() => assertEvidenceDownloadAllowed({ scanStatus: suspicious.status }), /blocked/);
  assert.throws(() => assertEvidenceDownloadAllowed({ scanStatus: "scan_failed", fileReference: "private/file.txt" }, { malwareScanFailPolicy: "closed" }), (error) => error.code === "FILE_BLOCKED_SCAN_INCOMPLETE");
  assert.equal(canProcessScannedEvidence({ scanStatus: "scan_unavailable" }, { isProduction: false, malwareScanRequiredInProduction: false }), true);
  assert.equal(canProcessScannedEvidence({ scanStatus: "scan_unavailable" }, { isProduction: true, malwareScanRequiredInProduction: false }), false);
  assert.equal(canProcessScannedEvidence({ scanStatus: "scan_failed" }, { malwareScanFailPolicy: "open", malwareScanRequiredInProduction: false }), true);
  assert.equal(canProcessScannedEvidence({ scanStatus: "scan_failed" }, { malwareScanFailPolicy: "closed", malwareScanRequiredInProduction: false }), false);
});

test("ClamAV adapter maps clean, suspicious, failure, and timeout-style provider errors", async () => {
  const clean = new ClamAvMalwareScanner({ host: "scanner", port: 3310, timeoutMs: 50, transport: async () => "stream: OK" });
  assert.equal((await clean.scanBuffer({ buffer: Buffer.from("safe") })).status, "scan_clean");
  const suspicious = new ClamAvMalwareScanner({ host: "scanner", port: 3310, timeoutMs: 50, transport: async () => "stream: Eicar-Test-Signature FOUND" });
  assert.equal((await suspicious.scanBuffer({ buffer: Buffer.from("unsafe") })).status, "scan_suspicious");
  const failed = new ClamAvMalwareScanner({ host: "scanner", port: 3310, timeoutMs: 50, transport: async () => { const error = new Error("timeout"); error.code = "MALWARE_SCANNER_TIMEOUT"; throw error; } });
  await assert.rejects(() => failed.scanBuffer({ buffer: Buffer.from("unknown") }), (error) => error.code === "MALWARE_SCANNER_TIMEOUT");
});

test("review queue filters by tenant, facility, status, and priority impact", async () => {
  const { repo, org, user, facility } = await setupRepository("review");
  const evidence = await repo.createEvidence(parseEvidenceInput({
    facilityId: facility.id,
    title: "Unreviewed LOTO procedure",
    evidenceType: "other",
    status: "needs_review",
    scanStatus: "scan_clean"
  }, org.id, user.id));
  await repo.upsertAiAnalysis(analysisFixture({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id }));
  const other = await setupRepository("other", repo);
  await repo.createEvidence(parseEvidenceInput({ facilityId: other.facility.id, title: "Other tenant", evidenceType: "other" }, other.org.id, other.user.id));

  const service = createReviewQueueService({ repo });
  const high = await service.list({ organizationId: org.id, facilityId: facility.id, status: "needs_review", priority: "critical" });
  assert.equal(high.length, 1);
  assert.equal(high[0].evidenceTitle, "Unreviewed LOTO procedure");
  assert.equal(high[0].suggestedRuleId, "us-loto-procedures");
  assert.ok(high[0].categories.includes("high_priority_impact"));
  assert.equal((await service.list({ organizationId: other.org.id })).some((item) => item.id === evidence.id), false);
});

async function setupRepository(label, existingRepo = null) {
  const dir = await mkdtemp(path.join(os.tmpdir(), `ciq-${label}-`));
  const repo = existingRepo || new FileRepository(path.join(dir, "db.json"));
  if (!existingRepo) await repo.init();
  const org = await repo.createOrganization({ name: `${label} tenant` });
  const user = await repo.createUser({ organizationId: org.id, email: `${label}-${Date.now()}@example.com`, passwordHash: "hash", name: "Reviewer", role: "reviewer", isActive: true });
  const facility = await repo.createFacility(parseFacilityInput({
    name: `${label} plant`, country: "US", stateProvince: "OH", region: "OH", industry: "industrial_manufacturing",
    facilityType: "fabrication", employeeCount: 20, hazardProfile: { machinery: true, lockoutTagout: true }
  }, org.id));
  return { repo, org, user, facility };
}

function analysisFixture(overrides) {
  return {
    ...overrides,
    reviewId: null,
    processingStatus: "needs_review",
    textExtractionStatus: "extracted",
    detectedEvidenceType: "loto_procedures",
    detectedTitle: "LOTO procedure",
    extractedDocumentDate: null,
    extractedExpirationDate: null,
    extractedFacilityName: null,
    extractedEmployeeNames: [],
    extractedEquipmentNames: [],
    extractedChemicalNames: [],
    extractedSignaturePresent: null,
    extractedAuthorityMentions: [],
    extractedCitationMentions: [],
    summary: "Likely LOTO procedure.",
    issues: ["Human review required."],
    suggestedRuleId: "us-loto-procedures",
    suggestedObligationTitle: "Lockout/Tagout written procedures",
    matchReason: "Type agreement",
    missingFieldsOrIssues: [],
    confidence: 0.75,
    needsHumanReview: true,
    provider: "mock",
    model: "mock-evidence-v1",
    promptVersion: "evidence-intelligence-v1",
    rawModelOutputReference: null,
    error: null,
    humanReviewed: false,
    humanAcceptedAiResult: false,
    humanReviewerId: null,
    humanReviewedAt: null,
    humanOverrideEvidenceType: null,
    humanOverrideRuleId: null,
    humanReviewNotes: null
  };
}

function packetFixture() {
  return {
    facility: { name: "Plant", country: "US", region: "OH", industry: "manufacturing", facilityType: "plant", employeeCount: 10, hazardProfile: {} },
    review: { readinessScore: 100, scoreExplanation: [], summary: { totalApplicableObligations: 0, missingEvidenceCount: 0, criticalGapsCount: 0, demoRulesCount: 0 } },
    gapRows: [],
    actionItems: [],
    evidence: [],
    rulesPack: { name: "Starter", rulesPackId: "starter" },
    findings: [],
    aiAnalyses: []
  };
}
