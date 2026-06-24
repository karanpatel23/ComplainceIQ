# ComplianceIQ

Industrial Audit Readiness Platform for Manufacturers.

ComplianceIQ helps manufacturers organize compliance evidence, use optional AI-assisted classification to structure uploaded documents, identify jurisdiction-specific audit gaps, assign corrective actions, and export professional audit-readiness packets. The product remains intentionally narrow: facility setup, evidence intelligence, evidence gap matrix, action plan, and audit packet export.

## Product Scope

ComplianceIQ supports North America at the architecture level:

- United States
- Canada
- Mexico

Starter rules are demo/unverified unless separately expert-reviewed. The system is audit-preparation and evidence organization support only. It is not legal advice and does not represent regulator certification or approval.

## Repository Structure

- `apps/api` - Node HTTP API, authentication, leased queue worker, verified file intake, scanning/storage adapters, structured operations logging, reviewer operations, and protected downloads
- `apps/web` - focused Audit Packet Builder frontend
- `packages/config` - environment validation
- `packages/ai` - validated provider abstraction, bounded text/PDF extraction, OCR-ready interface, and AI evidence contracts
- `packages/db` - tracked Postgres migrations plus production Postgres and development file repositories
- `packages/rules` - jurisdiction-specific rules packs, applicability, gap matrix, scoring, action plan
- `packages/pdf` - backend audit packet PDF generation
- `packages/shared` - validation and shared domain helpers
- `tests` - Node test coverage for rules, scoring, persistence, API auth/scoping, packet generation

The original Replit export was used as reference only. Replit artifacts, broad dashboards, frontend scoring engines, AI advisor modules, and demo-only enterprise clutter are not part of the new root app.

## Environment Variables

Copy `.env.example` to `.env` and set values for the target environment.

Required for production:

- `NODE_ENV=production`
- `PORT`
- `APP_URL`
- `ALLOWED_ORIGINS` without `*`
- `DATABASE_URL`
- `REPOSITORY_BACKEND=postgres`
- `SESSION_SECRET` with at least 32 characters
- `STORAGE_BACKEND=s3`
- `S3_BUCKET`
- `S3_REGION`
- `MAX_UPLOAD_MB`

Optional:

