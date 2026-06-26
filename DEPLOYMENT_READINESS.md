# ComplianceIQ Deployment Readiness

Status date: 2026-06-25

## 1. Current readiness status

ComplianceIQ is ready for local and CI pilot-workflow testing and is structurally ready for a split staging deployment. It is not yet a one-click all-Vercel production app.

Go for Vercel frontend testing: yes, once `WEB_API_ORIGIN` points to a deployed HTTPS API.

Go for real pilot evidence: not until target-environment PostgreSQL, private storage, scanner, API, worker, backups, and smoke validation pass.

## 2. Backend status

The backend is a custom Node HTTP API with signed cookie sessions, organization-scoped repository methods, protected evidence and packet downloads, role-gated reviewer actions, health/readiness endpoints, and structured operational logs. It should run on a persistent Node host or container for pilot use.

The current API is not packaged as a Vercel serverless function. Deploying it to Vercel serverless would require an entrypoint/runtime adaptation and proof around request duration, file streaming, cookie/CORS behavior, scanner network access, and queue behavior.

## 3. Frontend status

The frontend is a static Audit Packet Builder app under `apps/web`. It can be deployed on Vercel using the root `vercel.json`, which builds `apps/web/dist`.

Production web builds require:

```bash
WEB_API_ORIGIN=https://your-api.example.com
```

The build intentionally fails if the production API origin is missing, non-HTTPS, or localhost.

## 4. AI status

AI Evidence Intelligence is backend-only and optional. The app works with `AI_ENABLED=false`. Mock AI supports deterministic local/CI testing. OpenAI mode requires `AI_ENABLED=true`, `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.

AI output is validated against the evidence taxonomy and applicable facility rules before storage. AI suggestions do not accept evidence by themselves; human review and deterministic rules remain authoritative.

## 5. Database status

Postgres migrations exist for organizations, users, sessions, facilities, rules, evidence, matches, reviews, gap rows, findings, action items, packets, expert reviews, audit logs, AI analyses, processing jobs, scan/deletion metadata, and queue lease fields.

The migration runner records migrations in `schema_migrations` and uses an advisory lock. The Postgres queue claim path uses `FOR UPDATE SKIP LOCKED`.

Still required before pilot: run migrations and `npm run validate:postgres` against disposable/staging Postgres.

## 6. Storage status

Local private storage is suitable only for development/testing. Production profiles require `STORAGE_BACKEND=s3` with a private S3-compatible bucket. Evidence and packet downloads go through authenticated backend routes; raw public object URLs are not exposed by the UI.

Still required before pilot: run `npm run validate:storage` against the target-compatible test bucket and confirm anonymous object reads fail.

## 7. Queue/worker status

The queue state is repository-backed. API-only mode enqueues jobs without claiming. Worker-only mode polls, claims due jobs, heartbeats leases, retries within bounds, recovers stale leases, and dead-letters exhausted jobs. Local development can run API and worker together.

Production/staging must deploy API and worker as separate process groups:

```bash
PROCESS_ROLE=api npm run start:api
PROCESS_ROLE=worker npm run start:worker
```

Do not run `PROCESS_ROLE=api-and-worker` in staging or closed-pilot production.

## 8. Malware scanning status

The development mock scanner is only for tests/local development. Closed pilot requires enabled ClamAV-compatible scanning with a closed failure policy:

```bash
MALWARE_SCAN_ENABLED=true
MALWARE_SCAN_REQUIRED_IN_PRODUCTION=true
MALWARE_SCANNER_PROVIDER=clamav
MALWARE_SCAN_FAIL_POLICY=closed
```

Still required before pilot: validate clean, suspicious, timeout, and unavailable scanner behavior from the deployment network.

## 9. Security status

Implemented:

- authenticated core routes;
- organization-scoped repository access;
- 401 for unauthenticated requests;
- 403 for cross-organization resources;
- role gates for reviewer/admin actions;
- private evidence and packet downloads;
- upload size limits and signature checks;
- active content/archive rejection;
- suspicious-file processing/download blocks;
- production fail-fast config for strong sessions, HTTPS origins, S3 storage, and non-mock scanner rules;
- structured logs without raw document text or secrets by design.

Still required before pilot:

- login throttling/account recovery;
- secret rotation procedure;
- backup/restore exercise;
- retention/deletion retry operations;
- deployed ingress/proxy verification.

## 10. Vercel deployment guidance

Recommended:

1. Deploy only the static web frontend to Vercel.
2. Deploy API to a persistent Node/container host.
3. Deploy worker to a separate persistent Node/container host.
4. Use managed PostgreSQL.
5. Use private S3-compatible storage.
6. Use a private ClamAV-compatible scanner service.

Vercel settings:

- Root directory: repository root
- Build command: `npm run build:web`
- Output directory: `apps/web/dist`
- Required env: `WEB_API_ORIGIN=https://your-api.example.com`

