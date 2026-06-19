import { AI_PROMPT_VERSION, EVIDENCE_AI_JSON_SCHEMA, invalidAiOutput, validateEvidenceAiOutput } from "./schema.js";

const SYSTEM_INSTRUCTIONS = `You are an evidence classification service for industrial audit preparation. Classify only from the supplied taxonomy and applicable obligation list. Extract only fields explicitly supported by the document text. Use null or empty arrays when unknown. Never claim compliance, legal sufficiency, certification, regulator approval, or that no further action is needed. Do not invent citations. Suggestions require human review and deterministic rules remain authoritative.`;

export class OpenAiEvidenceProvider {
  constructor(config, fetchImpl = globalThis.fetch) {
    if (!config.openAiApiKey) throw providerConfigError("OPENAI_API_KEY is required for the OpenAI AI provider");
    if (!config.openAiModel) throw providerConfigError("OPENAI_MODEL is required for the OpenAI AI provider");
    if (typeof fetchImpl !== "function") throw providerConfigError("A fetch implementation is required for the OpenAI AI provider");
    this.apiKey = config.openAiApiKey;
    this.model = config.openAiModel;
    this.fetch = fetchImpl;
    this.reviewRequiredThreshold = config.aiReviewRequiredThreshold;
    this.kind = "openai";
  }

  async analyzeEvidenceDocument({ text, evidence, facility, applicableRules }) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await this.fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          instructions: SYSTEM_INSTRUCTIONS,
          input: buildEvidencePrompt({ text, evidence, facility, applicableRules }),
          text: {
            format: {
              type: "json_schema",
              name: "complianceiq_evidence_analysis",
              strict: true,
              schema: EVIDENCE_AI_JSON_SCHEMA
            }
          }
        })
      });
      if (!response.ok) {
        const error = new Error(`OpenAI evidence analysis failed with status ${response.status}`);
        error.status = 502;
        error.code = "AI_PROVIDER_ERROR";
        throw error;
      }
      const payload = await response.json();
      const outputText = getOutputText(payload);
      if (!outputText) throw invalidAiOutput("OpenAI response did not contain structured output text");
      let parsed;
      try {
        parsed = JSON.parse(outputText);
      } catch {
        throw invalidAiOutput("OpenAI response was not valid JSON");
      }
      return validateEvidenceAiOutput(parsed, { applicableRules, reviewRequiredThreshold: this.reviewRequiredThreshold });
    } catch (error) {
      if (error.name === "AbortError") {
        const timeoutError = new Error("OpenAI evidence analysis timed out");
        timeoutError.status = 504;
        timeoutError.code = "AI_PROVIDER_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class MockEvidenceAiProvider {
  constructor(config = {}, resolver = null) {
    this.model = "mock-evidence-v1";
    this.kind = "mock";
    this.reviewRequiredThreshold = config.aiReviewRequiredThreshold ?? 0.7;
    this.resolver = resolver;
  }

  async analyzeEvidenceDocument(context) {
    const output = this.resolver ? await this.resolver(context) : heuristicMockOutput(context);
    return validateEvidenceAiOutput(output, {
      applicableRules: context.applicableRules,
      reviewRequiredThreshold: this.reviewRequiredThreshold
    });
  }
}

export function createEvidenceAiProvider(config, options = {}) {
  if (!config.aiEnabled) return { kind: "disabled", model: null };
  if (config.aiProvider === "mock") return new MockEvidenceAiProvider(config, options.mockResolver);
  if (config.aiProvider === "openai") return new OpenAiEvidenceProvider(config, options.fetchImpl);
  throw providerConfigError(`Unsupported AI provider: ${config.aiProvider}`);
}

export function providerMetadata(provider) {
  return { provider: provider.kind, model: provider.model || null, promptVersion: AI_PROMPT_VERSION };
}

function buildEvidencePrompt({ text, evidence, facility, applicableRules }) {
  const obligations = applicableRules.map((rule) => ({
    id: rule.id,
    title: rule.title,
    requiredEvidenceTypes: rule.requiredEvidenceTypes,
    authority: rule.authority,
    citation: rule.citation
  }));
  return JSON.stringify({
    task: "Classify and extract this private evidence text, then suggest at most one applicable obligation match.",
    facility: { name: facility.name, country: facility.country, region: facility.region, industry: facility.industry },
    evidenceMetadata: { title: evidence.title, currentEvidenceType: evidence.evidenceType, fileName: evidence.fileName },
    applicableObligations: obligations,
    documentText: text
  });
}

function heuristicMockOutput({ text, evidence, applicableRules }) {
  const haystack = `${evidence.title || ""} ${text || ""}`.toLowerCase();
  const mappings = [
    [/forklift|powered industrial truck/, "forklift_training_records"],
    [/lockout|tagout|loto/, "loto_procedures"],
    [/safety data sheet|\bsds\b/, "sds_library"],
    [/hazard communication|hazcom/, "hazcom_training_records"],
    [/fire extinguisher/, "fire_extinguisher_inspections"],
    [/ppe|personal protective/, "ppe_training_records"],
    [/hazardous waste|manifest/, "hazardous_waste_manifests"],
    [/emergency action|evacuation/, "emergency_action_plan"]
  ];
  const detectedEvidenceType = mappings.find(([pattern]) => pattern.test(haystack))?.[1] || "other";
  const suggestedRule = applicableRules.find((rule) => rule.requiredEvidenceTypes.includes(detectedEvidenceType)) || null;
  const date = haystack.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] || null;
  const confidence = detectedEvidenceType === "other" ? 0.35 : 0.92;
  return {
    detectedEvidenceType,
    detectedTitle: evidence.title || "Evidence document",
    summary: detectedEvidenceType === "other" ? "The mock provider could not confidently classify this evidence." : `Likely ${detectedEvidenceType.replaceAll("_", " ")} evidence based on document text.`,
    documentDate: date,
    expirationDate: null,
    facilityName: null,
    employeeNames: [],
    equipmentNames: /forklift/.test(haystack) ? ["Forklift"] : [],
    chemicalNames: [],
    signaturePresent: null,
    authorityMentions: [],
    citationMentions: [],
    issues: detectedEvidenceType === "other" ? ["Document requires manual classification."] : [],
    confidence,
    needsHumanReview: detectedEvidenceType === "other",
    suggestedRuleId: suggestedRule?.id || null,
    suggestedObligationTitle: suggestedRule?.title || null,
    matchReason: suggestedRule ? "Detected evidence type appears in the obligation's required evidence taxonomy." : null,
    missingFieldsOrIssues: []
  };
}

function getOutputText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const output of payload.output || []) {
    for (const content of output.content || []) {
      if (typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function providerConfigError(message) {
  const error = new Error(message);
  error.code = "AI_PROVIDER_CONFIG_ERROR";
  return error;
}
