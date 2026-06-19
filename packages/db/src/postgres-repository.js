import { randomUUID } from "node:crypto";
import { RULES_PACKS, COMPLIANCE_RULES } from "../../rules/src/index.js";
import { forbidden } from "../../shared/src/index.js";
import { createPostgresPool } from "./postgres-pool.js";

export class PostgresRepository {
  constructor(databaseUrl) {
    this.databaseUrl = databaseUrl;
    this.pool = null;
  }

  async init() {
    this.pool = await createPostgresPool(this.databaseUrl);
    await this.seedRules();
  }

  createId() {
    return randomUUID();
  }

  async query(sql, params = []) {
    const result = await this.pool.query(sql, params);
    return result.rows;
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async healthCheck() {
    await this.query("SELECT 1");
    return { ok: true, backend: "postgres" };
  }

  async seedRules() {
    for (const pack of RULES_PACKS) {
      await this.query(
        `INSERT INTO rules_packs (rules_pack_id, name, country, region, industry, authority_scope, version, expert_reviewed, demo_content, last_updated_at, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (rules_pack_id) DO UPDATE SET
           name = EXCLUDED.name,
           country = EXCLUDED.country,
           region = EXCLUDED.region,
           industry = EXCLUDED.industry,
           authority_scope = EXCLUDED.authority_scope,
           version = EXCLUDED.version,
           expert_reviewed = EXCLUDED.expert_reviewed,
           demo_content = EXCLUDED.demo_content,
           last_updated_at = EXCLUDED.last_updated_at,
           description = EXCLUDED.description`,
        [pack.rulesPackId, pack.name, pack.country, pack.region, pack.industry, pack.authorityScope, pack.version, pack.expertReviewed, pack.demoContent, pack.lastUpdatedAt, pack.description]
      );
    }
    for (const rule of COMPLIANCE_RULES) {
      await this.query(
        `INSERT INTO compliance_rules (id, rules_pack_id, country, region, authority, citation, title, description, applicability_trigger, required_evidence_types, priority, owner_role, due_window_days, source_url, expert_reviewed, demo_content, last_reviewed_at, version)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
         ON CONFLICT (id) DO UPDATE SET
           rules_pack_id = EXCLUDED.rules_pack_id,
           country = EXCLUDED.country,
           region = EXCLUDED.region,
           authority = EXCLUDED.authority,
           citation = EXCLUDED.citation,
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           applicability_trigger = EXCLUDED.applicability_trigger,
           required_evidence_types = EXCLUDED.required_evidence_types,
           priority = EXCLUDED.priority,
           owner_role = EXCLUDED.owner_role,
           due_window_days = EXCLUDED.due_window_days,
           source_url = EXCLUDED.source_url,
           expert_reviewed = EXCLUDED.expert_reviewed,
           demo_content = EXCLUDED.demo_content,
           last_reviewed_at = EXCLUDED.last_reviewed_at,
           version = EXCLUDED.version`,
        [rule.id, rule.rulesPackId, rule.country, rule.region, rule.authority, rule.citation, rule.title, rule.description, JSON.stringify(rule.applicabilityTrigger), JSON.stringify(rule.requiredEvidenceTypes), rule.priority, rule.ownerRole, rule.dueWindowDays, rule.sourceUrl, rule.expertReviewed, rule.demoContent, rule.lastReviewedAt, rule.version]
      );
    }
  }

  async createOrganization(input) {
    const id = input.id || this.createId();
    const [row] = await this.query(
      "INSERT INTO organizations (id, name) VALUES ($1,$2) RETURNING *",
      [id, input.name]
    );
    return camelOrganization(row);
  }

  async getOrganization(id) {
    const [row] = await this.query("SELECT * FROM organizations WHERE id = $1", [id]);
    return row ? camelOrganization(row) : null;
  }

  async findOrganizationByName(name) {
    const [row] = await this.query("SELECT * FROM organizations WHERE lower(name) = lower($1)", [name]);
    return row ? camelOrganization(row) : null;
  }

  async createUser(input) {
    const id = input.id || this.createId();
    const [row] = await this.query(
      `INSERT INTO users (id, organization_id, email, password_hash, name, role, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [id, input.organizationId, input.email, input.passwordHash, input.name, input.role, input.isActive ?? true]
    );
    return camelUser(row);
  }

  async findUserByEmail(email) {
    const [row] = await this.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
    return row ? camelUser(row) : null;
  }

  async findUserById(id) {
    const [row] = await this.query("SELECT * FROM users WHERE id = $1", [id]);
    return row ? camelUser(row) : null;
  }

  async listUsersByOrganization(organizationId) {
    return (await this.query("SELECT * FROM users WHERE organization_id = $1 ORDER BY created_at", [organizationId])).map(camelUser);
  }

  async createSession(input) {
    const user = await this.findUserById(input.userId);
    if (!user || user.organizationId !== input.organizationId) throw forbidden("User does not belong to this organization");
    await this.query("DELETE FROM user_sessions WHERE expires_at <= now()");
    const id = input.id || this.createId();
    const [row] = await this.query(
      "INSERT INTO user_sessions (id, organization_id, user_id, expires_at) VALUES ($1,$2,$3,$4) RETURNING *",
      [id, input.organizationId, input.userId, input.expiresAt]
    );
    return camelSession(row);
  }

  async getSession(id) {
    const [row] = await this.query("SELECT * FROM user_sessions WHERE id = $1 AND expires_at > now()", [id]);
    return row ? camelSession(row) : null;
  }

  async deleteSession(id) {
    await this.query("DELETE FROM user_sessions WHERE id = $1", [id]);
  }

  async createFacility(input) {
    const id = input.id || this.createId();
    const [row] = await this.query(
      `INSERT INTO facilities (id, organization_id, name, country, state_province, region, jurisdiction_code, industry, facility_type, employee_count, hazard_profile, selected_rules_pack_id, archived)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [id, input.organizationId, input.name, input.country, input.stateProvince, input.region, input.jurisdictionCode, input.industry, input.facilityType, input.employeeCount, JSON.stringify(input.hazardProfile), input.selectedRulesPackId || null, input.archived ?? false]
    );
    return camelFacility(row);
  }

  async listFacilities(organizationId) {
    return (await this.query("SELECT * FROM facilities WHERE organization_id = $1 AND archived = false ORDER BY created_at DESC", [organizationId])).map(camelFacility);
  }

  async getFacility(organizationId, id) {
    return this.getScoped("facilities", organizationId, id, "Facility", camelFacility);
  }

  async updateFacility(organizationId, id, updates) {
    const current = await this.getFacility(organizationId, id);
    const next = { ...current, ...updates };
    const [row] = await this.query(
      `UPDATE facilities SET name=$3, country=$4, state_province=$5, region=$6, jurisdiction_code=$7, industry=$8, facility_type=$9, employee_count=$10, hazard_profile=$11, selected_rules_pack_id=$12, archived=$13, updated_at=now()
       WHERE organization_id=$1 AND id=$2 RETURNING *`,
      [organizationId, id, next.name, next.country, next.stateProvince, next.region, next.jurisdictionCode, next.industry, next.facilityType, next.employeeCount, JSON.stringify(next.hazardProfile), next.selectedRulesPackId || null, next.archived]
    );
    return camelFacility(row);
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
    const id = input.id || this.createId();
    const [row] = await this.query(
      `INSERT INTO evidence (id, organization_id, facility_id, title, description, evidence_type, file_reference, file_name, content_type, file_size_bytes, file_sha256, uploaded_by_user_id, country, region, related_obligation_id, document_date, expiration_date, status, confidence, reviewer_notes, archived)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING *`,
      [id, input.organizationId, input.facilityId, input.title, input.description, input.evidenceType, input.fileReference, input.fileName, input.contentType, input.fileSizeBytes, input.fileSha256, input.uploadedByUserId, input.country, input.region, input.relatedObligationId, input.documentDate, input.expirationDate, input.status, input.confidence, input.reviewerNotes, input.archived ?? false]
    );
    return camelEvidence(row);
  }

  async listEvidence(organizationId, facilityId) {
    return (await this.query("SELECT * FROM evidence WHERE organization_id = $1 AND facility_id = $2 AND archived = false ORDER BY created_at DESC", [organizationId, facilityId])).map(camelEvidence);
  }

  async getEvidence(organizationId, id) {
    return this.getScoped("evidence", organizationId, id, "Evidence", camelEvidence);
  }

  async updateEvidence(organizationId, id, updates) {
    const current = await this.getEvidence(organizationId, id);
    const next = { ...current, ...updates };
    const [row] = await this.query(
      `UPDATE evidence SET title=$3, description=$4, evidence_type=$5, file_reference=$6, file_name=$7, content_type=$8, file_size_bytes=$9, file_sha256=$10, country=$11, region=$12, related_obligation_id=$13, document_date=$14, expiration_date=$15, status=$16, confidence=$17, reviewer_notes=$18, archived=$19, updated_at=now()
       WHERE organization_id=$1 AND id=$2 RETURNING *`,
      [organizationId, id, next.title, next.description, next.evidenceType, next.fileReference, next.fileName, next.contentType, next.fileSizeBytes, next.fileSha256, next.country, next.region, next.relatedObligationId, next.documentDate, next.expirationDate, next.status, next.confidence, next.reviewerNotes, next.archived]
    );
    return camelEvidence(row);
  }

  async archiveEvidence(organizationId, id) {
    return this.updateEvidence(organizationId, id, { archived: true });
  }

  async upsertAiAnalysis(input) {
    const evidence = await this.getEvidence(input.organizationId, input.evidenceId);
    if (evidence.facilityId !== input.facilityId) throw forbidden("AI analysis facility does not match the evidence facility");
    const id = input.id || this.createId();
    const values = [
      id, input.organizationId, input.facilityId, input.evidenceId, input.reviewId, input.processingStatus,
      input.textExtractionStatus, input.detectedEvidenceType, input.detectedTitle, input.extractedDocumentDate,
      input.extractedExpirationDate, input.extractedFacilityName, JSON.stringify(input.extractedEmployeeNames || []),
      JSON.stringify(input.extractedEquipmentNames || []), JSON.stringify(input.extractedChemicalNames || []),
      input.extractedSignaturePresent, JSON.stringify(input.extractedAuthorityMentions || []),
      JSON.stringify(input.extractedCitationMentions || []), input.summary, JSON.stringify(input.issues || []),
      input.suggestedRuleId, input.suggestedObligationTitle, input.matchReason,
      JSON.stringify(input.missingFieldsOrIssues || []), input.confidence, input.needsHumanReview,
      input.provider, input.model, input.promptVersion, input.rawModelOutputReference, input.error,
      input.humanReviewed ?? false, input.humanAcceptedAiResult ?? false, input.humanReviewerId,
      input.humanReviewedAt, input.humanOverrideEvidenceType, input.humanOverrideRuleId, input.humanReviewNotes
    ];
    const [row] = await this.query(
      `INSERT INTO evidence_ai_analyses (
         id, organization_id, facility_id, evidence_id, review_id, processing_status, text_extraction_status,
         detected_evidence_type, detected_title, extracted_document_date, extracted_expiration_date,
         extracted_facility_name, extracted_employee_names, extracted_equipment_names, extracted_chemical_names,
         extracted_signature_present, extracted_authority_mentions, extracted_citation_mentions, summary, issues,
         suggested_rule_id, suggested_obligation_title, match_reason, missing_fields_or_issues, confidence,
         needs_human_review, provider, model, prompt_version, raw_model_output_reference, error, human_reviewed,
         human_accepted_ai_result, human_reviewer_id, human_reviewed_at, human_override_evidence_type,
         human_override_rule_id, human_review_notes
       ) VALUES (${values.map((_, index) => `$${index + 1}`).join(",")})
       ON CONFLICT (evidence_id) DO UPDATE SET
         review_id=EXCLUDED.review_id, processing_status=EXCLUDED.processing_status,
         text_extraction_status=EXCLUDED.text_extraction_status, detected_evidence_type=EXCLUDED.detected_evidence_type,
         detected_title=EXCLUDED.detected_title, extracted_document_date=EXCLUDED.extracted_document_date,
         extracted_expiration_date=EXCLUDED.extracted_expiration_date, extracted_facility_name=EXCLUDED.extracted_facility_name,
         extracted_employee_names=EXCLUDED.extracted_employee_names, extracted_equipment_names=EXCLUDED.extracted_equipment_names,
         extracted_chemical_names=EXCLUDED.extracted_chemical_names, extracted_signature_present=EXCLUDED.extracted_signature_present,
         extracted_authority_mentions=EXCLUDED.extracted_authority_mentions, extracted_citation_mentions=EXCLUDED.extracted_citation_mentions,
         summary=EXCLUDED.summary, issues=EXCLUDED.issues, suggested_rule_id=EXCLUDED.suggested_rule_id,
         suggested_obligation_title=EXCLUDED.suggested_obligation_title, match_reason=EXCLUDED.match_reason,
         missing_fields_or_issues=EXCLUDED.missing_fields_or_issues, confidence=EXCLUDED.confidence,
         needs_human_review=EXCLUDED.needs_human_review, provider=EXCLUDED.provider, model=EXCLUDED.model,
         prompt_version=EXCLUDED.prompt_version, raw_model_output_reference=EXCLUDED.raw_model_output_reference,
         error=EXCLUDED.error, human_reviewed=EXCLUDED.human_reviewed,
         human_accepted_ai_result=EXCLUDED.human_accepted_ai_result, human_reviewer_id=EXCLUDED.human_reviewer_id,
         human_reviewed_at=EXCLUDED.human_reviewed_at, human_override_evidence_type=EXCLUDED.human_override_evidence_type,
         human_override_rule_id=EXCLUDED.human_override_rule_id, human_review_notes=EXCLUDED.human_review_notes,
         updated_at=now()
       RETURNING *`,
      values
    );
    return camelAiAnalysis(row);
  }

  async getAiAnalysis(organizationId, evidenceId) {
    await this.getEvidence(organizationId, evidenceId);
    const [row] = await this.query("SELECT * FROM evidence_ai_analyses WHERE organization_id=$1 AND evidence_id=$2", [organizationId, evidenceId]);
    return row ? camelAiAnalysis(row) : null;
  }

  async listAiAnalyses(organizationId, facilityId) {
    await this.getFacility(organizationId, facilityId);
    return (await this.query(
      "SELECT * FROM evidence_ai_analyses WHERE organization_id=$1 AND facility_id=$2 ORDER BY updated_at DESC",
      [organizationId, facilityId]
    )).map(camelAiAnalysis);
  }

  async applyAiHumanReview(input) {
    const evidence = await this.getEvidence(input.organizationId, input.evidenceId);
    const analysis = await this.getAiAnalysis(input.organizationId, input.evidenceId);
    if (!analysis) return null;
    const nextEvidence = { ...evidence, ...input.evidenceUpdates };
    const nextAnalysis = { ...analysis, ...input.analysisUpdates };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const evidenceResult = await client.query(
        `UPDATE evidence SET evidence_type=$3, related_obligation_id=$4, document_date=$5, expiration_date=$6,
           status=$7, confidence=$8, reviewer_notes=$9, updated_at=now()
         WHERE organization_id=$1 AND id=$2 RETURNING *`,
        [input.organizationId, input.evidenceId, nextEvidence.evidenceType, nextEvidence.relatedObligationId,
          nextEvidence.documentDate, nextEvidence.expirationDate, nextEvidence.status, nextEvidence.confidence,
          nextEvidence.reviewerNotes]
      );
      const analysisResult = await client.query(
        `UPDATE evidence_ai_analyses SET human_reviewed=$3, human_accepted_ai_result=$4, human_reviewer_id=$5,
           human_reviewed_at=$6, human_override_evidence_type=$7, human_override_rule_id=$8,
           human_review_notes=$9, needs_human_review=$10, updated_at=now()
         WHERE organization_id=$1 AND evidence_id=$2 RETURNING *`,
        [input.organizationId, input.evidenceId, nextAnalysis.humanReviewed, nextAnalysis.humanAcceptedAiResult,
          nextAnalysis.humanReviewerId, nextAnalysis.humanReviewedAt, nextAnalysis.humanOverrideEvidenceType,
          nextAnalysis.humanOverrideRuleId, nextAnalysis.humanReviewNotes, nextAnalysis.needsHumanReview]
      );
      await client.query(
        `INSERT INTO audit_logs (id, organization_id, facility_id, actor_user_id, action, entity_type, entity_id, metadata)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [this.createId(), input.organizationId, evidence.facilityId, input.reviewerId, input.auditAction,
          "evidence_ai_analysis", analysis.id, JSON.stringify(input.auditMetadata || {})]
      );
      await client.query("COMMIT");
      return { evidence: camelEvidence(evidenceResult.rows[0]), analysis: camelAiAnalysis(analysisResult.rows[0]) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listRulesPacks() {
    return (await this.query("SELECT * FROM rules_packs ORDER BY country, name")).map(camelRulesPack);
  }

  async getRulesPack(rulesPackId) {
    const [row] = await this.query("SELECT * FROM rules_packs WHERE rules_pack_id = $1", [rulesPackId]);
    return row ? camelRulesPack(row) : null;
  }

  async listComplianceRules(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.country) {
      params.push(filters.country);
      conditions.push(`country = $${params.length}`);
    }
    if (filters.rulesPackId) {
      params.push(filters.rulesPackId);
      conditions.push(`rules_pack_id = $${params.length}`);
    }
    if (filters.region) {
      params.push(filters.region);
      conditions.push(`region = $${params.length}`);
    }
    if (filters.industry) {
      params.push(filters.industry);
      conditions.push(`rules_pack_id IN (SELECT rules_pack_id FROM rules_packs WHERE industry = $${params.length})`);
    }
    const sql = `SELECT * FROM compliance_rules ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY authority, citation`;
    return (await this.query(sql, params)).map(camelComplianceRule);
  }

  async saveApplicableRules(organizationId, facilityId, rulesPackId, rules) {
    await this.getFacility(organizationId, facilityId);
    if (rules.some((rule) => rule.rulesPackId !== rulesPackId)) throw forbidden("Applicable rule does not belong to the selected rules pack");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE facilities SET selected_rules_pack_id=$3, updated_at=now() WHERE organization_id=$1 AND id=$2",
        [organizationId, facilityId, rulesPackId]
      );
      await client.query("DELETE FROM facility_applicable_rules WHERE organization_id=$1 AND facility_id=$2", [organizationId, facilityId]);
      if (rules.length > 0) {
        const values = [];
        const placeholders = rules.map((rule, index) => {
          const offset = index * 5;
          values.push(this.createId(), organizationId, facilityId, rule.id, rulesPackId);
          return `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5})`;
        });
        await client.query(
          `INSERT INTO facility_applicable_rules (id, organization_id, facility_id, rule_id, rules_pack_id)
           VALUES ${placeholders.join(",")}
           ON CONFLICT (facility_id, rule_id) DO UPDATE SET rules_pack_id=EXCLUDED.rules_pack_id`,
          values
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const reviewResult = await client.query(
        `INSERT INTO audit_readiness_reviews (id, organization_id, facility_id, rules_pack_id, country, region, readiness_score, score_explanation, summary, generated_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [reviewId, input.organizationId, input.facilityId, input.rulesPackId, input.country, input.region, input.readinessScore, JSON.stringify(input.scoreExplanation), JSON.stringify(input.summary), input.generatedByUserId]
      );
      for (const row of input.gapRows) {
        await client.query(
          "INSERT INTO evidence_gap_rows (id, organization_id, review_id, facility_id, rule_id, row_data, status, priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
          [this.createId(), input.organizationId, reviewId, input.facilityId, row.ruleId, JSON.stringify(row), row.status, row.priority]
        );
      }
      for (const finding of input.findings) {
        await client.query(
          "INSERT INTO findings (id, organization_id, review_id, facility_id, rule_id, severity, title, description, authority, citation) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
          [this.createId(), input.organizationId, reviewId, input.facilityId, finding.ruleId, finding.severity, finding.title, finding.description, finding.authority, finding.citation]
        );
      }
      await client.query("DELETE FROM evidence_matches WHERE organization_id=$1 AND facility_id=$2", [input.organizationId, input.facilityId]);
      for (const match of input.evidenceMatches || []) {
        await client.query(
          `INSERT INTO evidence_matches (id, organization_id, facility_id, rule_id, evidence_id, match_type, confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (rule_id, evidence_id) DO UPDATE SET match_type=EXCLUDED.match_type, confidence=EXCLUDED.confidence`,
          [this.createId(), input.organizationId, input.facilityId, match.ruleId, match.evidenceId, match.matchType, match.confidence]
        );
      }
      for (const item of input.actionPlan) {
        await client.query(
          "INSERT INTO action_items (id, organization_id, review_id, facility_id, related_obligation_id, title, item_data, bucket, priority, status, due_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [this.createId(), input.organizationId, reviewId, input.facilityId, item.relatedObligationId, item.title, JSON.stringify(item), item.bucket, item.priority, item.status, item.dueDate]
        );
      }
      await client.query("COMMIT");
      return camelReview(reviewResult.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listReviews(organizationId, facilityId = null) {
    const params = [organizationId];
    let where = "organization_id = $1";
    if (facilityId) {
      params.push(facilityId);
      where += " AND facility_id = $2";
    }
    return (await this.query(`SELECT * FROM audit_readiness_reviews WHERE ${where} ORDER BY created_at DESC`, params)).map(camelReview);
  }

  async getReview(organizationId, id) {
    return this.getScoped("audit_readiness_reviews", organizationId, id, "Review", camelReview);
  }

  async getGapRows(organizationId, reviewId) {
    await this.getReview(organizationId, reviewId);
    return (await this.query("SELECT row_data FROM evidence_gap_rows WHERE organization_id=$1 AND review_id=$2 ORDER BY created_at", [organizationId, reviewId])).map((row) => row.row_data);
  }

  async getActionItems(organizationId, reviewId) {
    await this.getReview(organizationId, reviewId);
    return (await this.query("SELECT item_data FROM action_items WHERE organization_id=$1 AND review_id=$2 ORDER BY due_date", [organizationId, reviewId])).map((row) => row.item_data);
  }

  async getEvidenceMatches(organizationId, facilityId) {
    await this.getFacility(organizationId, facilityId);
    return (await this.query("SELECT * FROM evidence_matches WHERE organization_id=$1 AND facility_id=$2 ORDER BY created_at", [organizationId, facilityId])).map(camelEvidenceMatch);
  }

  async getFindings(organizationId, reviewId) {
    await this.getReview(organizationId, reviewId);
    return await this.query("SELECT * FROM findings WHERE organization_id=$1 AND review_id=$2 ORDER BY created_at", [organizationId, reviewId]);
  }

  async createAuditPacket(input) {
    const facility = await this.getFacility(input.organizationId, input.facilityId);
    const review = await this.getReview(input.organizationId, input.reviewId);
    if (review.facilityId !== facility.id) throw forbidden("Review does not belong to this facility");
    if (input.rulesPackId !== review.rulesPackId) throw forbidden("Packet rules pack does not match the review rules pack");
    const id = input.id || this.createId();
    const [row] = await this.query(
      `INSERT INTO audit_packets (id, organization_id, facility_id, review_id, title, file_reference, generated_by_user_id, country, region, rules_pack_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, input.organizationId, input.facilityId, input.reviewId, input.title, input.fileReference, input.generatedByUserId, input.country, input.region, input.rulesPackId, input.status]
    );
    return camelPacket(row);
  }

  async listAuditPackets(organizationId, facilityId = null) {
    const params = [organizationId];
    let where = "organization_id = $1";
    if (facilityId) {
      params.push(facilityId);
      where += " AND facility_id = $2";
    }
    return (await this.query(`SELECT * FROM audit_packets WHERE ${where} ORDER BY generated_at DESC`, params)).map(camelPacket);
  }

  async getAuditPacket(organizationId, id) {
    return this.getScoped("audit_packets", organizationId, id, "Audit packet", camelPacket);
  }

  async createExpertReview(input) {
    if (input.facilityId) await this.getFacility(input.organizationId, input.facilityId);
    if (input.reviewId) {
      const review = await this.getReview(input.organizationId, input.reviewId);
      if (input.facilityId && review.facilityId !== input.facilityId) throw forbidden("Review does not belong to this facility");
    }
    const id = input.id || this.createId();
    const [row] = await this.query(
      "INSERT INTO expert_reviews (id, organization_id, facility_id, review_id, status, requested_by_user_id, expert_notes) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [id, input.organizationId, input.facilityId, input.reviewId, input.status || "requested", input.requestedByUserId, input.expertNotes || null]
    );
    return camelExpertReview(row);
  }

  async listExpertReviews(organizationId) {
    return (await this.query("SELECT * FROM expert_reviews WHERE organization_id=$1 ORDER BY created_at DESC", [organizationId])).map(camelExpertReview);
  }

  async updateExpertReview(organizationId, id, updates) {
    await this.getScoped("expert_reviews", organizationId, id, "Expert review", camelExpertReview);
    const [row] = await this.query(
      "UPDATE expert_reviews SET status=$3, expert_notes=$4, updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
      [organizationId, id, updates.status, updates.expertNotes || null]
    );
    return camelExpertReview(row);
  }

  async logAudit(input) {
    const id = input.id || this.createId();
    const [row] = await this.query(
      "INSERT INTO audit_logs (id, organization_id, facility_id, actor_user_id, action, entity_type, entity_id, metadata, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *",
      [id, input.organizationId, input.facilityId || null, input.actorUserId || null, input.action, input.entityType, input.entityId || null, JSON.stringify(input.metadata || {}), input.ipAddress || null]
    );
    return row;
  }

  async listAuditLogs(organizationId, facilityId = null) {
    const params = [organizationId];
    let where = "organization_id = $1";
    if (facilityId) {
      params.push(facilityId);
      where += " AND facility_id = $2";
    }
    return await this.query(`SELECT * FROM audit_logs WHERE ${where} ORDER BY created_at DESC LIMIT 200`, params);
  }

  async getScoped(table, organizationId, id, label, mapper) {
    const [anyRow] = await this.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    if (!anyRow) return null;
    if (anyRow.organization_id !== organizationId) throw forbidden(`${label} belongs to another organization`);
    return mapper(anyRow);
  }
}

function camelOrganization(row) {
  return { id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at };
}

function camelUser(row) {
  return { id: row.id, organizationId: row.organization_id, email: row.email, passwordHash: row.password_hash, name: row.name, role: row.role, isActive: row.is_active, createdAt: row.created_at, updatedAt: row.updated_at };
}

function camelSession(row) {
  return { id: row.id, organizationId: row.organization_id, userId: row.user_id, expiresAt: row.expires_at, createdAt: row.created_at };
}

function camelFacility(row) {
  return { id: row.id, organizationId: row.organization_id, name: row.name, country: row.country, stateProvince: row.state_province, region: row.region, jurisdictionCode: row.jurisdiction_code, industry: row.industry, facilityType: row.facility_type, employeeCount: row.employee_count, hazardProfile: row.hazard_profile, selectedRulesPackId: row.selected_rules_pack_id, archived: row.archived, createdAt: row.created_at, updatedAt: row.updated_at };
}

function camelEvidence(row) {
  return { id: row.id, organizationId: row.organization_id, facilityId: row.facility_id, title: row.title, description: row.description, evidenceType: row.evidence_type, fileReference: row.file_reference, fileName: row.file_name, contentType: row.content_type, fileSizeBytes: row.file_size_bytes === null ? null : Number(row.file_size_bytes), fileSha256: row.file_sha256, uploadedByUserId: row.uploaded_by_user_id, country: row.country, region: row.region, relatedObligationId: row.related_obligation_id, documentDate: row.document_date, expirationDate: row.expiration_date, status: row.status, confidence: row.confidence, reviewerNotes: row.reviewer_notes, archived: row.archived, createdAt: row.created_at, updatedAt: row.updated_at };
}

function camelAiAnalysis(row) {
  return {
    id: row.id, organizationId: row.organization_id, facilityId: row.facility_id, evidenceId: row.evidence_id,
    reviewId: row.review_id, processingStatus: row.processing_status, textExtractionStatus: row.text_extraction_status,
    detectedEvidenceType: row.detected_evidence_type, detectedTitle: row.detected_title,
    extractedDocumentDate: row.extracted_document_date, extractedExpirationDate: row.extracted_expiration_date,
    extractedFacilityName: row.extracted_facility_name, extractedEmployeeNames: row.extracted_employee_names,
    extractedEquipmentNames: row.extracted_equipment_names, extractedChemicalNames: row.extracted_chemical_names,
    extractedSignaturePresent: row.extracted_signature_present, extractedAuthorityMentions: row.extracted_authority_mentions,
    extractedCitationMentions: row.extracted_citation_mentions, summary: row.summary, issues: row.issues,
    suggestedRuleId: row.suggested_rule_id, suggestedObligationTitle: row.suggested_obligation_title,
    matchReason: row.match_reason, missingFieldsOrIssues: row.missing_fields_or_issues, confidence: row.confidence,
    needsHumanReview: row.needs_human_review, provider: row.provider, model: row.model, promptVersion: row.prompt_version,
    rawModelOutputReference: row.raw_model_output_reference, error: row.error, humanReviewed: row.human_reviewed,
    humanAcceptedAiResult: row.human_accepted_ai_result, humanReviewerId: row.human_reviewer_id,
    humanReviewedAt: row.human_reviewed_at, humanOverrideEvidenceType: row.human_override_evidence_type,
    humanOverrideRuleId: row.human_override_rule_id, humanReviewNotes: row.human_review_notes,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function camelRulesPack(row) {
  return { rulesPackId: row.rules_pack_id, name: row.name, country: row.country, region: row.region, industry: row.industry, authorityScope: row.authority_scope, version: row.version, expertReviewed: row.expert_reviewed, demoContent: row.demo_content, lastUpdatedAt: row.last_updated_at, description: row.description };
}

function camelComplianceRule(row) {
  return { id: row.id, rulesPackId: row.rules_pack_id, country: row.country, region: row.region, authority: row.authority, citation: row.citation, title: row.title, description: row.description, applicabilityTrigger: row.applicability_trigger, requiredEvidenceTypes: row.required_evidence_types, priority: row.priority, ownerRole: row.owner_role, dueWindowDays: row.due_window_days, sourceUrl: row.source_url, expertReviewed: row.expert_reviewed, demoContent: row.demo_content, lastReviewedAt: row.last_reviewed_at, version: row.version };
}

function camelReview(row) {
  return { id: row.id, organizationId: row.organization_id, facilityId: row.facility_id, rulesPackId: row.rules_pack_id, country: row.country, region: row.region, readinessScore: row.readiness_score, scoreExplanation: row.score_explanation, summary: row.summary, generatedByUserId: row.generated_by_user_id, createdAt: row.created_at };
}

function camelPacket(row) {
  return { id: row.id, organizationId: row.organization_id, facilityId: row.facility_id, reviewId: row.review_id, title: row.title, fileReference: row.file_reference, generatedByUserId: row.generated_by_user_id, generatedAt: row.generated_at, country: row.country, region: row.region, rulesPackId: row.rules_pack_id, status: row.status };
}

function camelEvidenceMatch(row) {
  return { id: row.id, organizationId: row.organization_id, facilityId: row.facility_id, ruleId: row.rule_id, evidenceId: row.evidence_id, matchType: row.match_type, confidence: row.confidence, createdAt: row.created_at };
}

function camelExpertReview(row) {
  return { id: row.id, organizationId: row.organization_id, facilityId: row.facility_id, reviewId: row.review_id, status: row.status, requestedByUserId: row.requested_by_user_id, expertNotes: row.expert_notes, createdAt: row.created_at, updatedAt: row.updated_at };
}
