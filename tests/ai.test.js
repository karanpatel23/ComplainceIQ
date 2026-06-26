import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createEvidenceAiProvider, extractEvidenceText, MockEvidenceAiProvider, OpenAiEvidenceProvider, validateEvidenceAiOutput } from "../packages/ai/src/index.js";
import { createEvidenceAiService } from "../apps/api/src/evidence-ai-service.js";
import { createPrivateStorage } from "../apps/api/src/storage.js";
import { FileRepository } from "../packages/db/src/file-repository.js";
import { parseEvidenceInput, parseFacilityInput } from "../packages/shared/src/index.js";
import { generateReview, getApplicableRules } from "../packages/rules/src/index.js";

const aiConfig = {
  aiEnabled: true,
  aiProvider: "mock",
  aiMaxFileTextChars: 1_000,
  aiConfidenceThreshold: 0.8,
  aiReviewRequiredThreshold: 0.7,
  maxUploadMb: 1,
  uploadStorageBackend: "local"
};

test("AI providers validate taxonomy, JSON, confidence, and bounded extraction", async () => {
  assert.equal(createEvidenceAiProvider({ aiEnabled: false }).kind, "disabled");
  const applicableRules = [{ id: "rule-1", title: "Forklift training", requiredEvidenceTypes: ["forklift_training_records"] }];
  const mock = new MockEvidenceAiProvider(aiConfig, () => output({ suggestedRuleId: "rule-1", suggestedObligationTitle: "Forklift training" }));
  const result = await mock.analyzeEvidenceDocument({ text: "forklift training", evidence: { title: "Certificate" }, facility: {}, applicableRules });
  assert.equal(result.detectedEvidenceType, "forklift_training_records");
  assert.equal(result.needsHumanReview, false);

  assert.throws(() => validateEvidenceAiOutput(output({ detectedEvidenceType: "invented_type" }), { applicableRules }), /detectedEvidenceType/);
  assert.throws(() => validateEvidenceAiOutput(output({ confidence: 1.2 }), { applicableRules }), /confidence/);
  const low = validateEvidenceAiOutput(output({ confidence: 0.4, needsHumanReview: false }), { applicableRules, reviewRequiredThreshold: 0.7 });
  assert.equal(low.needsHumanReview, true);

  const openai = new OpenAiEvidenceProvider({
    openAiApiKey: "test-key",
    openAiModel: "test-model",
    aiReviewRequiredThreshold: 0.7
  }, async () => ({ ok: true, status: 200, json: async () => ({ output_text: "not-json" }) }));
  await assert.rejects(() => openai.analyzeEvidenceDocument({ text: "text", evidence: {}, facility: {}, applicableRules }), /not valid JSON/);

  const extracted = await extractEvidenceText({ buffer: Buffer.from("a".repeat(100)), fileName: "record.txt", evidence: { title: "Record" }, maxChars: 20 });
  assert.equal(extracted.text.length, 20);
  assert.equal(extracted.truncated, true);
  const unsupported = await extractEvidenceText({ buffer: Buffer.from("%PDF"), fileName: "scan.pdf", evidence: { title: "Scan" }, maxChars: 100 });
  assert.equal(unsupported.textExtractionStatus, "extraction_failed");
});

