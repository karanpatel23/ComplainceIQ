export const COUNTRIES = ["US", "CA", "MX"];

export const PRIORITIES = ["critical", "high", "medium", "low"];
export const EVIDENCE_STATUSES = ["pending", "accepted", "rejected", "expired", "needs_review"];
export const GAP_STATUSES = ["missing", "partial", "accepted", "rejected", "expired", "not_applicable"];
export const USER_ROLES = ["admin", "compliance_manager", "reviewer", "auditor", "executive"];
export const EVIDENCE_TAXONOMY = [
  "chemical_inventory",
  "chemical_training_records",
  "corrective_action_records",
  "emergency_action_plan",
  "emergency_drill_records",
  "emergency_training_records",
  "fire_extinguisher_inspections",
  "fit_test_records",
  "forklift_training_records",
  "hazardous_waste_determination",
  "hazardous_waste_manifests",
  "hazcom_training_records",
  "hearing_training_records",
  "incident_log",
  "loto_procedures",
  "loto_training_records",
  "machine_guarding_inspections",
  "maintenance_logs",
  "noise_monitoring_records",
  "osha_300_log",
  "osha_300a_summary",
  "other",
  "ppe_hazard_assessment",
  "ppe_training_records",
  "respiratory_program",
  "respiratory_training_records",
  "safety_training_records",
  "sds_library",
  "spcc_plan",
  "spcc_threshold_review",
  "waste_area_inspections",
  "whmis_training_records",
  "written_hazcom_program"
];

export function newId(prefix = "id") {
  const bytes = crypto.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(12))
    : null;
  if (bytes) {
    return `${prefix}_${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  }
  throw new Error("Secure random ID generation is unavailable");
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function requiredString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError(`${field} is required`);
  }
  return value.trim();
}

export function optionalString(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw validationError("Expected string value");
  return value.trim();
}

export function optionalBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

export function optionalInteger(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const number = Number.parseInt(String(value), 10);
  if (Number.isNaN(number)) throw validationError("Expected integer value");
  return number;
}

export function validationError(message, details = undefined) {
  const error = new Error(message);
  error.status = 400;
  error.code = "VALIDATION_ERROR";
  error.details = details;
  return error;
}

export function notFound(message = "Resource not found") {
  const error = new Error(message);
  error.status = 404;
  error.code = "NOT_FOUND";
  return error;
}

export function forbidden(message = "Forbidden") {
  const error = new Error(message);
  error.status = 403;
  error.code = "FORBIDDEN";
  return error;
}

export function unauthorized(message = "Authentication required") {
  const error = new Error(message);
  error.status = 401;
  error.code = "UNAUTHENTICATED";
  return error;
}

export function parseFacilityInput(input, organizationId) {
  const hazardProfile = input.hazardProfile && typeof input.hazardProfile === "object"
    ? input.hazardProfile
    : {};

  const country = requiredString(input.country, "country").toUpperCase();
  if (!COUNTRIES.includes(country)) {
    throw validationError("country must be US, CA, or MX");
  }

  const region = requiredString(input.region ?? input.stateProvince, "region");

  return {
    organizationId,
    name: requiredString(input.name, "name"),
    country,
    stateProvince: requiredString(input.stateProvince ?? region, "stateProvince"),
    region,
    jurisdictionCode: requiredString(input.jurisdictionCode ?? `${country}-${region}`, "jurisdictionCode"),
    industry: requiredString(input.industry, "industry"),
    facilityType: requiredString(input.facilityType ?? "industrial_manufacturing", "facilityType"),
    employeeCount: optionalInteger(input.employeeCount, 0),
    hazardProfile: {
      machinery: optionalBoolean(hazardProfile.machinery),
      hazardousChemicals: optionalBoolean(hazardProfile.hazardousChemicals),
      sdsRequired: optionalBoolean(hazardProfile.sdsRequired ?? hazardProfile.hazardousChemicals),
      forklifts: optionalBoolean(hazardProfile.forklifts),
      lockoutTagout: optionalBoolean(hazardProfile.lockoutTagout ?? hazardProfile.machinery),
      ppe: optionalBoolean(hazardProfile.ppe),
      respiratoryHazards: optionalBoolean(hazardProfile.respiratoryHazards),
      hearingNoise: optionalBoolean(hazardProfile.hearingNoise),
      hazardousWaste: optionalBoolean(hazardProfile.hazardousWaste),
      oilFuelStorage: optionalBoolean(hazardProfile.oilFuelStorage),
      emergencyActionPlan: optionalBoolean(hazardProfile.emergencyActionPlan, true),
      fireExtinguishers: optionalBoolean(hazardProfile.fireExtinguishers, true)
    },
    archived: Boolean(input.archived ?? false)
  };
}

export function parseEvidenceInput(input, organizationId, uploadedByUserId) {
  const country = optionalString(input.country);
  const region = optionalString(input.region);
  return {
    organizationId,
    facilityId: requiredString(input.facilityId, "facilityId"),
    title: requiredString(input.title, "title"),
    description: optionalString(input.description),
    evidenceType: normalizeEvidenceType(input.evidenceType),
    fileReference: optionalString(input.fileReference),
    fileName: optionalString(input.fileName),
    contentType: optionalString(input.contentType),
    fileSizeBytes: optionalInteger(input.fileSizeBytes),
    fileSha256: optionalString(input.fileSha256),
    uploadedByUserId,
    country,
    region,
    relatedObligationId: optionalString(input.relatedObligationId),
    documentDate: optionalString(input.documentDate),
    expirationDate: optionalString(input.expirationDate),
    status: normalizeEvidenceStatus(input.status ?? "pending"),
    confidence: normalizeConfidence(input.confidence ?? "medium"),
    reviewerNotes: optionalString(input.reviewerNotes),
    archived: Boolean(input.archived ?? false)
  };
}

export function normalizeEvidenceType(value) {
  const evidenceType = requiredString(value, "evidenceType");
  if (!EVIDENCE_TAXONOMY.includes(evidenceType)) {
    throw validationError(`evidenceType must be one of: ${EVIDENCE_TAXONOMY.join(", ")}`);
  }
  return evidenceType;
}

export function normalizeEvidenceStatus(status) {
  const normalized = String(status).trim();
  if (!EVIDENCE_STATUSES.includes(normalized)) {
    throw validationError(`status must be one of: ${EVIDENCE_STATUSES.join(", ")}`);
  }
  return normalized;
}

export function normalizeConfidence(confidence) {
  const normalized = String(confidence).trim();
  if (!["high", "medium", "low"].includes(normalized)) {
    throw validationError("confidence must be high, medium, or low");
  }
  return normalized;
}

export function isExpired(evidence, now = new Date()) {
  if (evidence.status === "expired") return true;
  if (!evidence.expirationDate) return false;
  const expires = new Date(evidence.expirationDate);
  if (Number.isNaN(expires.getTime())) return false;
  return expires.getTime() < now.getTime();
}

export function toPublicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

export function jsonOk(data, status = 200) {
  return { status, body: data };
}

export function jsonError(error) {
  const status = error.status || 500;
  return {
    status,
    body: {
      error: status === 500 ? "Internal server error" : error.message,
      code: error.code || "INTERNAL_ERROR",
      details: error.details
    }
  };
}
