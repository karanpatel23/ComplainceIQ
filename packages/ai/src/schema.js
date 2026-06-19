import { EVIDENCE_TAXONOMY, validationError } from "../../shared/src/index.js";

export const AI_PROCESSING_STATUSES = ["not_started", "processing", "processed", "failed", "needs_review"];
export const AI_PROMPT_VERSION = "evidence-intelligence-v1";

const nullableString = { type: ["string", "null"] };
const stringArray = { type: "array", items: { type: "string" } };

export const EVIDENCE_AI_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "detectedEvidenceType", "detectedTitle", "summary", "documentDate", "expirationDate", "facilityName",
    "employeeNames", "equipmentNames", "chemicalNames", "signaturePresent", "authorityMentions", "citationMentions",
    "issues", "confidence", "needsHumanReview", "suggestedRuleId", "suggestedObligationTitle", "matchReason",
    "missingFieldsOrIssues"
  ],
  properties: {
    detectedEvidenceType: { type: "string", enum: EVIDENCE_TAXONOMY },
    detectedTitle: nullableString,
    summary: { type: "string" },
    documentDate: nullableString,
    expirationDate: nullableString,
    facilityName: nullableString,
    employeeNames: stringArray,
    equipmentNames: stringArray,
    chemicalNames: stringArray,
    signaturePresent: { type: ["boolean", "null"] },
    authorityMentions: stringArray,
    citationMentions: stringArray,
    issues: stringArray,
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needsHumanReview: { type: "boolean" },
    suggestedRuleId: nullableString,
    suggestedObligationTitle: nullableString,
    matchReason: nullableString,
    missingFieldsOrIssues: stringArray
  }
};

export function validateEvidenceAiOutput(input, { applicableRules = [], reviewRequiredThreshold = 0.7 } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw invalidAiOutput("AI output must be an object");
  const detectedEvidenceType = requiredEnum(input.detectedEvidenceType, EVIDENCE_TAXONOMY, "detectedEvidenceType");
  const confidence = requiredNumber(input.confidence, "confidence", 0, 1);
  const suggestedRuleId = nullableBoundedString(input.suggestedRuleId, "suggestedRuleId", 160);
  const suggestedRule = suggestedRuleId ? applicableRules.find((rule) => rule.id === suggestedRuleId) : null;
  if (suggestedRuleId && !suggestedRule) throw invalidAiOutput("suggestedRuleId is not an applicable facility obligation");

  return {
    detectedEvidenceType,
    detectedTitle: nullableBoundedString(input.detectedTitle, "detectedTitle", 300),
    summary: requiredBoundedString(input.summary, "summary", 2_000),
    documentDate: nullableDate(input.documentDate, "documentDate"),
    expirationDate: nullableDate(input.expirationDate, "expirationDate"),
    facilityName: nullableBoundedString(input.facilityName, "facilityName", 300),
    employeeNames: boundedStringArray(input.employeeNames, "employeeNames"),
    equipmentNames: boundedStringArray(input.equipmentNames, "equipmentNames"),
    chemicalNames: boundedStringArray(input.chemicalNames, "chemicalNames"),
    signaturePresent: nullableBoolean(input.signaturePresent, "signaturePresent"),
    authorityMentions: boundedStringArray(input.authorityMentions, "authorityMentions"),
    citationMentions: boundedStringArray(input.citationMentions, "citationMentions"),
    issues: boundedStringArray(input.issues, "issues", 100, 500),
    confidence,
    needsHumanReview: requiredBoolean(input.needsHumanReview, "needsHumanReview") || confidence < reviewRequiredThreshold || detectedEvidenceType === "other",
    suggestedRuleId,
    suggestedObligationTitle: suggestedRule?.title || null,
    matchReason: nullableBoundedString(input.matchReason, "matchReason", 1_000),
    missingFieldsOrIssues: boundedStringArray(input.missingFieldsOrIssues, "missingFieldsOrIssues", 100, 500)
  };
}

export function parseAiReviewInput(input) {
  const reviewActions = ["accept_ai", "override", "mark_accepted", "mark_rejected", "mark_needs_review"];
  if (typeof input.action !== "string" || !reviewActions.includes(input.action)) throw validationError(`action must be one of: ${reviewActions.join(", ")}`);
  const action = input.action;
  const evidenceType = input.evidenceType === undefined || input.evidenceType === null || input.evidenceType === ""
    ? null
    : reviewEnum(input.evidenceType, EVIDENCE_TAXONOMY, "evidenceType");
  const ruleId = nullableBoundedString(input.ruleId, "ruleId", 160);
  const notes = nullableBoundedString(input.notes, "notes", 2_000);
  if (action === "override" && !evidenceType && !ruleId) throw validationError("Override requires evidenceType or ruleId");
  return { action, evidenceType, ruleId, notes };
}

function reviewEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.includes(value)) throw validationError(`${field} must be one of: ${allowed.join(", ")}`);
  return value;
}

export function invalidAiOutput(message) {
  const error = validationError(message);
  error.code = "AI_INVALID_OUTPUT";
  return error;
}

function requiredEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.includes(value)) throw invalidAiOutput(`${field} must be one of: ${allowed.join(", ")}`);
  return value;
}

function requiredBoundedString(value, field, max) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > max) throw invalidAiOutput(`${field} must be a non-empty string no longer than ${max} characters`);
  return value.trim();
}

function nullableBoundedString(value, field, max) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > max) throw invalidAiOutput(`${field} must be null or a string no longer than ${max} characters`);
  return value.trim() || null;
}

function requiredNumber(value, field, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) throw invalidAiOutput(`${field} must be between ${min} and ${max}`);
  return value;
}

function requiredBoolean(value, field) {
  if (typeof value !== "boolean") throw invalidAiOutput(`${field} must be boolean`);
  return value;
}

function nullableBoolean(value, field) {
  if (value === null || value === undefined) return null;
  return requiredBoolean(value, field);
}

function boundedStringArray(value, field, maxItems = 100, maxLength = 300) {
  if (!Array.isArray(value) || value.length > maxItems || value.some((item) => typeof item !== "string" || item.length > maxLength)) {
    throw invalidAiOutput(`${field} must be an array of at most ${maxItems} bounded strings`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function nullableDate(value, field) {
  const text = nullableBoundedString(value, field, 10);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(new Date(`${text}T00:00:00Z`).getTime())) {
    throw invalidAiOutput(`${field} must be null or an ISO date in YYYY-MM-DD format`);
  }
  return text;
}