test("AI processing is auditable and human override wins over AI and deterministic suggestions", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ciq-ai-"));
  const repo = new FileRepository(path.join(dir, "db.json"));
  await repo.init();
  const org = await repo.createOrganization({ name: "AI Tenant" });
  const reviewer = await repo.createUser({ organizationId: org.id, email: "reviewer@example.com", passwordHash: "hash", name: "Reviewer", role: "reviewer", isActive: true });
  let facility = await repo.createFacility(parseFacilityInput({
    name: "Plant A", country: "US", stateProvince: "OH", region: "OH", industry: "industrial_manufacturing",
    facilityType: "fabrication", employeeCount: 30, hazardProfile: { machinery: true, lockoutTagout: true, ppe: true }
  }, org.id));
  const applicable = getApplicableRules(facility);
  await repo.saveApplicableRules(org.id, facility.id, applicable.rulesPack.rulesPackId, applicable.rules);
  facility = await repo.getFacility(org.id, facility.id);
  const storage = createPrivateStorage({ ...aiConfig, uploadDir: path.join(dir, "private") });
  const saved = await storage.saveBuffer(Buffer.from("Lockout Tagout procedure 2025-01-01"), "loto.txt");
  const evidence = await repo.createEvidence(parseEvidenceInput({
    facilityId: facility.id,
    title: "Energy control procedure",
    evidenceType: "other",
    status: "pending",
    fileReference: saved.fileReference,
    fileName: "loto.txt",
    contentType: "text/plain",
    fileSizeBytes: 40,
    fileSha256: saved.sha256
  }, org.id, reviewer.id));
  const provider = new MockEvidenceAiProvider(aiConfig);
  const service = createEvidenceAiService({ config: aiConfig, repo, storage, provider });

  const job = await repo.enqueueProcessingJob({ organizationId: org.id, facilityId: facility.id, evidenceId: evidence.id, createdByUserId: reviewer.id, maxAttempts: 3 });
  const analysis = await service.processEvidence({ organizationId: org.id, evidenceId: evidence.id, userId: reviewer.id, processingJobId: job.id });
  assert.equal(analysis.processingStatus, "processed");
  assert.equal(analysis.detectedEvidenceType, "loto_procedures");
  assert.equal(analysis.needsHumanReview, false);
  assert.equal((await service.processEvidence({ organizationId: org.id, evidenceId: evidence.id, userId: reviewer.id, processingJobId: job.id })).id, analysis.id);
  assert.equal((await repo.getAiAnalysisHistory(org.id, evidence.id)).length, 1);

  const beforeReview = generateReview({ facility, evidence: [evidence], aiAnalyses: [analysis], now: new Date("2026-06-19T12:00:00Z") });
  assert.equal(beforeReview.gapRows.find((row) => row.ruleId === "us-loto-procedures").status, "missing");

  await service.reviewEvidence({ organizationId: org.id, evidenceId: evidence.id, reviewer, reviewInput: { action: "accept_ai", evidenceType: null, ruleId: null, notes: "Classification checked." } });
  await service.reviewEvidence({ organizationId: org.id, evidenceId: evidence.id, reviewer, reviewInput: { action: "mark_accepted", evidenceType: null, ruleId: null, notes: "Evidence accepted." } });
  let reviewedEvidence = await repo.getEvidence(org.id, evidence.id);
  let reviewedAnalysis = await repo.getAiAnalysis(org.id, evidence.id);
  const accepted = generateReview({ facility, evidence: [reviewedEvidence], aiAnalyses: [reviewedAnalysis], now: new Date("2026-06-19T12:00:00Z") });
  const acceptedLoto = accepted.gapRows.find((row) => row.ruleId === "us-loto-procedures");
  assert.equal(acceptedLoto.status, "accepted");
  assert.equal(acceptedLoto.matchedEvidence[0].matchSource, "human_reviewed");

  await service.reviewEvidence({
    organizationId: org.id,
    evidenceId: evidence.id,
    reviewer,
    reviewInput: { action: "override", evidenceType: "ppe_training_records", ruleId: "us-ppe-training", notes: "Document is PPE training, not LOTO." }
  });
  reviewedEvidence = await repo.getEvidence(org.id, evidence.id);
  reviewedAnalysis = await repo.getAiAnalysis(org.id, evidence.id);
  const overridden = generateReview({ facility, evidence: [reviewedEvidence], aiAnalyses: [reviewedAnalysis], now: new Date("2026-06-19T12:00:00Z") });
  assert.equal(overridden.gapRows.find((row) => row.ruleId === "us-loto-procedures").status, "missing");
  assert.equal(overridden.gapRows.find((row) => row.ruleId === "us-ppe-training").status, "accepted");

  await service.reviewEvidence({ organizationId: org.id, evidenceId: evidence.id, reviewer, reviewInput: { action: "request_more_evidence", evidenceType: null, ruleId: null, notes: "Provide the signed roster." } });
  assert.equal((await repo.getEvidence(org.id, evidence.id)).status, "needs_review");

  const logs = await repo.listAuditLogs(org.id, facility.id);
  assert.ok(logs.some((entry) => entry.action === "evidence_processing_started"));
  assert.ok(logs.some((entry) => entry.action === "ai_match_suggested"));
  assert.ok(logs.some((entry) => entry.action === "human_accepted_ai_result"));
  assert.ok(logs.some((entry) => entry.action === "human_overrode_evidence_type"));
  assert.ok(logs.some((entry) => entry.action === "human_overrode_rule_match" && entry.metadata.overrideRuleId === "us-ppe-training"));
  assert.ok(logs.some((entry) => entry.action === "human_requested_more_evidence"));

  const otherOrg = await repo.createOrganization({ name: "Other Tenant" });
  await assert.rejects(() => repo.getAiAnalysis(otherOrg.id, evidence.id), /another organization/);
});

