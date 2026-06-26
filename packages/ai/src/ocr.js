export class UnavailableOcrProvider {
  constructor() {
    this.kind = "unavailable";
    this.available = false;
  }

  async extractTextFromImage() {
    return ocrRequired();
  }

  async extractTextFromScannedPdf() {
    return ocrRequired();
  }
}

export class MockOcrProvider {
  constructor(resolver = null) {
    this.kind = "mock";
    this.available = true;
    this.resolver = resolver;
  }

  async extractTextFromImage(context) {
    return this.resolve({ ...context, sourceKind: "image" });
  }

  async extractTextFromScannedPdf(context) {
    return this.resolve({ ...context, sourceKind: "scanned_pdf" });
  }

  async resolve(context) {
    const result = this.resolver ? await this.resolver(context) : { text: "", confidence: 0, issues: ["Mock OCR returned no text."] };
    return {
      text: typeof result.text === "string" ? result.text : "",
      confidence: typeof result.confidence === "number" ? result.confidence : 0,
      issues: Array.isArray(result.issues) ? result.issues.map(String) : []
    };
  }
}

export function createOcrProvider(options = {}) {
  if (options.provider === "mock") return new MockOcrProvider(options.resolver);
  return new UnavailableOcrProvider();
}

function ocrRequired() {
  return {
    text: "",
    confidence: 0,
    issues: ["Text could not be extracted. OCR or manual review required."]
  };
}
