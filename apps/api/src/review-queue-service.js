import { COMPLIANCE_RULES } from "../../../packages/rules/src/index.js";
import { isExpired, validationError } from "../../../packages/shared/src/index.js";

export const REVIEW_QUEUE_STATUSES = [
  "needs_review",
  "low_confidence",
  "medium_confidence",
  "extraction_failed",
  "ocr_required",
  "suspicious_scan",
  "expired",
  "rejected",
  "unmatched",
  "high_priority_impact",
  "processing_failed"
];

export function createReviewQueueService({ repo }) {
  return {
    async list({ organizationId, facilityId = null, status = null, priority = null }) {
      if (status && !REVIEW_QUEUE_STATUSES.includes(status)) throw validationError(`status must be one of: ${REVIEW_QUEUE_STATUSES.join(", ")}`);
      if (priority && !["critical", "high", "medium", "low"].includes(priority)) throw validationError("priority must be critical, high, medium, or low");
      if (facilityId) await repo.getFacility(organizationId, facilityId);

      const [facilities, evidence, analyses, jobs] = await Promise.all([
        repo.listFacilities(organizationId),
        repo.listOrganizationEvidence(organizationId),
        repo.listOrganizationAiAnalyses(organizationId),
        repo.listProcessingJobs(organizationId, facilityId)
      ]);
      const facilityById = new Map(facilities.map((item) => [item.id, item]));
      const analysisByEvidence = new Map(analyses.map((item) => [item.evidenceId, item]));
      const latestJobByEvidence = new Map();
      for (const job of jobs) if (!latestJobByEvidence.has(job.evidenceId)) latestJobByEvidence.set(job.evidenceId, job);

      return evidence
        .filter((item) => !facilityId || item.facilityId === facilityId)
        .map((item) => buildQueueItem(item, facilityById.get(item.facilityId), analysisByEvidence.get(item.id), latestJobByEvidence.get(item.id)))
        .filter((item) => item.categories.length > 0)
        .filter((item) => !status || item.categories.includes(status))
        .filter((item) => !priority || item.priorityImpact === priority)
        .sort(compareQueueItems);
    }
  };
}

function buildQueueItem(evidence, facility, analysis = null, job = null) {
  const suggestedRuleId = analysis?.humanOverrideRuleId || evidence.relatedObligationId || analysis?.suggestedRuleId || null;
  const rule = COMPLIANCE_RULES.find((item) => item.id === suggestedRuleId) || null;
  const categories = [];
  if (evidence.scanStatus === "scan_suspicious") categories.push("suspicious_scan");
  if (analysis?.textExtractionStatus === "ocr_required") categories.push("ocr_required");
  if (["extraction_failed", "unsupported_for_text_extraction"].includes(analysis?.textExtractionStatus)) categories.push("extraction_failed");
  if (analysis?.confidence !== null && analysis?.confidence !== undefined && analysis.confidence < 0.7) categories.push("low_confidence");
  if (analysis?.confidence >= 0.7 && analysis.confidence < 0.8) categories.push("medium_confidence");
  if (analysis?.needsHumanReview || evidence.status === "needs_review") categories.push("needs_review");
  if (isExpired(evidence)) categories.push("expired");
  if (evidence.status === "rejected") categories.push("rejected");
  if (!suggestedRuleId) categories.push("unmatched");
  if (["critical", "high"].includes(rule?.priority)) categories.push("high_priority_impact");
  if (job?.status === "failed" || analysis?.processingStatus === "failed") categories.push("processing_failed");
  return {
    id: evidence.id,
    organizationId: evidence.organizationId,
    facilityId: evidence.facilityId,
    facilityName: facility?.name || "Unknown facility",
    evidenceTitle: evidence.title,
    fileName: evidence.fileName,
    evidenceStatus: evidence.status,
    scanStatus: evidence.scanStatus,
    detectedEvidenceType: analysis?.detectedEvidenceType || null,
    confidence: analysis?.confidence ?? null,
    suggestedRuleId,
    suggestedObligationTitle: analysis?.suggestedObligationTitle || rule?.title || null,
    issueSummary: [...new Set([...(analysis?.issues || []), analysis?.error, evidence.scanError, job?.lastProcessingError].filter(Boolean))],
    priorityImpact: rule?.priority || "low",
    uploadedAt: evidence.createdAt,
    processingStatus: job && ["queued", "processing", "failed"].includes(job.status) ? job.status : analysis?.processingStatus || "not_started",
    textExtractionStatus: analysis?.textExtractionStatus || "not_started",
    needsHumanReview: Boolean(analysis?.needsHumanReview || evidence.status === "needs_review"),
    humanReviewed: Boolean(analysis?.humanReviewed),
    analysisVersion: analysis?.analysisVersion || null,
    jobId: job?.id || null,
    processingAttempts: job?.processingAttempts || 0,
    maxAttempts: job?.maxAttempts || 0,
    categories
  };
}

function compareQueueItems(a, b) {
  const priorityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  return priorityRank[a.priorityImpact] - priorityRank[b.priorityImpact]
    || Number(b.scanStatus === "scan_suspicious") - Number(a.scanStatus === "scan_suspicious")
    || new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
}
