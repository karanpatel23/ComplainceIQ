import { extractEvidenceText, providerMetadata } from "../../../packages/ai/src/index.js";
import { getApplicableRules } from "../../../packages/rules/src/index.js";
import { notFound, validationError } from "../../../packages/shared/src/index.js";

export function createEvidenceAiService({ config, repo, storage, provider }) {
  return {
    async processEvidence({ organizationId, evidenceId, userId }) {
      const evidence = await repo.getEvidence(organizationId, evidenceId);
      if (!evidence) throw notFound("Evidence not found");
      const facility = await repo.getFacility(organizationId, evidence.facilityId);
      if (!facility) throw notFound("Facility not found");
      const { rules: applicableRules } = getApplicableRules(facility);
      const metadata = providerMetadata(provider);
      let analysis = await repo.upsertAiAnalysis(baseAnalysis({ evidence, metadata, processingStatus: "processing" }));
      await logAiEvent(repo, { organizationId, facilityId: facility.id, userId, evidenceId, analysisId: analysis.id, action: "evidence_processing_started", metadata: { provider: metadata.provider } });

      try {
        const buffer = evidence.fileReference ? await storage.readBuffer(evidence.fileReference) : null;
        const extraction = extractEvidenceText({
          buffer,
          fileName: evidence.fileName,
          evidence,
          maxChars: config.aiMaxFileTextChars
        });

        if (!config.aiEnabled) {
          analysis = await repo.upsertAiAnalysis({
            ...baseAnalysis({ evidence, metadata, processingStatus: "needs_review" }),
            id: analysis.id,
            textExtractionStatus: extraction.textExtractionStatus,
            needsHumanReview: true,
            issues: extraction.warning ? [extraction.warning] : [],
            error: "AI Evidence Intelligence is disabled. Manual review remains available."
          });
          await markNeedsReviewWhenPending(repo, evidence);
          await logAiEvent(repo, { organizationId, facilityId: facility.id, userId, evidenceId, analysisId: analysis.id, action: "evidence_processing_completed", metadata: { status: "needs_review", reason: "ai_disabled" } });
          return analysis;
        }

        if (extraction.textExtractionStatus === "unsupported_for_text_extraction" || !extraction.text) {
          analysis = await repo.upsertAiAnalysis({
            ...baseAnalysis({ evidence, metadata, processingStatus: "needs_review" }),
            id: analysis.id,
            textExtractionStatus: extraction.textExtractionStatus,
            needsHumanReview: true,
            issues: [extraction.warning || "No extractable text was available."],
            error: extraction.warning || "No extractable text was available."
          });
          await markNeedsReviewWhenPending(repo, evidence);
          await logAiEvent(repo, { organizationId, facilityId: facility.id, userId, evidenceId, analysisId: analysis.id, action: "evidence_processing_completed", metadata: { status: "needs_review", extractionStatus: extraction.textExtractionStatus } });
          return analysis;
        }

        const output = await provider.analyzeEvidenceDocument({ text: extraction.text, evidence, facility, applicableRules });
        const suggestedRule = output.suggestedRuleId ? applicableRules.find((rule) => rule.id === output.suggestedRuleId) : null;
        const deterministicAgreement = Boolean(suggestedRule?.requiredEvidenceTypes.includes(output.detectedEvidenceType));
        const needsHumanReview = output.needsHumanReview
          || output.confidence < config.aiConfidenceThreshold
          || !deterministicAgreement;
        const issues = [...output.issues];
        if (extraction.truncated) issues.push(`Document text was bounded to ${config.aiMaxFileTextChars} characters before analysis.`);

        analysis = await repo.upsertAiAnalysis({
          ...baseAnalysis({ evidence, metadata, processingStatus: needsHumanReview ? "needs_review" : "processed" }),
          id: analysis.id,
          textExtractionStatus: extraction.textExtractionStatus,
          detectedEvidenceType: output.detectedEvidenceType,
          detectedTitle: output.detectedTitle,
          extractedDocumentDate: output.documentDate,
          extractedExpirationDate: output.expirationDate,
          extractedFacilityName: output.facilityName,
          extractedEmployeeNames: output.employeeNames,
          extractedEquipmentNames: output.equipmentNames,
          extractedChemicalNames: output.chemicalNames,
          extractedSignaturePresent: output.signaturePresent,
          extractedAuthorityMentions: sourceSupportedMentions(output.authorityMentions, extraction.text),
          extractedCitationMentions: sourceSupportedMentions(output.citationMentions, extraction.text),
          summary: output.summary,
          issues,
          suggestedRuleId: output.suggestedRuleId,
          suggestedObligationTitle: output.suggestedObligationTitle,
          matchReason: output.matchReason,
          missingFieldsOrIssues: output.missingFieldsOrIssues,
          confidence: output.confidence,
          needsHumanReview,
          error: null
        });
        await logAiEvent(repo, { organizationId, facilityId: facility.id, userId, evidenceId, analysisId: analysis.id, action: "ai_classification_generated", metadata: { detectedEvidenceType: analysis.detectedEvidenceType, confidence: analysis.confidence, needsHumanReview } });
        if (analysis.suggestedRuleId) {
          await logAiEvent(repo, { organizationId, facilityId: facility.id, userId, evidenceId, analysisId: analysis.id, action: "ai_match_suggested", metadata: { suggestedRuleId: analysis.suggestedRuleId, confidence: analysis.confidence, deterministicAgreement } });
        }
        await logAiEvent(repo, { organizationId, facilityId: facility.id, userId, evidenceId, analysisId: analysis.id, action: "evidence_processing_completed", metadata: { status: analysis.processingStatus, extractionStatus: analysis.textExtractionStatus } });
        return analysis;
      } catch (error) {
        analysis = await repo.upsertAiAnalysis({
          ...baseAnalysis({ evidence, metadata, processingStatus: "failed" }),
          id: analysis.id,
          textExtractionStatus: analysis.textExtractionStatus || "failed",
          needsHumanReview: true,
          error: safeError(error)
        });
        const action = error.code === "AI_INVALID_OUTPUT" ? "ai_output_rejected_invalid_schema" : "evidence_processing_failed";
        await logAiEvent(repo, { organizationId, facilityId: facility.id, userId, evidenceId, analysisId: analysis.id, action, metadata: { errorCode: error.code || "AI_PROCESSING_ERROR" } });
        if (error.code === "AI_INVALID_OUTPUT") error.status = 502;
        throw error;
      }
    },

    async reviewEvidence({ organizationId, evidenceId, reviewer, reviewInput }) {
      const evidence = await repo.getEvidence(organizationId, evidenceId);
      if (!evidence) throw notFound("Evidence not found");
      const analysis = await repo.getAiAnalysis(organizationId, evidenceId);
      if (!analysis) throw notFound("AI analysis not found");
      const facility = await repo.getFacility(organizationId, evidence.facilityId);
      const { rules } = getApplicableRules(facility);
      if (reviewInput.ruleId && !rules.some((rule) => rule.id === reviewInput.ruleId)) {
        throw validationError("ruleId must identify an applicable facility obligation");
      }

      const now = new Date().toISOString();
      const evidenceUpdates = {};
      const analysisUpdates = {
        humanReviewed: true,
        humanReviewerId: reviewer.id,
        humanReviewedAt: now,
        humanReviewNotes: reviewInput.notes,
        needsHumanReview: false
      };
      let auditAction;

      if (reviewInput.action === "accept_ai") {
        if (!analysis.detectedEvidenceType || analysis.detectedEvidenceType === "other") throw validationError("AI classification is not specific enough to accept");
        evidenceUpdates.evidenceType = analysis.detectedEvidenceType;
        evidenceUpdates.documentDate = analysis.extractedDocumentDate || evidence.documentDate;
        evidenceUpdates.expirationDate = analysis.extractedExpirationDate || evidence.expirationDate;
        if (analysis.suggestedRuleId) evidenceUpdates.relatedObligationId = analysis.suggestedRuleId;
        analysisUpdates.humanAcceptedAiResult = true;
        analysisUpdates.humanOverrideEvidenceType = analysis.detectedEvidenceType;
        analysisUpdates.humanOverrideRuleId = analysis.suggestedRuleId;
        auditAction = "human_accepted_ai_result";
      } else if (reviewInput.action === "override") {
        if (reviewInput.evidenceType) {
          evidenceUpdates.evidenceType = reviewInput.evidenceType;
          analysisUpdates.humanOverrideEvidenceType = reviewInput.evidenceType;
        }
        if (reviewInput.ruleId) {
          evidenceUpdates.relatedObligationId = reviewInput.ruleId;
          analysisUpdates.humanOverrideRuleId = reviewInput.ruleId;
        }
        auditAction = reviewInput.evidenceType ? "human_overrode_evidence_type" : "human_overrode_rule_match";
      } else if (reviewInput.action === "mark_accepted") {
        evidenceUpdates.status = "accepted";
        auditAction = "human_marked_evidence_accepted";
      } else if (reviewInput.action === "mark_rejected") {
        evidenceUpdates.status = "rejected";
        auditAction = "human_marked_evidence_rejected";
      } else {
        evidenceUpdates.status = "needs_review";
        analysisUpdates.needsHumanReview = true;
        auditAction = "human_review_started";
      }
      if (reviewInput.notes !== null) evidenceUpdates.reviewerNotes = reviewInput.notes;

      const result = await repo.applyAiHumanReview({
        organizationId,
        evidenceId,
        reviewerId: reviewer.id,
        evidenceUpdates,
        analysisUpdates,
        auditAction,
        auditMetadata: {
          action: reviewInput.action,
          evidenceTypeOverridden: Boolean(reviewInput.evidenceType),
          ruleMatchOverridden: Boolean(reviewInput.ruleId)
        }
      });
      if (reviewInput.action === "override" && reviewInput.evidenceType && reviewInput.ruleId) {
        await logAiEvent(repo, {
          organizationId,
          facilityId: evidence.facilityId,
          userId: reviewer.id,
          evidenceId,
          analysisId: analysis.id,
          action: "human_overrode_rule_match",
          metadata: { overrideRuleId: reviewInput.ruleId }
        });
      }
      return result;
    }
  };
}