Add the Vercel frontend URL to API `ALLOWED_ORIGINS`.

## 11. Required env vars

Core production:

```bash
NODE_ENV=production
DEPLOYMENT_PROFILE=staging
PROCESS_ROLE=api
PORT=4000
APP_URL=https://your-web.example.com
ALLOWED_ORIGINS=https://your-web.example.com
WEB_API_ORIGIN=https://your-api.example.com
DATABASE_URL=postgresql://...
REPOSITORY_BACKEND=postgres
SESSION_SECRET=replace-with-32-plus-character-secret
STORAGE_BACKEND=s3
S3_BUCKET=...
S3_REGION=...
MAX_UPLOAD_MB=25
```

Worker:

```bash
PROCESS_ROLE=worker
WORKER_HEALTH_PORT=4001
WORKER_HEALTH_HOST=0.0.0.0
QUEUE_BACKEND=local
QUEUE_CONCURRENCY=1
QUEUE_MAX_RETRIES=3
QUEUE_LEASE_MS=300000
QUEUE_HEARTBEAT_MS=30000
QUEUE_POLL_MS=1000
QUEUE_SHUTDOWN_TIMEOUT_MS=30000
```

AI:

```bash
AI_ENABLED=false
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
AI_MAX_FILE_TEXT_CHARS=12000
AI_CONFIDENCE_THRESHOLD=0.8
AI_REVIEW_REQUIRED_THRESHOLD=0.7
```

S3-compatible storage:

```bash
S3_ENDPOINT=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=false
SIGNED_URL_EXPIRY_SECONDS=300
```

Scanner:

```bash
MALWARE_SCAN_ENABLED=true
MALWARE_SCAN_REQUIRED_IN_PRODUCTION=true
MALWARE_SCANNER_PROVIDER=clamav
MALWARE_SCAN_FAIL_POLICY=closed
CLAMAV_HOST=scanner.internal
CLAMAV_PORT=3310
CLAMAV_TIMEOUT_MS=10000
```

## 12. Validation commands

Local:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run scan:claims
npm run scan:random
npx playwright install chromium
npm run qa:pilot
```

External validation:

```bash
TEST_DATABASE_URL=postgresql://... npm run validate:postgres
TEST_S3_BUCKET=... TEST_S3_REGION=... TEST_S3_ACCESS_KEY_ID=... TEST_S3_SECRET_ACCESS_KEY=... npm run validate:storage
MALWARE_SCAN_ENABLED=true MALWARE_SCANNER_PROVIDER=clamav MALWARE_SCAN_FAIL_POLICY=closed CLAMAV_HOST=... npm run validate:scanner
```

Production validation commands skip or refuse unsafe targets unless the documented env vars are present.

## 13. Go/no-go checklist

Go only when all are true:

- [ ] `npm test`, lint, typecheck, build, scans, and pilot smoke pass on the release commit.
- [ ] Vercel frontend builds with the production `WEB_API_ORIGIN`.
- [ ] API starts with `PROCESS_ROLE=api` and `/health/ready` is healthy.
- [ ] Worker starts with `PROCESS_ROLE=worker` and internal `/health/ready` plus `/metrics` are healthy.
- [ ] Postgres migration and validation passed in staging.
- [ ] S3 private-storage validation passed in staging.
- [ ] Scanner validation passed in staging.
- [ ] Admin provisioning is complete and `PROVISION_*` secrets are removed.
- [ ] CORS only allows trusted web origins.
- [ ] Backup and restore were tested.
- [ ] Pilot support, security escalation, reviewer, and data policy are assigned.

## 14. Known blockers

- No serverless Vercel API entrypoint exists.
- Worker requires a persistent host or a replacement background-job platform.
- Scanner requires separate ClamAV-compatible infrastructure.
- Live Postgres, S3, and scanner validation require external env vars and target infrastructure.
- Login throttling, account recovery, production OCR, retention jobs, legal holds, automated deletion retry, and restore UI are not implemented.
- Starter rules remain demo/unverified unless expert-reviewed.

## 15. Recommended deployment topology

Closed-pilot topology:

- Web: Vercel static frontend.
- API: persistent Node service behind HTTPS.
- Worker: separate persistent Node service on the same release.
- Database: managed Postgres with backups/PITR.
- Storage: private S3-compatible bucket.
- Scanner: private ClamAV-compatible service.
- Logs: centralized structured logs with document text excluded.

## 16. First real-use testing plan

1. Deploy staging using the split topology.
2. Run migrations and provision one admin.
3. Run external validators.
4. Run `npm run qa:pilot` against staging-equivalent config or the isolated local smoke.
5. Test one synthetic facility per country.
6. Upload a minimal approved real evidence sample.
7. Confirm scan, AI disabled/AI enabled behavior, reviewer override, matrix/action update, packet export, protected download, and archive/delete.
8. Review the generated packet with the EHS/manufacturing user and record false positives, missing evidence categories, and UX blockers.
