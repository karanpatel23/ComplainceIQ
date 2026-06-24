import assert from "node:assert/strict";
import { ClamAvMalwareScanner, MockMalwareScanner, assertEvidenceDownloadAllowed, canProcessScannedEvidence } from "../apps/api/src/malware-scanner.js";

if (process.env.MALWARE_SCAN_ENABLED !== "true" || process.env.MALWARE_SCANNER_PROVIDER !== "clamav" || !process.env.CLAMAV_HOST) {
  process.stdout.write("SKIPPED: enable the clamav provider and set CLAMAV_HOST to validate a live scanner.\n");
  process.exit(0);
}

const config = {
  malwareScanFailPolicy: process.env.MALWARE_SCAN_FAIL_POLICY || "closed",
  malwareScanRequiredInProduction: process.env.MALWARE_SCAN_REQUIRED_IN_PRODUCTION === "true"
};
const scanner = new ClamAvMalwareScanner({
  host: process.env.CLAMAV_HOST,
  port: integer(process.env.CLAMAV_PORT || "3310", "CLAMAV_PORT"),
  timeoutMs: integer(process.env.CLAMAV_TIMEOUT_MS || process.env.MALWARE_SCAN_TIMEOUT_MS || "10000", "CLAMAV_TIMEOUT_MS")
});

const clean = await scanner.scanBuffer({ buffer: Buffer.from("ComplianceIQ closed-pilot scanner validation sample.\n") });
assert.equal(clean.status, "scan_clean", "Live scanner did not classify the clean sample as clean");

if (process.env.SCANNER_VALIDATE_EICAR === "true") {
  const eicar = ["X5O!P%@AP[4\\PZX54(P^)", "7CC)7}$EICAR-STANDARD-", "ANTIVIRUS-TEST-FILE!$H+H*"].join("");
  const suspicious = await scanner.scanBuffer({ buffer: Buffer.from(eicar) });
  assert.equal(suspicious.status, "scan_suspicious", "Live scanner did not flag the approved EICAR test sample");
} else {
  const simulated = await new MockMalwareScanner(() => ({ status: "scan_suspicious", error: "simulated validation signature" })).scanBuffer({ buffer: Buffer.from("simulation") });
  assert.equal(simulated.status, "scan_suspicious");
  process.stdout.write("NOTICE: suspicious-path behavior was simulated. Set SCANNER_VALIDATE_EICAR=true only in an approved scanner test environment for live EICAR validation.\n");
}

assert.equal(canProcessScannedEvidence({ scanStatus: "scan_failed" }, { ...config, malwareScanFailPolicy: "closed" }), false);
assert.throws(
  () => assertEvidenceDownloadAllowed({ scanStatus: "scan_suspicious", fileReference: "private/validation.txt" }, config),
  (error) => error.code === "FILE_BLOCKED_SUSPICIOUS"
);
const timeoutScanner = new ClamAvMalwareScanner({
  host: "validation.invalid",
  port: 3310,
  timeoutMs: 10,
  transport: async () => { const error = new Error("validation timeout"); error.code = "MALWARE_SCANNER_TIMEOUT"; throw error; }
});
await assert.rejects(() => timeoutScanner.scanBuffer({ buffer: Buffer.from("timeout") }), (error) => error.code === "MALWARE_SCANNER_TIMEOUT");
process.stdout.write("PASS: scanner clean path, suspicious blocking, timeout handling, and fail-closed behavior validated.\n");

function integer(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}