- `API_HOST` (defaults to `0.0.0.0` in production)
- `ENABLE_DEMO_DATA`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `TEST_DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `AI_ENABLED`
- `AI_PROVIDER`
- `AI_MAX_FILE_TEXT_CHARS`
- `AI_CONFIDENCE_THRESHOLD`
- `AI_REVIEW_REQUIRED_THRESHOLD`
- `QUEUE_BACKEND`, `QUEUE_CONCURRENCY`, `QUEUE_MAX_RETRIES`, `QUEUE_LEASE_MS`, `QUEUE_HEARTBEAT_MS`, `QUEUE_POLL_MS`, `QUEUE_SHUTDOWN_TIMEOUT_MS`
- `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`
- `SIGNED_URL_EXPIRY_SECONDS`
- `MALWARE_SCAN_ENABLED`, `MALWARE_SCAN_REQUIRED_IN_PRODUCTION`, `MALWARE_SCANNER_PROVIDER`, `MALWARE_SCAN_TIMEOUT_MS`, `MALWARE_SCAN_FAIL_POLICY`
- `CLAMAV_HOST`, `CLAMAV_PORT`
- `TRUST_PROXY`, `SESSION_COOKIE_SAME_SITE`
- SMTP variables

OpenAI and SMTP are optional. The core audit packet workflow works without them.

## AI Evidence Intelligence

AI Evidence Intelligence is an optional backend-only evidence organization layer. For supported text files it:

1. extracts bounded text and basic metadata;
2. classifies into the centralized evidence taxonomy;
3. extracts dates, names, equipment, chemicals, signatures, authority mentions, and issues when supported by the text;
4. suggests at most one applicable facility obligation;
5. stores confidence, provider/model lineage, processing status, and human-review state;
6. leaves deterministic rules and human decisions as the final authority.

AI does not provide legal advice, certify evidence, approve regulatory status, or decide that a facility is compliant. AI-only suggestions do not become accepted evidence. Manual selections and human overrides win; expired and rejected evidence never count as accepted.

The implemented providers are:

- `openai`: optional Responses API structured output, enabled only with explicit configuration.
- `mock`: deterministic test/development provider; production configuration rejects it.
- disabled mode: no key or AI dependency is required for the core workflow.

Enable OpenAI-backed analysis only in the backend environment:

```bash
AI_ENABLED=true
AI_PROVIDER=openai
OPENAI_API_KEY=replace-with-secret
OPENAI_MODEL=replace-with-approved-structured-output-model
AI_MAX_FILE_TEXT_CHARS=12000
AI_CONFIDENCE_THRESHOLD=0.8
AI_REVIEW_REQUIRED_THRESHOLD=0.7
```

Do not expose `OPENAI_API_KEY` to the web app. Model output is validated against a strict application schema and applicable rule IDs before storage. Raw prompts, extracted document text, and raw model output are not stored.

Supported upload types are verified PDFs, plain text (`.txt`, `.md`, `.log`), CSV, and signature-verified PNG, JPEG, GIF, WebP, TIFF, and BMP images. PDF extraction uses `pdf-parse`; extracted text is capped by `AI_MAX_FILE_TEXT_CHARS`, and corrupt, encrypted, or scanned PDFs fail into a visible review state. Images and scanned PDFs are marked `ocr_required`; an OCR provider interface and deterministic mock exist, but no production OCR engine is bundled.

## File Intake Validation

The API validates decoded size, filename extension, declared MIME type, and detected content signature before writing an upload to private storage. Generic browser MIME types are tolerated only when the content and supported extension can be verified. Executables, scripts, HTML, SVG, unknown binary files, Office ZIP containers, and every archive/compressed format are rejected with a clear error and a tenant-scoped audit event. Archives are never extracted, so decompression bombs, excessive archive entry counts, and ZIP path traversal never enter the extraction pipeline. Rejected files are not scanned, queued, or sent to AI.

## Evidence Processing Lifecycle

File intelligence is asynchronous:

1. the authenticated API validates and privately stores the upload;
2. the malware-scanning adapter records `scan_clean`, `scan_suspicious`, `scan_failed`, or `scan_unavailable`;
3. permitted evidence receives one active processing job;
4. the local worker atomically claims a queued job with a worker ID, opaque lease, expiry, and heartbeat, then extracts bounded text, calls the optional AI provider, validates output, and persists a new immutable analysis version;
5. the worker regenerates the deterministic gap matrix/action plan and marks the job completed;
6. failures retain a safe reason and retry with deterministic exponential delays up to `QUEUE_MAX_RETRIES`; an exhausted job enters `dead_letter` for operator review.

`QUEUE_BACKEND=local` schedules work in the API process, while the job state and leases live in the repository. PostgreSQL uses `FOR UPDATE SKIP LOCKED`, partial claim indexes, compare-and-set lease completion, heartbeats, stale-lease recovery, bounded retries, and dead-letter state. Multiple workers cannot successfully own the same lease. Graceful shutdown stops new claims and waits up to `QUEUE_SHUTDOWN_TIMEOUT_MS` for active work. The adapter boundary remains suitable for a future Redis, SQS, RabbitMQ, or BullMQ scheduler. Upload requests never wait for AI completion; the UI polls active jobs.

## Malware Scanning

Scanning is an adapter boundary rather than a fake antivirus claim. The development mock can produce clean/suspicious outcomes for tests. The production-capable `clamav` provider streams bounded file bytes to a ClamAV-compatible daemon using `INSTREAM`, maps clean/suspicious results, and enforces `MALWARE_SCAN_TIMEOUT_MS`. Disabled scanning records `scan_unavailable`. Suspicious evidence remains quarantined in private storage and is blocked from AI processing and authenticated download. Scan events are audit logged.

`MALWARE_SCAN_FAIL_POLICY=closed` blocks processing when scanning fails or is unavailable; `open` is intended only for controlled non-production use. `MALWARE_SCAN_REQUIRED_IN_PRODUCTION=true` requires enabled `clamav` scanning and a closed failure policy at startup. ComplianceIQ does not label the development mock as production protection. Deployments must still validate their chosen daemon version, signatures, network policy, scaling, and alerting.

## AI Analysis Versioning

Every reprocessing job creates a new `analysisVersion` linked through `previousAnalysisId`. Earlier model/provider/prompt metadata, content/output hashes, results, and timestamps remain available through the protected history endpoint. One row is explicitly current; human decisions update review/override fields without deleting prior model output. Audit packets use the current final reviewed state.

## Evidence Review Queue

Reviewer/admin users receive a focused Evidence Review Queue inside the Audit Packet Builder. It groups and filters tenant-scoped work by facility, confidence, extraction/OCR failure, suspicious scan, expiry/rejection, unmatched evidence, processing failure, and obligation priority impact. Review actions reuse the protected human-review API and immediately regenerate deterministic gap/action results.

## Local Setup

This rebuild uses npm scripts and Node 20+. Root scripts load `.env` when it exists.

```bash
npm install
cp .env.example .env
# Edit .env to configure Postgres and replace every placeholder.
npm run db:migrate
npm run typecheck
npm test
```

For a quick development smoke test without Postgres:

```bash
REPOSITORY_BACKEND=file DATABASE_URL= NODE_ENV=development SESSION_SECRET=development-secret-change-me npm run dev
```

The file repository is only for local development and tests. Production must use Postgres.

## Database Setup

Provision Postgres, set `DATABASE_URL`, then run the tracked migration runner:

```bash
REPOSITORY_BACKEND=postgres npm run db:migrate
```

`schema_migrations` records each migration and an advisory lock prevents concurrent deploys from applying the same migration. `0001_initial` creates:

- `organizations`
- `users`
- `user_sessions`
- `rules_packs`
- `compliance_rules`
- `facilities`
- `facility_applicable_rules`
- `evidence`
- `evidence_matches`
- `audit_readiness_reviews`
- `evidence_gap_rows`
- `findings`
- `action_items`
- `audit_packets`
- `expert_reviews`
- `audit_logs`

Customer-owned tables include `organization_id` and indexes for tenant-scoped access.
Evidence matches are persisted when a backend review is generated, so the rule-to-evidence relationship survives API restarts along with gap rows, findings, action items, and packet metadata.

`0002_persistence_hardening` persists `selected_rules_pack_id` on facilities, adds integrity constraints, and adds composite and foreign-key indexes for tenant-scoped access patterns. The API uses a bounded Postgres connection pool with connection, idle, and statement timeouts.

`0003_ai_evidence_intelligence` adds tenant-scoped AI analysis and private file metadata. `0004_production_file_intelligence` adds scan state, bounded processing jobs, immutable analysis versions, lineage hashes, supersession links, queue claim indexes, and one-active-job/one-current-analysis constraints. `0005_pilot_readiness_hardening` adds detected file metadata, deletion/retention foundations, storage-deletion outcomes, worker ownership, leases, heartbeats, dead-letter state, and supporting partial/foreign-key indexes. PostgreSQL workers claim due jobs with `FOR UPDATE SKIP LOCKED`; external AI and file operations remain outside database transactions.

## Development Seed

Demo seed is explicit and disabled by default.

```bash
NODE_ENV=development \
ENABLE_DEMO_DATA=true \
REPOSITORY_BACKEND=postgres \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='set-a-real-development-password' \
npm run seed:demo
```

Production refuses to run demo seed.
The explicit development seed creates one clearly labeled demo organization, hashed-password administrator, facility, evidence record, and deterministic review. It is idempotent for that organization and never runs automatically.

## Initial Production Administrator

After migrations, provision the first organization administrator with the dedicated one-time command. It is separate from demo seed logic, requires a password of at least 14 characters, refuses to overwrite an existing user, and records an audit event.

Set these secrets in the deployment environment rather than committing them:

```bash
PROVISION_ORGANIZATION_NAME='Example Manufacturing' \
PROVISION_ADMIN_NAME='Operations Admin' \
PROVISION_ADMIN_EMAIL='admin@example.com' \
PROVISION_ADMIN_PASSWORD='replace-with-a-strong-password' \
NODE_ENV=production \
REPOSITORY_BACKEND=postgres \
DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/complianceiq' \
npm run admin:provision
```

Remove the four `PROVISION_*` values from the deployment environment after the command succeeds. Additional users should be created through an authenticated administration workflow.

## Running The App

API:

```bash
npm run dev
```

Web:

```bash
npm --workspace @complianceiq/web run dev
```

Open `http://localhost:5173`. The frontend expects the API at `http://localhost:4000` by default.

