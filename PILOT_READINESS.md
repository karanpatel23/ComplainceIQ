# ComplianceIQ Closed-Pilot Readiness Checklist

This checklist supports a controlled pilot with a small group of manufacturing or EHS users. It is not evidence of broad public-launch or enterprise readiness.

## Required Infrastructure

- Separate API and worker processes using the same release and PostgreSQL database.
- Managed PostgreSQL with TLS, backups, restricted network access, and a role permitted to run tracked migrations.
- Private S3-compatible storage with public access blocked, encryption, lifecycle controls, and tested deletion.
- ClamAV-compatible scanner reachable only from application infrastructure, with current signatures and capacity monitoring.
- HTTPS web/API endpoints, centralized structured logs, alerting, and a documented support contact.

## Required Environment

- `NODE_ENV=production`
- `DEPLOYMENT_PROFILE=closed-pilot`
- `PROCESS_ROLE=api` on the API service and `PROCESS_ROLE=worker` on the worker service
- `DATABASE_URL`, `REPOSITORY_BACKEND=postgres`
- `STORAGE_BACKEND=s3`, `S3_BUCKET`, `S3_REGION`, and provider credentials/identity
- `SESSION_SECRET`, `APP_URL`, `ALLOWED_ORIGINS`, `MAX_UPLOAD_MB`
- `MALWARE_SCAN_ENABLED=true`, `MALWARE_SCAN_REQUIRED_IN_PRODUCTION=true`, `MALWARE_SCANNER_PROVIDER=clamav`, `MALWARE_SCAN_FAIL_POLICY=closed`
- `CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`
- Explicit `AI_ENABLED`; when enabled, an approved OpenAI model/key and human-review process
- `LOG_LEVEL=info` or `warn`, secure cookie settings, and trusted-proxy configuration matching the ingress design

## Database And Migration Checklist

- [ ] Run `npm run validate:postgres` against a disposable or staging target.
- [ ] Review and run `npm run db:migrate` before starting the new release.
- [ ] Confirm the API and worker use the same schema/version.
- [ ] Verify tenant isolation, queue claims, audit logs, and migration cleanup from validation output.
- [ ] Record the migration and rollback decision in the pilot change log.

## Storage Checklist

- [ ] Run `npm run validate:storage` against the pilot-compatible test bucket.
- [ ] Confirm anonymous object access is denied and bucket public-access blocks are enabled.
- [ ] Confirm evidence and packets download only through authenticated tenant-scoped routes.
- [ ] Test object deletion and document the retry/escalation path for failed deletion.
- [ ] Confirm encryption, object versioning/lifecycle, backup, and restore expectations with the provider.

## Scanner Checklist

- [ ] Run `npm run validate:scanner` from the deployment network.
- [ ] Confirm a clean sample passes.
- [ ] Use live EICAR validation only when explicitly approved with `SCANNER_VALIDATE_EICAR=true`.
- [ ] Confirm suspicious, timeout, and unavailable results follow the closed failure policy.
- [ ] Verify signature freshness, scanner alerts, network restrictions, and capacity.

## AI And Human Review Checklist

- [ ] Confirm the core workflow works with `AI_ENABLED=false`.
- [ ] If AI is enabled, validate the approved provider/model without storing raw prompts or document text.
- [ ] Confirm AI suggestions do not automatically accept evidence or make legal conclusions.
- [ ] Assign an EHS/compliance reviewer for every pilot facility and define escalation expectations.

## Worker And Health Checklist

- [ ] Deploy one `api` process group and at least one `worker` process group.
- [ ] Verify API `/health/live` and `/health/ready`.
- [ ] Verify worker `/health/live`, `/health/ready`, and `/metrics` on its internal health port.
- [ ] Confirm graceful shutdown drains active work within `QUEUE_SHUTDOWN_TIMEOUT_MS`.
- [ ] Alert on dead-letter growth, repeated retries, readiness failure, scanner failure, and storage deletion failure.

## Security Checklist

- [ ] TLS is enforced and proxy forwarding headers are overwritten by a trusted ingress.
- [ ] Session, database, storage, scanner, and AI secrets are held in a secret manager and rotated.
- [ ] Demo/seed commands and synthetic credentials are absent from staging/production runtime configuration.
- [ ] Cross-organization 403 behavior and unauthenticated 401 behavior pass in QA.
- [ ] Logs exclude file contents, raw extracted text, prompts, credentials, and sensitive employee lists.
- [ ] An access-removal and incident-notification owner is assigned.

## Backup And Restore

PostgreSQL backups must include all customer-owned rows, AI analysis lineage, reviews, gap rows, action items, packets, and audit logs. Object-storage backup/versioning must preserve evidence files and generated packet PDFs. A complete packet lineage reconstruction requires both database state and the matching private objects.

- [ ] Enable managed PostgreSQL point-in-time recovery or scheduled encrypted backups.
- [ ] Define S3 versioning/replication or equivalent provider backup behavior.
- [ ] Test restore into an isolated environment before pilot launch and on a documented schedule.
- [ ] Verify restored object references match restored database rows.
- [ ] Record recovery-point and recovery-time expectations; ComplianceIQ does not automate backup orchestration.

## Incident Response Basics

1. Disable affected credentials and isolate the API/worker when unauthorized access or malware handling is suspected.
2. Preserve operational and tenant audit logs without copying customer document contents into tickets.
3. Identify affected organizations, facilities, evidence, packet exports, and processing jobs.
4. Notify the designated pilot security/support contact and customer contact using the agreed process.
5. Document containment, recovery, validation, and follow-up actions.

## Pilot Data Handling

Review [PILOT_DATA_POLICY.md](./PILOT_DATA_POLICY.md) with every pilot organization. Use synthetic data for demonstrations. Real pilot evidence should be minimized, authorized by the customer, and limited to the agreed facility scope.

## Known Limitations

- Starter rules remain demo/unverified unless separately expert-reviewed.
- Production OCR, scheduled retention, legal holds, automated deletion retries, account recovery, and login throttling are not implemented.
- Queue jobs are durable in PostgreSQL, but scheduling is still application-managed rather than an external queue service.
- Backup, scanner, bucket policy, KMS, monitoring, and restore operations are deployment responsibilities.
- Live infrastructure validation has not passed until the target-specific commands run successfully.

## Go / No-Go

Go only when every item below is true:

- [ ] PostgreSQL, storage, scanner, and full pilot QA validations pass in staging.
- [ ] API and worker readiness remain healthy through a deployment/restart exercise.
- [ ] Backup and restore have been tested with documented results.
- [ ] Pilot users, facilities, data scope, reviewer, support contact, and incident path are named.
- [ ] Pilot data policy and product limitations have been acknowledged.
- [ ] No unresolved critical security, tenant-isolation, deletion, or data-loss issue remains.

Any unchecked item is a no-go or requires a documented, accountable risk acceptance before the controlled pilot begins.
