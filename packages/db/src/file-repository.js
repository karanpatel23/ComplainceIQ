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
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.data = Object.fromEntries(TABLES.map((table) => [table, []]));
      await this.persist();
    }
    await this.seedRules();
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

  async getEvidence(organizationId, id) {
    return this.getScoped("evidence", organizationId, id, "Evidence");
  }

  async updateEvidence(organizationId, id, updates) {
    const row = await this.getEvidence(organizationId, id);
    Object.assign(row, updates, { updatedAt: nowIso() });
    await this.persist();
    return row;
  }

  async archiveEvidence(organizationId, id) {
    return this.updateEvidence(organizationId, id, { archived: true });
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
    const row = { id: input.id || this.createId(), generatedAt: nowIso(), ...input };
    this.data.auditPackets.push(row);
    await this.persist();
    return row;
  }

  async listAuditPackets(organizationId, facilityId = null) {
    return this.data.auditPackets.filter((row) => row.organizationId === organizationId && (!facilityId || row.facilityId === facilityId));
  }

  async getAuditPacket(organizationId, id) {
    return this.getScoped("auditPackets", organizationId, id, "Audit packet");
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

  async getScoped(table, organizationId, id, label) {
    const row = this.data[table].find((item) => item.id === id);
    if (!row) return null;
    if (row.organizationId !== organizationId) throw forbidden(`${label} belongs to another organization`);
    return row;
  }
}
