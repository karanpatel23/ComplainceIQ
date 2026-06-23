import path from "node:path";
import { PDFParse } from "pdf-parse";

const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv", ".json", ".log", ".xml", ".yaml", ".yml"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff", ".bmp"]);

export async function extractEvidenceText({ buffer = null, fileName = null, evidence, maxChars, maxBytes = Number.POSITIVE_INFINITY }) {
  const metadataText = [evidence.title, evidence.description].filter(Boolean).join("\n").trim();
  if (!buffer) {
    return {
      text: metadataText.slice(0, maxChars),
      textExtractionStatus: "manual_metadata_only",
      truncated: metadataText.length > maxChars
    };
  }

  if (buffer.byteLength > maxBytes) {
    return {
      text: metadataText.slice(0, maxChars),
      textExtractionStatus: "extraction_failed",
      truncated: false,
      warning: "File exceeds the configured extraction size limit; manual review is required."
    };
  }

  const extension = path.extname(fileName || evidence.fileName || evidence.fileReference || "").toLowerCase();
  if (PDF_EXTENSIONS.has(extension)) return extractPdfText({ buffer, metadataText, maxChars });
  if (IMAGE_EXTENSIONS.has(extension)) {
    return {
      text: metadataText.slice(0, maxChars),
      textExtractionStatus: "ocr_required",
      truncated: false,
      warning: "Text could not be extracted. OCR or manual review required."
    };
  }
  if (!TEXT_EXTENSIONS.has(extension)) {
    return {
      text: metadataText.slice(0, maxChars),
      textExtractionStatus: "unsupported_for_text_extraction",
      truncated: false,
      warning: "This file type does not support text extraction; manual review is required."
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

async function extractPdfText({ buffer, metadataText, maxChars }) {
  if (buffer.byteLength < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return extractionFailure(metadataText, maxChars, "The PDF is corrupt or does not have a valid PDF header.");
  }
  let parser;
  try {
    parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const extracted = String(result.text || "").replace(/\u0000/g, "").trim();
    if (!extracted) {
      return {
        text: metadataText.slice(0, maxChars),
        textExtractionStatus: "ocr_required",
        truncated: false,
        warning: "Text could not be extracted. OCR or manual review required."
      };
    }
    const combined = [metadataText, extracted].filter(Boolean).join("\n");
    return {
      text: combined.slice(0, maxChars),
      textExtractionStatus: "extracted",
      truncated: combined.length > maxChars,
      pageCount: Number.isInteger(result.total) ? result.total : null
    };
  } catch (error) {
    const encrypted = /password|encrypted/i.test(String(error?.message || ""));
    return extractionFailure(metadataText, maxChars, encrypted
      ? "The PDF is encrypted and could not be extracted; manual review is required."
      : "The PDF could not be read safely; OCR or manual review may be required.");
  } finally {
    if (parser) await parser.destroy().catch(() => {});
  }
}

function extractionFailure(metadataText, maxChars, warning) {
  return {
    text: metadataText.slice(0, maxChars),
    textExtractionStatus: "extraction_failed",
    truncated: false,
    warning
  };
}
