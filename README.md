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

- `apps/api` - Node HTTP API, authentication, queue worker, scanning/storage adapters, reviewer operations, and protected downloads
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
- `QUEUE_BACKEND`, `QUEUE_CONCURRENCY`, `QUEUE_MAX_RETRIES`
- `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`
- `SIGNED_URL_EXPIRY_SECONDS`
- `MALWARE_SCAN_ENABLED`, `MALWARE_SCAN_REQUIRED_IN_PRODUCTION`, `MALWARE_SCANNER_PROVIDER`
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

Supported extraction includes bounded plain text (`.txt`, `.md`, `.csv`, `.json`, `.log`, `.xml`, `.yaml`, `.yml`) and digitally readable PDFs through `pdf-parse`. PDF input is size-bounded, extracted text is capped by `AI_MAX_FILE_TEXT_CHARS`, and corrupt or encrypted files fail into a visible review state. Images and scanned PDFs are marked `ocr_required`; an OCR provider interface and deterministic mock exist, but no production OCR engine is bundled.

## Evidence Processing Lifecycle

File intelligence is asynchronous:

1. the authenticated API validates and privately stores the upload;
2. the malware-scanning adapter records `scan_clean`, `scan_suspicious`, `scan_failed`, or `scan_unavailable`;
3. permitted evidence receives one active processing job;
4. the local worker claims queued jobs, extracts bounded text, calls the optional AI provider, validates output, and persists a new immutable analysis version;
5. the worker regenerates the deterministic gap matrix/action plan and marks the job completed;
6. failures retain a safe reason and retry with deterministic exponential delays up to `QUEUE_MAX_RETRIES`.

`QUEUE_BACKEND=local` is an in-process development/single-instance adapter. The repository job contract, timestamps, attempt counters, and Postgres `SKIP LOCKED` claim query form the boundary for a future Redis, SQS, RabbitMQ, or BullMQ worker. Upload requests never wait for AI completion; the UI polls active jobs.

## Malware Scanning

Scanning is an adapter boundary rather than a fake antivirus claim. The development mock can produce clean/suspicious outcomes for tests. Disabled scanning records `scan_unavailable`; that bypass can enter AI processing only outside production. Suspicious evidence is blocked from AI processing and authenticated download, and scan events are audit logged.

`MALWARE_SCAN_REQUIRED_IN_PRODUCTION=true` intentionally fails startup until an approved non-mock provider is configured. ComplianceIQ does not label the development mock as production protection.

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

`0003_ai_evidence_intelligence` adds tenant-scoped AI analysis and private file metadata. `0004_production_file_intelligence` adds scan state, bounded processing jobs, immutable analysis versions, lineage hashes, supersession links, queue claim indexes, and one-active-job/one-current-analysis constraints. PostgreSQL workers claim due jobs with `FOR UPDATE SKIP LOCKED`; external AI and file operations remain outside database transactions.

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

The Postgres integration test applies all tracked migrations, writes uniquely named tenant data, enqueues and processes evidence with mock AI, persists versioned analysis and human review, regenerates the matrix/action plan, writes packet metadata, reinitializes the repository, and verifies tenant isolation. It is explicitly skipped unless `TEST_DATABASE_URL` points to a disposable real Postgres database.

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
- `DELETE /api/evidence/:id`
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

Expert review and logs:

- `GET /api/expert-reviews`
- `POST /api/expert-reviews`
- `PATCH /api/expert-reviews/:id`
- `GET /api/audit-logs`

## Security Notes

- Passwords are hashed with Node `scrypt`.
- Sessions are persisted in the repository and signed with `SESSION_SECRET`.
- Session records are tenant-checked and survive API restart.
- Core routes require authentication.
- Customer-owned repository methods are scoped by `organizationId`.
- Cross-organization resource access returns `403`.
- Unsafe browser requests with an untrusted `Origin` are rejected.
- JSON and upload bodies are size-limited before full buffering.
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

The S3-compatible adapter uses the official AWS SDK and supports AWS S3, MinIO, R2-style endpoints, path-style addressing, explicit credentials, or the AWS credential chain. File references contain opaque private keys rather than public URLs. Downloads continue through tenant-authenticated API routes; direct signed URLs are not exposed by the current UI. Production configuration requires `STORAGE_BACKEND=s3`, bucket, and region. `S3_ENDPOINT` and path-style mode are optional for compatible providers.

## Deployment Checklist

- Run `npm ci`
- Set production environment variables
- Run `npm run db:migrate`
- Provision the first administrator with `npm run admin:provision`, then remove its `PROVISION_*` secrets
- Verify `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`
- Configure a private S3-compatible bucket for uploads and generated PDFs
- Configure an approved malware scanner adapter before allowing production file intelligence; the mock is rejected in production
- Size the local queue only for a single API instance, or replace it with a durable external queue before horizontal scaling
- Run the optional `TEST_DATABASE_URL=... npm test` Postgres integration check against disposable infrastructure
- Confirm CORS allows only trusted web origins
- Confirm demo data is disabled
- Verify `/api/health` reports the Postgres backend as healthy
- Verify the selected private object-storage adapter is durable and non-public

## Known Limitations

- Starter rules are demo/unverified unless expert-reviewed.
- Digitally readable PDF extraction is implemented; encrypted, corrupt, and scanned PDFs fail safely into review.
- OCR interfaces and test mocks exist, but no production OCR engine is bundled.
- The local queue is asynchronous and bounded but in-process; it is not durable across process crashes and is not suitable for multi-instance scheduling.
- The mock provider is for tests/development only and is rejected in production.
- The malware scanner is an interface plus development mock. Production file processing must remain disabled until an approved provider is added.
- S3-compatible storage is implemented, but bucket policies, KMS requirements, retention, lifecycle, and restore procedures remain deployment responsibilities.
- A real Postgres integration run still requires a disposable `TEST_DATABASE_URL`; the self-contained suite deliberately does not emulate Postgres.
- Login rate limiting and account recovery are not implemented yet.
- The static frontend is focused on the core workflow; future work can replace it with a richer React/Next app without moving compliance logic to the client.
- Province/state-specific Canadian and Mexican rule depth needs expert legal/EHS review before commercial reliance.

## Deployment Readiness Status

The application code, authenticated routes, deterministic backend logic, file-adapter restart tests, environment validation, and builds are passing. Do **not** call a deployment production-ready until both of these environment-dependent gates pass:

1. Run the integration suite against a disposable real Postgres instance via `TEST_DATABASE_URL`.
2. Configure and exercise a private S3-compatible bucket plus an approved malware-scanner adapter.

## Next Recommended Sprint

1. Replace the in-process queue with a durable Redis/SQS worker and add abandoned-job recovery/lease heartbeats.
2. Integrate an approved malware scanner and production OCR provider with extraction-quality metrics.
3. Run Postgres, S3-compatible, scanner, PDF, and AI mock integration suites in CI using disposable infrastructure.
4. Add content-type sniffing, decompression-bomb defenses, KMS/retention policy verification, rate limits, and AI cost controls.
