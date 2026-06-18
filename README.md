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
- `packages/db` - Postgres migration and repository adapters
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
- `API_HOST`
- `APP_URL`
- `ALLOWED_ORIGINS` without `*`
- `DATABASE_URL`
- `REPOSITORY_BACKEND=postgres`
- `SESSION_SECRET` with at least 32 characters
- `UPLOAD_STORAGE_BACKEND`
- `UPLOAD_DIR`
- `MAX_UPLOAD_MB`

Optional:

- `ENABLE_DEMO_DATA`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- SMTP variables

OpenAI and SMTP are optional. The core audit packet workflow works without them.

## Local Setup

This rebuild uses npm scripts and Node 20+.

```bash
npm install
cp .env.example .env
npm run typecheck
npm test
```

For a quick development smoke test without Postgres:

```bash
REPOSITORY_BACKEND=file NODE_ENV=development SESSION_SECRET=development-secret-change-me npm run dev
```

The file repository is only for local development and tests. Production must use Postgres.

## Database Setup

Provision Postgres, set `DATABASE_URL`, then run:

```bash
REPOSITORY_BACKEND=postgres npm run db:migrate
```

The initial migration creates:

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
- Core routes require authentication.
- Customer-owned repository methods are scoped by `organizationId`.
- Cross-organization resource access returns `403`.
- Evidence and packet files are private file references and download through authenticated API routes.
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

Local private storage is implemented for development:

- `UPLOAD_STORAGE_BACKEND=local`
- `UPLOAD_DIR=data/private-storage`

Production should replace this with a private object storage adapter such as S3, R2, or a private Supabase bucket. Public raw evidence URLs should not be exposed.

## Deployment Checklist

- Run `npm install`
- Set production environment variables
- Run `npm run db:migrate`
- Create the first admin user through an internal provisioning flow or explicit non-production seed
- Verify `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`
- Configure private object storage for uploads and generated PDFs
- Confirm CORS allows only trusted web origins
- Confirm demo data is disabled

## Known Limitations

- Starter rules are demo/unverified unless expert-reviewed.
- AI parsing is intentionally not included yet.
- Local private storage is not a production object-storage solution.
- The static frontend is focused on the core workflow; future work can replace it with a richer React/Next app without moving compliance logic to the client.
- Province/state-specific Canadian and Mexican rule depth needs expert legal/EHS review before commercial reliance.

## Next Recommended Sprint

1. Add a production object-storage adapter.
2. Add a first-admin provisioning command that does not rely on demo data.
3. Add deeper integration tests against a disposable Postgres database.
4. Expand review workflows for expert-reviewed rules without broadening the product.
5. Improve the web app with a design-system frontend while keeping backend source-of-truth rules and scoring.
