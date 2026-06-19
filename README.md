# ComplianceIQ

Industrial Audit Readiness Platform for Manufacturers.

ComplianceIQ helps manufacturers organize compliance evidence, identify jurisdiction-specific audit gaps, assign corrective actions, and export professional audit-readiness packets. The product is intentionally narrow: facility setup, evidence logging, evidence gap matrix, action plan, and audit packet export.

## Product Scope

ComplianceIQ supports North America at the architecture level:

- United States
- Canada
- Mexico

Starter rules are demo/unverified unless separately expert-reviewed. The system is audit-preparation and evidence organization support only. It is not legal advice and does not represent regulator certification or approval.

## Repository Structure

- `apps/api` - Node HTTP API, authentication, tenant scoping, review generation, evidence and packet downloads
- `apps/web` - focused Audit Packet Builder frontend
- `packages/config` - environment validation
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
- `UPLOAD_STORAGE_BACKEND`
- `UPLOAD_DIR`
- `MAX_UPLOAD_MB`

Optional:

- `API_HOST` (defaults to `0.0.0.0` in production)
- `ENABLE_DEMO_DATA`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `TEST_DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- SMTP variables

OpenAI and SMTP are optional. The core audit packet workflow works without them.

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

The Postgres integration test applies all tracked migrations, writes uniquely named tenant data, reinitializes the repository, and verifies facilities, selected rules-pack context, evidence, score explanations, gap rows, action items, evidence matches, packets, and audit logs. It is skipped unless `TEST_DATABASE_URL` points to a disposable real Postgres database.

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
- Client-supplied private file references are ignored; only backend storage writes can attach files.
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

Storage is selected through a private-storage adapter factory. The implemented local adapter uses randomized references, traversal protection, restrictive filesystem permissions, size limits, and authenticated API downloads:

- `UPLOAD_STORAGE_BACKEND=local`
- `UPLOAD_DIR=data/private-storage`

Production should replace this with a durable private object storage adapter such as S3, R2, or a private Supabase bucket. Public raw evidence URLs should not be exposed. A deployment using ephemeral local disk is **not production-ready** because evidence and generated packet files can disappear even though their Postgres metadata persists.

## Deployment Checklist

- Run `npm ci`
- Set production environment variables
- Run `npm run db:migrate`
- Provision the first administrator with `npm run admin:provision`, then remove its `PROVISION_*` secrets
- Verify `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`
- Configure private object storage for uploads and generated PDFs
- Run the optional `TEST_DATABASE_URL=... npm test` Postgres integration check against disposable infrastructure
- Confirm CORS allows only trusted web origins
- Confirm demo data is disabled
- Verify `/api/health` reports the Postgres backend as healthy
- Verify the selected private object-storage adapter is durable and non-public

## Known Limitations

- Starter rules are demo/unverified unless expert-reviewed.
- AI parsing is intentionally not included yet.
- Local private storage is not a production object-storage solution.
- A real Postgres integration run still requires a disposable `TEST_DATABASE_URL`; the self-contained suite deliberately does not emulate Postgres.
- Login rate limiting and account recovery are not implemented yet.
- The static frontend is focused on the core workflow; future work can replace it with a richer React/Next app without moving compliance logic to the client.
- Province/state-specific Canadian and Mexican rule depth needs expert legal/EHS review before commercial reliance.

## Deployment Readiness Status

The application code, authenticated routes, deterministic backend logic, file-adapter restart tests, environment validation, and builds are passing. Do **not** call a deployment production-ready until both of these environment-dependent gates pass:

1. Run the integration suite against a disposable real Postgres instance via `TEST_DATABASE_URL`.
2. Configure a durable private object-storage adapter; the implemented local adapter is development-only for deployments with ephemeral disks.

## Next Recommended Sprint

1. Add a durable production object-storage adapter and integration tests for upload, re-download, and deletion failure handling.
2. Run the Postgres suite in CI against an ephemeral real Postgres service and gate deployments on it.
3. Add distributed login rate limiting and a production account-recovery flow.
4. Expand expert-review workflow depth without broadening the product or rules coverage.
