import path from "node:path";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log", ".xml", ".yaml", ".yml"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff", ".bmp"]);

export function extractEvidenceText({ buffer = null, fileName = null, evidence, maxChars }) {
  const metadataText = [evidence.title, evidence.description].filter(Boolean).join("\n").trim();
  if (!buffer) {
    return {
      text: metadataText.slice(0, maxChars),
      textExtractionStatus: "manual_metadata_only",
      truncated: metadataText.length > maxChars
    };
  }

  const extension = path.extname(fileName || evidence.fileName || evidence.fileReference || "").toLowerCase();
  if (!TEXT_EXTENSIONS.has(extension)) {
    const unsupportedKind = PDF_EXTENSIONS.has(extension) ? "PDF" : IMAGE_EXTENSIONS.has(extension) ? "image/scan" : "file type";
    return {
      text: metadataText.slice(0, maxChars),
      textExtractionStatus: "unsupported_for_text_extraction",
      truncated: false,
      warning: `${unsupportedKind} text extraction is not enabled; manual review is required.`
    };
  }

  const boundedBuffer = buffer.subarray(0, Math.min(buffer.length, maxChars * 4));
  const decoded = boundedBuffer.toString("utf8").replace(/\u0000/g, "").trim();
  const combined = [metadataText, decoded].filter(Boolean).join("\n");
  if (!combined) {
    return { text: "", textExtractionStatus: "empty", truncated: false, warning: "No extractable text was found." };
  }
  return {
    text: combined.slice(0, maxChars),
    textExtractionStatus: "extracted",
    truncated: combined.length > maxChars || buffer.length > boundedBuffer.length
  };
}