## Running Tests

The default suite is self-contained and uses the non-production file adapter:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

To exercise the real Postgres repository adapter, provide a disposable test database URL:

```bash
TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/complianceiq_test npm test
```

The Postgres integration test creates an isolated schema in the supplied database, applies all tracked migrations, writes tenant/user/facility/evidence/job/AI/review/match/gap/action/packet/audit data, restarts the repository, verifies tenant isolation, then drops the schema. It is explicitly skipped unless `TEST_DATABASE_URL` points to disposable infrastructure and the test role can create/drop schemas.

To exercise a real S3-compatible private bucket:

```bash
TEST_S3_BUCKET=complianceiq-test \
TEST_S3_REGION=ca-central-1 \
TEST_S3_ENDPOINT=http://127.0.0.1:9000 \
TEST_S3_ACCESS_KEY_ID=replace-me \
TEST_S3_SECRET_ACCESS_KEY=replace-me \
TEST_S3_FORCE_PATH_STYLE=true \
npm test
```

The conditional S3 integration uploads an opaque private key, retrieves the bytes through the adapter, creates a server-side bounded 120-second signed URL and verifies its expiry/content, deletes the object, and confirms it is unavailable. The product UI does not expose signed URLs; normal evidence and packet downloads remain authenticated, tenant-scoped backend routes. The test skips clearly unless the required `TEST_S3_*` variables exist.