function baseAnalysis({ evidence, metadata, processingStatus }) {
  return {
    organizationId: evidence.organizationId,
    facilityId: evidence.facilityId,
    evidenceId: evidence.id,
    reviewId: null,
    processingStatus,
    textExtractionStatus: "not_started",
    detectedEvidenceType: null,
    detectedTitle: null,
    extractedDocumentDate: null,
    extractedExpirationDate: null,
    extractedFacilityName: null,
    extractedEmployeeNames: [],
    extractedEquipmentNames: [],
    extractedChemicalNames: [],
    extractedSignaturePresent: null,
    extractedAuthorityMentions: [],
    extractedCitationMentions: [],
    summary: null,
    issues: [],
    suggestedRuleId: null,
    suggestedObligationTitle: null,
    matchReason: null,
    missingFieldsOrIssues: [],
    confidence: null,
    needsHumanReview: true,
    provider: metadata.provider,
    model: metadata.model,
    promptVersion: metadata.promptVersion,
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

async function markNeedsReviewWhenPending(repo, evidence) {
  if (evidence.status === "pending") await repo.updateEvidence(evidence.organizationId, evidence.id, { status: "needs_review" });
}

async function logAiEvent(repo, { organizationId, facilityId, userId, evidenceId, analysisId, action, metadata }) {
  await repo.logAudit({
    organizationId,
    facilityId,
    actorUserId: userId,
    action,
    entityType: "evidence_ai_analysis",
    entityId: analysisId,
    metadata: { evidenceId, ...metadata }
  });
}

function safeError(error) {
  return String(error?.message || "Evidence processing failed").slice(0, 500);
}

function sourceSupportedMentions(values, sourceText) {
  const source = sourceText.toLowerCase();
  return values.filter((value) => source.includes(value.toLowerCase()));
}