test("medium confidence requires review and invalid provider output is persisted as failure", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "ciq-ai-failure-"));
  const repo = new FileRepository(path.join(dir, "db.json"));
  await repo.init();
  const org = await repo.createOrganization({ name: "Failure Tenant" });
  const user = await repo.createUser({ organizationId: org.id, email: "admin@example.com", passwordHash: "hash", name: "Admin", role: "admin", isActive: true });
  let facility = await repo.createFacility(parseFacilityInput({
    name: "Plant", country: "US", stateProvince: "MI", region: "MI", industry: "industrial_manufacturing",
    facilityType: "fabrication", employeeCount: 10, hazardProfile: { machinery: true, lockoutTagout: true }
  }, org.id));
  const applicable = getApplicableRules(facility);
  await repo.saveApplicableRules(org.id, facility.id, applicable.rulesPack.rulesPackId, applicable.rules);
  facility = await repo.getFacility(org.id, facility.id);
  const storage = createPrivateStorage({ ...aiConfig, uploadDir: path.join(dir, "private") });
  const saved = await storage.saveBuffer(Buffer.from("Lockout procedure"), "record.txt");
  const evidence = await repo.createEvidence(parseEvidenceInput({ facilityId: facility.id, title: "Record", evidenceType: "other", fileReference: saved.fileReference, fileName: "record.txt" }, org.id, user.id));
  const lotoRule = applicable.rules.find((rule) => rule.id === "us-loto-procedures");

  const disabledService = createEvidenceAiService({
    config: { ...aiConfig, aiEnabled: false },
    repo,
    storage,
    provider: createEvidenceAiProvider({ aiEnabled: false })
  });
  const disabledAnalysis = await disabledService.processEvidence({ organizationId: org.id, evidenceId: evidence.id, userId: user.id });
  assert.equal(disabledAnalysis.processingStatus, "needs_review");
  assert.match(disabledAnalysis.error, /disabled/i);

  const mediumProvider = new MockEvidenceAiProvider(aiConfig, () => output({ detectedEvidenceType: "loto_procedures", confidence: 0.75, suggestedRuleId: lotoRule.id, suggestedObligationTitle: lotoRule.title }));
  const mediumService = createEvidenceAiService({ config: aiConfig, repo, storage, provider: mediumProvider });
  assert.equal((await mediumService.processEvidence({ organizationId: org.id, evidenceId: evidence.id, userId: user.id })).needsHumanReview, true);

  const invalidProvider = new MockEvidenceAiProvider(aiConfig, () => output({ detectedEvidenceType: "invented" }));
  const invalidService = createEvidenceAiService({ config: aiConfig, repo, storage, provider: invalidProvider });
  await assert.rejects(() => invalidService.processEvidence({ organizationId: org.id, evidenceId: evidence.id, userId: user.id }), /detectedEvidenceType/);
  assert.equal((await repo.getAiAnalysis(org.id, evidence.id)).processingStatus, "failed");
  const history = await repo.getAiAnalysisHistory(org.id, evidence.id);
  assert.deepEqual(history.map((item) => item.analysisVersion), [3, 2, 1]);
  assert.equal(history[0].isCurrent, true);
  assert.equal(history[1].isCurrent, false);
  assert.ok((await repo.listAuditLogs(org.id, facility.id)).some((entry) => entry.action === "ai_output_rejected_invalid_schema"));
});

function output(overrides = {}) {
  return {
    detectedEvidenceType: "forklift_training_records",
    detectedTitle: "Forklift Operator Training Certificate",
    summary: "Likely powered industrial truck training evidence.",
    documentDate: "2025-03-14",
    expirationDate: "2028-03-14",
    facilityName: null,
    employeeNames: [],
    equipmentNames: ["Forklift"],
    chemicalNames: [],
    signaturePresent: true,
    authorityMentions: [],
    citationMentions: [],
    issues: [],
    confidence: 0.88,
    needsHumanReview: false,
    suggestedRuleId: null,
    suggestedObligationTitle: null,
    matchReason: null,
    missingFieldsOrIssues: [],
    ...overrides
  };
}