Browser smoke testing is deterministic and does not use OpenAI:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright starts isolated file-backed API and web processes, logs in as a local pilot administrator, creates a facility, logs manual evidence, generates a gap matrix/action plan, verifies the reviewer queue, and exports a packet.

## API Summary

Auth:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Facilities:

- `GET /api/facilities`
- `POST /api/facilities`
- `GET /api/facilities/:id`
- `PATCH /api/facilities/:id`
- `DELETE /api/facilities/:id`
- `GET /api/facilities/:id/applicable-rules`

Rules:

- `GET /api/rules-packs`
- `GET /api/rules-packs/:id`
- `GET /api/rules`

Evidence:

- `GET /api/evidence?facilityId=...`
- `POST /api/evidence`
- `POST /api/evidence/upload`
- `GET /api/evidence/:id`
- `PATCH /api/evidence/:id`
- `DELETE /api/evidence/:id?reason=...` (admin/reviewer; archives metadata and deletes the private object)
- `GET /api/evidence/:id/download`
- `POST /api/evidence/:id/process-ai`
- `POST /api/evidence/:id/retry-processing` (admin/reviewer)
- `GET /api/evidence/:id/ai-analysis`
- `GET /api/evidence/:id/ai-analyses` (version history)
- `PATCH /api/evidence/:id/ai-review` (admin/reviewer)
- `GET /api/evidence-ai-analyses?facilityId=...`
- `GET /api/evidence-processing-jobs?facilityId=...`
- `GET /api/evidence-review-queue?facilityId=...&status=...&priority=...` (admin/reviewer)
- `GET /api/evidence-taxonomy`
- `GET /api/ai/status`

Audit readiness:

- `GET /api/audit-readiness/reviews`
- `POST /api/audit-readiness/reviews`
- `GET /api/audit-readiness/reviews/:id`
- `GET /api/audit-readiness/reviews/:id/gap-matrix`
- `GET /api/audit-readiness/reviews/:id/score`
- `GET /api/audit-readiness/reviews/:id/action-plan`

Audit packets:

- `GET /api/audit-packets`
- `POST /api/audit-packets/export`
- `GET /api/audit-packets/:id/download`
- `DELETE /api/audit-packets/:id?reason=...` (admin/reviewer; archives metadata and deletes the private PDF)

Expert review and logs:

- `GET /api/expert-reviews`
- `POST /api/expert-reviews`
- `PATCH /api/expert-reviews/:id`
- `GET /api/audit-logs`

Health:

- `GET /health/live` - process-only liveness; does not call dependencies
- `GET /health/ready` - database, private storage, queue, and loaded-config readiness
- `GET /health` and `GET /api/health` - readiness aliases for deployment compatibility

