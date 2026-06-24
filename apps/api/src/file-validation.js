import path from "node:path";

const ALLOWED_EXTENSIONS = new Map([
  [".pdf", "application/pdf"],
  [".txt", "text/plain"],
  [".md", "text/plain"],
  [".log", "text/plain"],
  [".csv", "text/csv"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".bmp", "image/bmp"]
]);

const DANGEROUS_EXTENSIONS = new Set([
  ".app", ".bat", ".cmd", ".com", ".cpl", ".dll", ".dmg", ".exe", ".hta",
  ".html", ".htm", ".jar", ".js", ".jse", ".mjs", ".msi", ".php", ".ps1",
  ".scr", ".sh", ".svg", ".vbs", ".wsf"
]);

const ARCHIVE_EXTENSIONS = new Set([".7z", ".bz2", ".docx", ".gz", ".rar", ".tar", ".tgz", ".xlsx", ".zip"]);
const GENERIC_DECLARED_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export function validateUploadedFile({ buffer, fileName, declaredContentType, maxBytes }) {
  const extension = path.extname(String(fileName || "")).toLowerCase();
  const declared = normalizeMime(declaredContentType);
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw fileError("EMPTY_FILE", "The selected file is empty.", { extension, declaredContentType: declared });
  if (buffer.length > maxBytes) throw fileError("FILE_TOO_LARGE", `File exceeds the configured ${Math.round(maxBytes / 1024 / 1024)} MB limit.`, { extension, declaredContentType: declared }, 413);

  const archiveType = detectArchive(buffer, extension);
  if (archiveType) {
    throw fileError("ARCHIVE_NOT_ALLOWED", "Archive and compressed files are not accepted. Upload the individual PDF, text, CSV, or image evidence file.", {
      extension,
      declaredContentType: declared,
      detectedContentType: archiveType
    });
  }
  if (DANGEROUS_EXTENSIONS.has(extension)) {
    throw fileError("DANGEROUS_FILE_TYPE", "Executable, script, HTML, and SVG files are not accepted as evidence.", { extension, declaredContentType: declared });
  }

  const detected = detectContentType(buffer, extension);
  if (!detected) {
    throw fileError("UNSUPPORTED_FILE_TYPE", "The file type could not be verified. Upload a PDF, plain-text, CSV, or supported image file.", { extension, declaredContentType: declared });
  }
  if (detected.dangerous) {
    throw fileError("ACTIVE_CONTENT_NOT_ALLOWED", detected.reason, { extension, declaredContentType: declared, detectedContentType: detected.mime });
  }

  const expected = ALLOWED_EXTENSIONS.get(extension);
  if (!expected) {
    throw fileError("UNSUPPORTED_FILE_EXTENSION", "This filename extension is not supported for evidence uploads.", { extension, declaredContentType: declared, detectedContentType: detected.mime });
  }
  if (!mimeMatches(expected, detected.mime)) {
    throw fileError("FILE_TYPE_MISMATCH", "The file contents do not match the filename extension.", { extension, declaredContentType: declared, detectedContentType: detected.mime });
  }
  if (!GENERIC_DECLARED_TYPES.has(declared) && !mimeMatches(declared, detected.mime)) {
    throw fileError("MIME_TYPE_MISMATCH", "The file contents do not match the declared content type.", { extension, declaredContentType: declared, detectedContentType: detected.mime });
  }

  return {
    extension,
    declaredContentType: declared || "application/octet-stream",
    detectedContentType: detected.mime,
    fileValidationStatus: "validated",
    fileValidationError: null
  };
}

export function detectContentType(buffer, extension = "") {
  if (startsWith(buffer, "%PDF-")) return { mime: "application/pdf" };
  if (matchesBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png" };
  if (matchesBytes(buffer, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg" };
  if (startsWith(buffer, "GIF87a") || startsWith(buffer, "GIF89a")) return { mime: "image/gif" };
  if (startsWith(buffer, "RIFF") && buffer.subarray(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp" };
  if (matchesBytes(buffer, [0x49, 0x49, 0x2a, 0x00]) || matchesBytes(buffer, [0x4d, 0x4d, 0x00, 0x2a])) return { mime: "image/tiff" };
  if (startsWith(buffer, "BM")) return { mime: "image/bmp" };
  if (matchesBytes(buffer, [0x4d, 0x5a]) || matchesBytes(buffer, [0x7f, 0x45, 0x4c, 0x46]) || isMachO(buffer)) {
    return { mime: "application/x-executable", dangerous: true, reason: "Executable files are not accepted as evidence." };
  }

  const text = decodeUtf8Text(buffer);
  if (text === null) return null;
  const probe = text.trimStart().slice(0, 512).toLowerCase();
  if (/(?:<!doctype\s+html|<html\b|<script\b|<iframe\b|<object\b|<\?php\b)/i.test(probe)) {
    return { mime: "text/html", dangerous: true, reason: "HTML and script content is not accepted as evidence." };
  }
  if (/<svg\b/i.test(probe)) {
    return { mime: "image/svg+xml", dangerous: true, reason: "SVG files are active content and are not accepted as evidence." };
  }
  if (/^#!/.test(probe)) {
    return { mime: "text/x-shellscript", dangerous: true, reason: "Script files are not accepted as evidence." };
  }
  return { mime: extension.toLowerCase() === ".csv" ? "text/csv" : "text/plain" };
}

export function detectArchive(buffer, extension = "") {
  if (ARCHIVE_EXTENSIONS.has(extension.toLowerCase())) return archiveMimeFromExtension(extension);
  if (matchesBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) || matchesBytes(buffer, [0x50, 0x4b, 0x05, 0x06]) || matchesBytes(buffer, [0x50, 0x4b, 0x07, 0x08])) return "application/zip";
  if (matchesBytes(buffer, [0x1f, 0x8b])) return "application/gzip";
  if (matchesBytes(buffer, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c])) return "application/x-7z-compressed";
  if (startsWith(buffer, "Rar!\u001a\u0007")) return "application/vnd.rar";
  return null;
}

function decodeUtf8Text(buffer) {
  if (buffer.includes(0)) return null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    if (!text) return null;
    const controlCount = [...text].filter((char) => {
      const code = char.charCodeAt(0);
      return code < 32 && ![9, 10, 12, 13].includes(code);
    }).length;
    return controlCount / text.length > 0.01 ? null : text;
  } catch {
    return null;
  }
}

function mimeMatches(expected, detected) {
  if (expected === detected) return true;
  if (expected === "text/plain" && detected === "text/csv") return true;
  if (expected === "text/csv" && detected === "text/plain") return true;
  if (["image/jpg", "image/pjpeg"].includes(expected) && detected === "image/jpeg") return true;
  return false;
}

function fileError(code, message, details, status = 415) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.fileValidation = details;
  return error;
}

function normalizeMime(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function matchesBytes(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);
}

function startsWith(buffer, value) {
  const prefix = Buffer.from(value, "binary");
  return buffer.length >= prefix.length && buffer.subarray(0, prefix.length).equals(prefix);
}

function isMachO(buffer) {
  const signatures = [[0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe], [0xcf, 0xfa, 0xed, 0xfe]];
  return signatures.some((signature) => matchesBytes(buffer, signature));
}

function archiveMimeFromExtension(extension) {
  const ext = extension.toLowerCase();
  if ([".zip", ".docx", ".xlsx"].includes(ext)) return "application/zip";
  if ([".gz", ".tgz"].includes(ext)) return "application/gzip";
  if (ext === ".7z") return "application/x-7z-compressed";
  if (ext === ".rar") return "application/vnd.rar";
  return "application/x-archive";
}
