import test from "node:test";
import assert from "node:assert/strict";
import { createOperationalLogger } from "../apps/api/src/operational-logger.js";

test("structured operational logs retain correlation fields and redact sensitive data", () => {
  let output = "";
  const logger = createOperationalLogger({ sink: { write(value) { output += value; } } });
  logger.error("processing_failed", {
    requestId: "request-123",
    organizationId: "org-1",
    jobId: "job-1",
    errorCode: "AI_TIMEOUT",
    durationMs: 25,
    password: "do-not-log",
    rawPrompt: "private prompt",
    documentText: "private evidence",
    employeeNames: ["Private Person"]
  });
  const record = JSON.parse(output);
  assert.equal(record.event, "processing_failed");
  assert.equal(record.requestId, "request-123");
  assert.equal(record.errorCode, "AI_TIMEOUT");
  assert.equal(output.includes("do-not-log"), false);
  assert.equal(output.includes("private prompt"), false);
  assert.equal(output.includes("private evidence"), false);
  assert.equal(output.includes("Private Person"), false);
});
