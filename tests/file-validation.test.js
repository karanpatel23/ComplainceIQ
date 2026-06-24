import test from "node:test";
import assert from "node:assert/strict";
import { detectArchive, validateUploadedFile } from "../apps/api/src/file-validation.js";

const maxBytes = 1024 * 1024;

test("file validation accepts verified PDF, text, CSV, and image signatures", () => {
  assert.equal(validateUploadedFile({ buffer: Buffer.from("%PDF-1.4\n%%EOF"), fileName: "record.pdf", declaredContentType: "application/pdf", maxBytes }).detectedContentType, "application/pdf");
  assert.equal(validateUploadedFile({ buffer: Buffer.from("Lockout procedure"), fileName: "record.txt", declaredContentType: "text/plain", maxBytes }).detectedContentType, "text/plain");
  assert.equal(validateUploadedFile({ buffer: Buffer.from("employee,course\nA,LOTO"), fileName: "training.csv", declaredContentType: "text/csv", maxBytes }).detectedContentType, "text/csv");
  assert.equal(validateUploadedFile({ buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), fileName: "scan.png", declaredContentType: "image/png", maxBytes }).detectedContentType, "image/png");
});

test("file validation rejects declared MIME, extension, executable, HTML, SVG, and unknown binary mismatches", () => {
  assert.throws(() => validateUploadedFile({ buffer: Buffer.from("plain text"), fileName: "fake.pdf", declaredContentType: "application/pdf", maxBytes }), (error) => error.code === "FILE_TYPE_MISMATCH");
  assert.throws(() => validateUploadedFile({ buffer: Buffer.from("plain text"), fileName: "record.txt", declaredContentType: "application/pdf", maxBytes }), (error) => error.code === "MIME_TYPE_MISMATCH");
  assert.throws(() => validateUploadedFile({ buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00]), fileName: "program.exe", declaredContentType: "application/octet-stream", maxBytes }), (error) => error.code === "DANGEROUS_FILE_TYPE");
  assert.throws(() => validateUploadedFile({ buffer: Buffer.from("<!doctype html><script>alert(1)</script>"), fileName: "page.txt", declaredContentType: "text/plain", maxBytes }), (error) => error.code === "ACTIVE_CONTENT_NOT_ALLOWED");
  assert.throws(() => validateUploadedFile({ buffer: Buffer.from("<svg><script /></svg>"), fileName: "drawing.txt", declaredContentType: "text/plain", maxBytes }), (error) => error.code === "ACTIVE_CONTENT_NOT_ALLOWED");
  assert.throws(() => validateUploadedFile({ buffer: Buffer.from([0x00, 0x01, 0x02, 0xff]), fileName: "data.bin", declaredContentType: "application/octet-stream", maxBytes }), (error) => error.code === "UNSUPPORTED_FILE_TYPE");
});

test("archives are rejected before extraction, including disguised ZIP payloads", () => {
  const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0xff, 0xff, 0xff]);
  assert.equal(detectArchive(zip, ".txt"), "application/zip");
  assert.throws(() => validateUploadedFile({ buffer: zip, fileName: "disguised.txt", declaredContentType: "text/plain", maxBytes }), (error) => error.code === "ARCHIVE_NOT_ALLOWED");
  assert.throws(() => validateUploadedFile({ buffer: Buffer.from("../../escape"), fileName: "evidence.zip", declaredContentType: "application/zip", maxBytes }), (error) => error.code === "ARCHIVE_NOT_ALLOWED");
});
