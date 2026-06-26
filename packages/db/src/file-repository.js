import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { RULES_PACKS, COMPLIANCE_RULES } from "../../rules/src/index.js";
import { forbidden } from "../../shared/src/index.js";
import { nowIso } from "./time.js";

const TABLES = [
  "organizations",
  "users",
  "sessions",
  "rulesPacks",
  "complianceRules",
  "facilities",
  "facilityApplicableRules",
  "evidence",
  "processingJobs",
  "evidenceAiAnalyses",
  "evidenceMatches",
  "reviews",
  "gapRows",
  "findings",
  "actionItems",
  "auditPackets",
  "expertReviews",
  "auditLogs"
];

export class FileRepository {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
    this.data = Object.fromEntries(TABLES.map((table) => [table, []]));
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.data = JSON.parse(await readFile(this.filePath, "utf8"));
      for (const table of TABLES) {
        if (!Array.isArray(this.data[table])) this.data[table] = [];
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.data = Object.fromEntries(TABLES.map((table) => [table, []]));
      await this.persist();
    }
    this.normalizeLegacyData();
    await this.seedRules();
  }

  normalizeLegacyData() {
    for (const evidence of this.data.evidence) {
      if (!evidence.scanStatus) evidence.scanStatus = "scan_unavailable";
      evidence.fileValidationStatus ||= evidence.fileReference ? "legacy_unverified" : "not_applicable";
      evidence.storageDeletionStatus ||= evidence.fileReference ? "retained" : "not_applicable";
    }
    for (const packet of this.data.auditPackets) {
      packet.archived ??= false;
      packet.storageDeletionStatus ||= packet.fileReference ? "retained" : "deleted";
    }
    for (const job of this.data.processingJobs) {
      job.workerId ??= null;
      job.leaseToken ??= null;
      job.leaseExpiresAt ??= null;
      job.heartbeatAt ??= null;
      job.deadLetteredAt ??= null;
    }
    const byEvidence = new Map();
    for (const analysis of this.data.evidenceAiAnalyses) {
      if (!byEvidence.has(analysis.evidenceId)) byEvidence.set(analysis.evidenceId, []);
      byEvidence.get(analysis.evidenceId).push(analysis);
    }
    for (const analyses of byEvidence.values()) {
      analyses.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
      analyses.forEach((analysis, index) => {
        analysis.analysisVersion ||= index + 1;
        analysis.previousAnalysisId ??= index > 0 ? analyses[index - 1].id : null;
        analysis.createdByType ||= "system";
        analysis.isCurrent = index === analyses.length - 1;
      });
    }
  }

  async persist() {
    const temporaryPath = `${this.filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }

  async healthCheck() {
    await readFile(this.filePath, "utf8");
    return { ok: true, backend: "file" };
  }

  async seedRules() {
    this.data.rulesPacks = RULES_PACKS;
    this.data.complianceRules = COMPLIANCE_RULES;
    await this.persist();
  }

  createId() {
    return randomUUID();
  }

  async createOrganization(input) {
    const row = { id: input.id || this.createId(), name: input.name, createdAt: nowIso(), updatedAt: nowIso() };
    this.data.organizations.push(row);
    await this.persist();
    return row;
  }

  async getOrganization(id) {
    return this.data.organizations.find((row) => row.id === id) || null;
  }

  async findOrganizationByName(name) {
    return this.data.organizations.find((row) => row.name.toLowerCase() === name.toLowerCase()) || null;
  }

  async createUser(input) {
    const row = { id: input.id || this.createId(), isActive: true, createdAt: nowIso(), updatedAt: nowIso(), ...input };
    this.data.users.push(row);
    await this.persist();
    return row;
  }

  async findUserByEmail(email) {
    return this.data.users.find((row) => row.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async findUserById(id) {
    return this.data.users.find((row) => row.id === id) || null;
  }

  async listUsersByOrganization(organizationId) {
    return this.data.users.filter((row) => row.organizationId === organizationId);
  }

  async createSession(input) {
    const user = await this.findUserById(input.userId);
    if (!user || user.organizationId !== input.organizationId) throw forbidden("User does not belong to this organization");
    this.data.sessions = this.data.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
    const row = { id: input.id || this.createId(), createdAt: nowIso(), ...input };
    this.data.sessions.push(row);
    await this.persist();
    return row;
  }

  async getSession(id) {
    const row = this.data.sessions.find((session) => session.id === id);
    if (!row) return null;
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      await this.deleteSession(id);
      return null;
    }
    return row;
  }

  async deleteSession(id) {
    this.data.sessions = this.data.sessions.filter((session) => session.id !== id);
    await this.persist();
  }

  async createFacility(input) {
    const row = { id: input.id || this.createId(), selectedRulesPackId: null, createdAt: nowIso(), updatedAt: nowIso(), ...input };
    this.data.facilities.push(row);
    await this.persist();
    return row;
  }

  async listFacilities(organizationId) {
    return this.data.facilities.filter((row) => row.organizationId === organizationId && !row.archived);
  }

  async getFacility(organizationId, id) {
    return this.getScoped("facilities", organizationId, id, "Facility");
  }

  async updateFacility(organizationId, id, updates) {
    const row = await this.getFacility(organizationId, id);
    Object.assign(row, updates, { updatedAt: nowIso() });
    await this.persist();
    return row;
  }

  async archiveFacility(organizationId, id) {
    return this.updateFacility(organizationId, id, { archived: true });
  }

  async createEvidence(input) {
    await this.getFacility(input.organizationId, input.facilityId);
    if (input.uploadedByUserId) {
      const user = await this.findUserById(input.uploadedByUserId);
      if (!user || user.organizationId !== input.organizationId) throw forbidden("Uploader does not belong to this organization");
    }
    const row = { id: input.id || this.createId(), createdAt: nowIso(), updatedAt: nowIso(), ...input };
    this.data.evidence.push(row);
    await this.persist();
    return row;
  }

  async listEvidence(organizationId, facilityId) {
    return this.data.evidence.filter((row) => row.organizationId === organizationId && row.facilityId === facilityId && !row.archived);
  }

  async listOrganizationEvidence(organizationId) {
    return this.data.evidence.filter((row) => row.organizationId === organizationId && !row.archived);
  }

  async getEvidence(organizationId, id) {
    return this.getScoped("evidence", organizationId, id, "Evidence");
  }

  async updateEvidence(organizationId, id, updates) {
    const row = await this.getEvidence(organizationId, id);
    Object.assign(row, updates, { updatedAt: nowIso() });
    await this.persist();
    return row;
  }

  async archiveEvidence(organizationId, id, deletion = {}) {
    if (deletion.deletedByUserId) await this.assertUserOrganization(deletion.deletedByUserId, organizationId, "Deletion actor");
    return this.updateEvidence(organizationId, id, { archived: true, ...deletion });
  }

  async upsertAiAnalysis(input) {
    const evidence = await this.getEvidence(input.organizationId, input.evidenceId);
    if (evidence.facilityId !== input.facilityId) throw forbidden("AI analysis facility does not match the evidence facility");
    const existing = input.id
      ? this.data.evidenceAiAnalyses.find((row) => row.id === input.id)
      : input.processingJobId
        ? this.data.evidenceAiAnalyses.find((row) => row.processingJobId === input.processingJobId)
        : null;
    if (existing && existing.organizationId !== input.organizationId) throw forbidden("AI analysis belongs to another organization");
    if (existing) {
      Object.assign(existing, input, { id: existing.id, createdAt: existing.createdAt, updatedAt: nowIso() });
      await this.persist();
      return existing;
    }
    const previous = this.data.evidenceAiAnalyses
      .filter((row) => row.organizationId === input.organizationId && row.evidenceId === input.evidenceId)
      .sort((a, b) => (b.analysisVersion || 1) - (a.analysisVersion || 1))[0] || null;
    const row = {
      id: this.createId(),
      analysisVersion: (previous?.analysisVersion || 0) + 1,
      previousAnalysisId: previous?.id || null,
      createdByType: input.createdByType || "system",
      isCurrent: true,
      supersededAt: null,
      supersededById: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      ...input
    };
    if (previous) Object.assign(previous, { isCurrent: false, supersededAt: nowIso(), supersededById: row.id, updatedAt: nowIso() });
    this.data.evidenceAiAnalyses.push(row);
    await this.persist();
    return row;
  }

  async getAiAnalysis(organizationId, evidenceId) {
    await this.getEvidence(organizationId, evidenceId);
    return this.data.evidenceAiAnalyses
      .filter((row) => row.organizationId === organizationId && row.evidenceId === evidenceId)
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || (b.analysisVersion || 1) - (a.analysisVersion || 1))[0] || null;
  }

  async getAiAnalysisByJobId(organizationId, processingJobId) {
    const row = this.data.evidenceAiAnalyses.find((item) => item.processingJobId === processingJobId);
    if (!row) return null;
    if (row.organizationId !== organizationId) throw forbidden("AI analysis belongs to another organization");
    return row;
  }

  async getAiAnalysisHistory(organizationId, evidenceId) {
    await this.getEvidence(organizationId, evidenceId);
    return this.data.evidenceAiAnalyses
      .filter((row) => row.organizationId === organizationId && row.evidenceId === evidenceId)
      .sort((a, b) => (b.analysisVersion || 1) - (a.analysisVersion || 1));
  }

  async listAiAnalyses(organizationId, facilityId) {
    await this.getFacility(organizationId, facilityId);
    return this.data.evidenceAiAnalyses
      .filter((row) => row.organizationId === organizationId && row.facilityId === facilityId && row.isCurrent !== false)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listOrganizationAiAnalyses(organizationId) {
    return this.data.evidenceAiAnalyses
      .filter((row) => row.organizationId === organizationId && row.isCurrent !== false)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async enqueueProcessingJob(input) {
    const evidence = await this.getEvidence(input.organizationId, input.evidenceId);
    if (evidence.facilityId !== input.facilityId) throw forbidden("Processing job facility does not match evidence");
    const active = this.data.processingJobs.find((row) => row.organizationId === input.organizationId && row.evidenceId === input.evidenceId && ["queued", "processing"].includes(row.status));
    if (active) return { ...active, duplicate: true };
    const now = nowIso();
    const row = {
      id: input.id || this.createId(),
      organizationId: input.organizationId,
      facilityId: input.facilityId,
      evidenceId: input.evidenceId,
      status: "queued",
      processingAttempts: 0,
      maxAttempts: input.maxAttempts,
      lastProcessingError: null,
      processingStartedAt: null,
      processingCompletedAt: null,
      nextRetryAt: null,
      createdByUserId: input.createdByUserId || null,
      createdAt: now,
      updatedAt: now
    };
    this.data.processingJobs.push(row);
    await this.persist();
    return row;
  }

  async getProcessingJob(organizationId, id) {
    return this.getScoped("processingJobs", organizationId, id, "Processing job");
  }

  async listProcessingJobs(organizationId, facilityId = null) {
    if (facilityId) await this.getFacility(organizationId, facilityId);
    return this.data.processingJobs
      .filter((row) => row.organizationId === organizationId && (!facilityId || row.facilityId === facilityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async claimNextProcessingJob({ workerId = `worker-${process.pid}`, leaseToken = this.createId(), leaseExpiresAt = new Date(Date.now() + 300_000).toISOString() } = {}) {
    const now = Date.now();
    const job = this.data.processingJobs
      .filter((row) => row.status === "queued" && (!row.nextRetryAt || new Date(row.nextRetryAt).getTime() <= now))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!job) return null;
    Object.assign(job, {
      status: "processing",
      processingAttempts: job.processingAttempts + 1,
      processingStartedAt: nowIso(),
      nextRetryAt: null,
      workerId,
      leaseToken,
      leaseExpiresAt,
      heartbeatAt: nowIso(),
      updatedAt: nowIso()
    });
    await this.persist();
    return { ...job };
  }

  async heartbeatProcessingJob(organizationId, id, { leaseToken, leaseExpiresAt }) {
    const job = await this.getProcessingJob(organizationId, id);
    if (job.status !== "processing" || job.leaseToken !== leaseToken) throw leaseLostError(id);
    Object.assign(job, { heartbeatAt: nowIso(), leaseExpiresAt, updatedAt: nowIso() });
    await this.persist();
    return { ...job };
  }

  async recoverStaleProcessingJobs(expiredBefore = nowIso()) {
    let changed = false;
    const recovered = [];
    for (const job of this.data.processingJobs) {
      const leaseBoundary = job.leaseExpiresAt || job.processingStartedAt;
      if (job.status !== "processing" || !leaseBoundary || leaseBoundary >= expiredBefore) continue;
      job.status = job.processingAttempts < job.maxAttempts ? "queued" : "dead_letter";
      job.lastProcessingError = "Recovered after an expired worker lease.";
      job.nextRetryAt = null;
      job.processingCompletedAt = job.status === "dead_letter" ? nowIso() : null;
      job.deadLetteredAt = job.status === "dead_letter" ? nowIso() : null;
      job.workerId = null;
      job.leaseToken = null;
      job.leaseExpiresAt = null;
      job.heartbeatAt = null;
      job.updatedAt = nowIso();
      changed = true;
      recovered.push({ ...job });
    }
    if (changed) await this.persist();
    return recovered;
  }

  async completeProcessingJob(organizationId, id, leaseToken) {
    const job = await this.getProcessingJob(organizationId, id);
    if (job.status !== "processing" || job.leaseToken !== leaseToken) throw leaseLostError(id);
    Object.assign(job, { status: "completed", processingCompletedAt: nowIso(), lastProcessingError: null, workerId: null, leaseToken: null, leaseExpiresAt: null, heartbeatAt: null, updatedAt: nowIso() });
    await this.persist();
    return { ...job };
  }

  async failProcessingJob(organizationId, id, { error, retryAt = null, leaseToken }) {
    const job = await this.getProcessingJob(organizationId, id);
    if (job.status !== "processing" || job.leaseToken !== leaseToken) throw leaseLostError(id);
    Object.assign(job, {
      status: retryAt ? "queued" : "dead_letter",
      lastProcessingError: String(error || "Processing failed").slice(0, 500),
      nextRetryAt: retryAt,
      processingCompletedAt: retryAt ? null : nowIso(),
      deadLetteredAt: retryAt ? null : nowIso(),
      workerId: null,
      leaseToken: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      updatedAt: nowIso()
    });
    await this.persist();
    return { ...job };
  }

  async getProcessingQueueMetrics() {
    return this.data.processingJobs.reduce((metrics, job) => ({ ...metrics, [job.status]: (metrics[job.status] || 0) + 1 }), {});
  }

  async applyAiHumanReview(input) {
    const evidence = await this.getEvidence(input.organizationId, input.evidenceId);
    const analysis = await this.getAiAnalysis(input.organizationId, input.evidenceId);
    if (!analysis) return null;
    Object.assign(evidence, input.evidenceUpdates, { updatedAt: nowIso() });
    Object.assign(analysis, input.analysisUpdates, { updatedAt: nowIso() });
    this.data.auditLogs.push({
      id: this.createId(),
      organizationId: input.organizationId,
      facilityId: evidence.facilityId,
      actorUserId: input.reviewerId,
      action: input.auditAction,
      entityType: "evidence_ai_analysis",
      entityId: analysis.id,
      metadata: input.auditMetadata || {},
      createdAt: nowIso()
    });
    await this.persist();
    return { evidence, analysis };
  }

  async listRulesPacks() {
    return this.data.rulesPacks;
  }

  async getRulesPack(rulesPackId) {
    return this.data.rulesPacks.find((pack) => pack.rulesPackId === rulesPackId) || null;
  }

  async listComplianceRules(filters = {}) {
    return this.data.complianceRules.filter((rule) => {
      if (filters.country && rule.country !== filters.country) return false;
      if (filters.rulesPackId && rule.rulesPackId !== filters.rulesPackId) return false;
      if (filters.region && rule.region !== filters.region) return false;
      if (filters.industry) {
        const pack = this.data.rulesPacks.find((item) => item.rulesPackId === rule.rulesPackId);
        if (pack?.industry !== filters.industry) return false;
      }
      return true;
    });
  }

  async saveApplicableRules(organizationId, facilityId, rulesPackId, rules) {
    const facility = await this.getFacility(organizationId, facilityId);
    if (rules.some((rule) => rule.rulesPackId !== rulesPackId)) throw forbidden("Applicable rule does not belong to the selected rules pack");
    facility.selectedRulesPackId = rulesPackId;
    facility.updatedAt = nowIso();
    this.data.facilityApplicableRules = this.data.facilityApplicableRules.filter((row) => row.organizationId !== organizationId || row.facilityId !== facilityId);
    for (const rule of rules) {
      this.data.facilityApplicableRules.push({
        id: this.createId(),
        organizationId,
        facilityId,
        ruleId: rule.id,
        rulesPackId,
        createdAt: nowIso()
      });
    }
    await this.persist();
  }

  async createReview(input) {
    const facility = await this.getFacility(input.organizationId, input.facilityId);
    if (facility.country !== input.country || facility.region !== input.region) {
      throw forbidden("Review jurisdiction does not match the facility jurisdiction");
    }
    if (facility.selectedRulesPackId && facility.selectedRulesPackId !== input.rulesPackId) {
      throw forbidden("Review rules pack does not match the facility rules pack");
    }
    const reviewId = input.id || this.createId();
    const review = {
      id: reviewId,
      organizationId: input.organizationId,
      facilityId: input.facilityId,
      rulesPackId: input.rulesPackId,
      country: input.country,
      region: input.region,
      readinessScore: input.readinessScore,
      scoreExplanation: input.scoreExplanation,
      summary: input.summary,
      generatedByUserId: input.generatedByUserId,
      createdAt: nowIso()
    };
    this.data.reviews.push(review);
    this.data.evidenceMatches = this.data.evidenceMatches.filter((row) => row.organizationId !== input.organizationId || row.facilityId !== input.facilityId);
    this.data.evidenceMatches.push(...(input.evidenceMatches || []).map((match) => ({
      id: this.createId(),
      organizationId: input.organizationId,
      facilityId: input.facilityId,
      ruleId: match.ruleId,
      evidenceId: match.evidenceId,
      matchType: match.matchType,
      confidence: match.confidence,
      createdAt: nowIso()
    })));
    this.data.gapRows.push(...input.gapRows.map((row) => ({ id: this.createId(), organizationId: input.organizationId, reviewId, facilityId: input.facilityId, ruleId: row.ruleId, rowData: row, status: row.status, priority: row.priority, createdAt: nowIso() })));
    this.data.findings.push(...input.findings.map((finding) => ({ ...finding, id: this.createId(), reviewId, createdAt: nowIso() })));
    this.data.actionItems.push(...input.actionPlan.map((item) => ({ id: this.createId(), organizationId: input.organizationId, reviewId, facilityId: input.facilityId, relatedObligationId: item.relatedObligationId, title: item.title, itemData: item, bucket: item.bucket, priority: item.priority, status: item.status, dueDate: item.dueDate, createdAt: nowIso(), updatedAt: nowIso() })));
    await this.persist();
    return review;
  }

  async listReviews(organizationId, facilityId = null) {
    return this.data.reviews
      .filter((row) => row.organizationId === organizationId && (!facilityId || row.facilityId === facilityId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getReview(organizationId, id) {
    return this.getScoped("reviews", organizationId, id, "Review");
  }

  async getGapRows(organizationId, reviewId) {
    await this.getReview(organizationId, reviewId);
    return this.data.gapRows.filter((row) => row.organizationId === organizationId && row.reviewId === reviewId).map((row) => row.rowData);
  }

  async getActionItems(organizationId, reviewId) {
    await this.getReview(organizationId, reviewId);
    return this.data.actionItems.filter((row) => row.organizationId === organizationId && row.reviewId === reviewId).map((row) => row.itemData);
  }

  async getEvidenceMatches(organizationId, facilityId) {
    await this.getFacility(organizationId, facilityId);
    return this.data.evidenceMatches.filter((row) => row.organizationId === organizationId && row.facilityId === facilityId);
  }

  async getFindings(organizationId, reviewId) {
    await this.getReview(organizationId, reviewId);
    return this.data.findings.filter((row) => row.organizationId === organizationId && row.reviewId === reviewId);
  }

  async createAuditPacket(input) {
    const facility = await this.getFacility(input.organizationId, input.facilityId);
    const review = await this.getReview(input.organizationId, input.reviewId);
    if (review.facilityId !== facility.id) throw forbidden("Review does not belong to this facility");
    if (input.rulesPackId !== review.rulesPackId) throw forbidden("Packet rules pack does not match the review rules pack");
    const row = { id: input.id || this.createId(), generatedAt: nowIso(), archived: false, storageDeletionStatus: "retained", ...input };
    this.data.auditPackets.push(row);
    await this.persist();
    return row;
  }

  async listAuditPackets(organizationId, facilityId = null) {
    return this.data.auditPackets.filter((row) => row.organizationId === organizationId && !row.archived && (!facilityId || row.facilityId === facilityId));
  }

  async getAuditPacket(organizationId, id) {
    return this.getScoped("auditPackets", organizationId, id, "Audit packet");
  }

  async archiveAuditPacket(organizationId, id, deletion = {}) {
    const row = await this.getAuditPacket(organizationId, id);
    if (deletion.deletedByUserId) await this.assertUserOrganization(deletion.deletedByUserId, organizationId, "Deletion actor");
    Object.assign(row, { archived: deletion.archived ?? true, ...deletion });
    if (row.storageDeletionStatus === "deleted") row.fileReference = null;
    await this.persist();
    return row;
  }

  async createExpertReview(input) {
    if (input.facilityId) await this.getFacility(input.organizationId, input.facilityId);
    if (input.reviewId) {
      const review = await this.getReview(input.organizationId, input.reviewId);
      if (input.facilityId && review.facilityId !== input.facilityId) throw forbidden("Review does not belong to this facility");
    }
    const row = { id: input.id || this.createId(), status: input.status || "requested", createdAt: nowIso(), updatedAt: nowIso(), ...input };
    this.data.expertReviews.push(row);
    await this.persist();
    return row;
  }

  async listExpertReviews(organizationId) {
    return this.data.expertReviews.filter((row) => row.organizationId === organizationId);
  }

  async updateExpertReview(organizationId, id, updates) {
    const row = await this.getScoped("expertReviews", organizationId, id, "Expert review");
    Object.assign(row, updates, { updatedAt: nowIso() });
    await this.persist();
    return row;
  }

  async logAudit(input) {
    const row = { id: input.id || this.createId(), metadata: {}, createdAt: nowIso(), ...input };
    this.data.auditLogs.push(row);
    await this.persist();
    return row;
  }

  async listAuditLogs(organizationId, facilityId = null) {
    return this.data.auditLogs.filter((row) => row.organizationId === organizationId && (!facilityId || row.facilityId === facilityId));
  }

  async assertUserOrganization(userId, organizationId, label = "User") {
    const user = await this.findUserById(userId);
    if (!user || user.organizationId !== organizationId) throw forbidden(`${label} does not belong to this organization`);
    return user;
  }

  async getScoped(table, organizationId, id, label) {
    const row = this.data[table].find((item) => item.id === id);
    if (!row) return null;
    if (row.organizationId !== organizationId) throw forbidden(`${label} belongs to another organization`);
    return row;
  }
}

function leaseLostError(id) {
  const error = new Error(`Processing job lease was lost for ${id}`);
  error.code = "JOB_LEASE_LOST";
  error.retryable = false;
  return error;
}