## Security Notes

- Passwords are hashed with Node `scrypt`.
- Sessions are persisted in the repository and signed with `SESSION_SECRET`.
- Session records are tenant-checked and survive API restart.
- Core routes require authentication.
- Customer-owned repository methods are scoped by `organizationId`.
- Cross-organization resource access returns `403`.
- Unsafe browser requests with an untrusted `Origin` are rejected.
- JSON and upload bodies are size-limited before full buffering.
- Upload content is signature-sniffed and checked against declared MIME and extension before storage; archives and active content are rejected.
- Expert review requests validate referenced facilities and reviews against the caller's organization.
- Evidence and packet files are private file references and download through authenticated API routes.
- Suspicious files are blocked before AI processing and before download; scan results and queue transitions are audit logged without raw file content.
- S3 objects are written without public ACLs, use opaque keys, and remain behind authenticated backend downloads.
- Client-supplied private file references are ignored; only backend storage writes can attach files.
- AI calls occur only on the backend, receive bounded extracted text, and never run inside database transactions.
- AI analyses, immutable history, processing jobs, reviewer queue rows, and human overrides are tenant-scoped; override/retry actions require admin or reviewer role and create audit events.
- Raw document text and raw model responses are not stored in AI rows or audit logs.
- The frontend escapes persisted content before rendering and restores the current session and latest persisted review after reload.
- `SESSION_SECRET`, `DATABASE_URL`, and production CORS are validated at startup.
- API and static responses set CSP, nosniff, referrer, permissions, and frame protections; production API responses also set HSTS.
- Production session cookies are `Secure`, `HttpOnly`, and configurable as `SameSite=Lax|Strict|None`. `TRUST_PROXY=true` should be set only behind a trusted proxy that overwrites forwarding headers.

## Structured Operational Logging

The API writes newline-delimited JSON operational logs with request IDs and safe correlation fields for HTTP requests, uploads, facility/evidence/job identifiers, processing state, status code, error code, and duration. Queue logs include worker and job correlation. A denylist redacts authorization/cookie/secret/password/token/prompt/raw-content/document-text/employee-name fields. Raw documents, prompts, model responses, and file bytes are never intentionally written to operational logs. Tenant audit logs remain separate persisted product records.

## Retention And Deletion Foundation

Evidence and packet records carry archive/deletion actor, time, reason, optional retention date, and private-storage deletion status/error fields. Admin/reviewer `DELETE` routes explicitly delete the private object, preserve the soft-deleted metadata and audit history, and log the outcome. A failed object deletion returns a visible `502`, records `storageDeletionStatus=failed`, and does not silently pretend deletion succeeded. The current implementation does not run scheduled retention jobs, legal holds, restoration, immutable/WORM storage, or customer-configurable retention policies; those remain deployment/product work.

## Rules And Scoring

Rules packs live in `packages/rules`.

The deterministic readiness score is:

```text
100
- 25 * criticalMissing
- 15 * highMissing
- 8 * mediumMissing
- 10 * expiredEvidence
- 5 * rejectedEvidence
```

The result is clamped between 0 and 100, and the score explanation is persisted with each review.

## Storage

Storage is selected through a private-storage adapter factory. The local adapter uses randomized references, traversal protection, restrictive filesystem permissions, size limits, and authenticated API downloads:

- `STORAGE_BACKEND=local`
- `UPLOAD_DIR=data/private-storage`

The S3-compatible adapter uses the official AWS SDK and supports AWS S3, MinIO, R2-style endpoints, path-style addressing, explicit credentials, or the AWS credential chain. File references contain opaque private keys rather than public URLs. Downloads continue through tenant-authenticated API routes; direct signed URLs are not exposed by the current UI. A server-only helper can create URLs bounded by `SIGNED_URL_EXPIRY_SECONDS` (60–3600 seconds) for integration/deployment validation. Production configuration requires `STORAGE_BACKEND=s3`, bucket, and region. `S3_ENDPOINT` and path-style mode are optional for compatible providers.

## CI

`.github/workflows/ci.yml` runs `npm ci`, lint, typecheck, self-contained tests, build, prohibited-claim scanning, deterministic-random scanning, and a Chromium Playwright smoke job. PostgreSQL and S3 integration tests use the same suite and remain skipped unless corresponding GitHub secrets are configured. CI does not require OpenAI.

## Deployment Checklist

- Run `npm ci`
- Set production environment variables
- Run `npm run db:migrate`
- Provision the first administrator with `npm run admin:provision`, then remove its `PROVISION_*` secrets
- Verify `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`
- Configure a private S3-compatible bucket for uploads and generated PDFs
- Configure and validate the `clamav` scanner adapter with current signatures, a closed failure policy, timeout monitoring, and `MALWARE_SCAN_REQUIRED_IN_PRODUCTION=true`; the mock is rejected in production
- Size queue concurrency, lease, heartbeat, retry, shutdown, database-pool, and AI-provider limits for the pilot workload
- Run the optional `TEST_DATABASE_URL=... npm test` Postgres integration check against disposable infrastructure
- Run the optional `TEST_S3_*=... npm test` private-bucket integration check
- Run `npm run test:e2e` after installing Chromium with Playwright
- Confirm CORS allows only trusted web origins
- Configure TLS termination and set `TRUST_PROXY=true` only when the trusted reverse proxy overwrites forwarding headers
- Confirm demo data is disabled
- Verify `/health/live` and `/health/ready` through the deployment load balancer
- Verify the selected private object-storage adapter is durable and non-public
- Configure log collection/retention without capturing document bodies or secrets
- Define pilot retention, object lifecycle, backup/restore, incident response, and deletion-retry procedures

## Known Limitations

- Starter rules are demo/unverified unless expert-reviewed.
- Digitally readable PDF extraction is implemented; encrypted, corrupt, and scanned PDFs fail safely into review.
- OCR interfaces and test mocks exist, but no production OCR engine is bundled.
- Queue jobs and leases are durable in PostgreSQL, but scheduling still runs inside API processes. A dedicated external worker/queue remains preferable for independent scaling, back-pressure, and maintenance windows.
- The mock provider is for tests/development only and is rejected in production.
- A ClamAV-compatible production transport is implemented, but scanner infrastructure, signature freshness, capacity, alerting, and operational approval remain deployment responsibilities.
- S3-compatible storage is implemented, but bucket policies, customer-managed KMS requirements, legal holds, retention, lifecycle, deletion retry, and restore procedures remain deployment responsibilities.
- A real Postgres integration run still requires a disposable `TEST_DATABASE_URL`; the self-contained suite deliberately does not emulate Postgres.
- A real S3 integration run still requires private `TEST_S3_*` infrastructure; the self-contained suite uses a mock client.
- Archives and Office ZIP containers are intentionally unsupported. DOCX parsing may be added only with bounded entry/count/size controls and path-safe extraction.
- Images and scanned PDFs still require a production OCR provider or human review.
- Scheduled retention enforcement, legal holds, deletion retry workers, and restore UI are not implemented.
- Login rate limiting and account recovery are not implemented yet.
- The static frontend is focused on the core workflow; future work can replace it with a richer React/Next app without moving compliance logic to the client.
- Province/state-specific Canadian and Mexican rule depth needs expert legal/EHS review before commercial reliance.

## Deployment Readiness Status

The application includes pilot-oriented infrastructure validation paths, but this repository alone does not prove a deployment production-ready. Before handling pilot customer files, all environment-dependent gates must pass in the target environment:

1. Run the isolated integration suite against real PostgreSQL via `TEST_DATABASE_URL`.
2. Exercise the target private bucket via `TEST_S3_*`, including signed expiry and deletion.
3. Validate the deployed ClamAV-compatible scanner with clean, suspicious, timeout, and unavailable cases under the chosen fail policy.
4. Verify liveness/readiness, structured log delivery, graceful worker shutdown, backup/restore, retention/deletion procedures, and Playwright smoke tests in staging.

## Next Recommended Sprint

1. Separate processing into a deployable worker using Redis/SQS/BullMQ while preserving the lease/idempotency repository contract.
2. Add a production OCR provider with extraction-quality metrics and human-review sampling.
3. Add scheduled deletion retries, customer retention policies, legal holds, KMS-policy verification, and restore drills.
4. Add login throttling, account recovery, operational dashboards/alerts, and AI budget controls.
