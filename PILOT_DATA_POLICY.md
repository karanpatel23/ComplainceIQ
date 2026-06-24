# ComplianceIQ Pilot Data Policy

This practical policy is for the controlled ComplianceIQ pilot. It is not a formal services agreement or legal opinion.

## Data That May Be Uploaded

Upload only evidence authorized by the participating organization and needed for the agreed facility audit-preparation workflow, such as written programs, training records, inspection logs, SDS indexes, and emergency-plan evidence. Minimize employee and operational details wherever possible.

## Do Not Upload During The Pilot

- Social Security, Social Insurance, tax, passport, banking, payment-card, medical, biometric, or immigration records.
- Passwords, API keys, private keys, access tokens, or other credentials.
- Documents subject to export controls, litigation holds, special regulatory restrictions, or third-party confidentiality terms unless the customer has approved a specific handling plan.
- Unnecessary employee rosters, disciplinary records, health records, or unrelated proprietary manufacturing information.
- Executables, scripts, archives, HTML, SVG, or unsupported binary formats.

## AI Limitations And Human Review

AI may classify evidence, extract bounded fields, and suggest a match to an applicable demo rule. It can be wrong or incomplete. AI does not accept evidence automatically, decide legal sufficiency, certify a facility, or replace qualified EHS, compliance, or legal review. A designated human reviewer remains responsible for evidence status, obligation mapping, and packet use.

## Security And Access

Evidence files are intended to remain in private object storage and download through authenticated organization-scoped routes. ComplianceIQ records security-relevant audit events and minimizes operational log content. Pilot customers remain responsible for controlling their user accounts, choosing authorized uploaders/reviewers, and promptly reporting suspected access issues.

## Retention And Deletion

The pilot supports explicit evidence and packet archive/deletion flows with audit history and object-deletion outcomes. Scheduled retention enforcement, legal holds, automated deletion retries, and self-service restoration are not implemented. Retention duration and deletion requests must be agreed with the pilot operator, and failed deletion requires operational follow-up.

## Product Scope

ComplianceIQ provides audit-preparation and evidence-organization support. It is not legal advice, does not guarantee compliance, and does not represent regulator certification or approval. Starter rules and demo content require qualified review. Customers remain responsible for their facilities, legal obligations, source-document accuracy, reviewer decisions, and use of exported packets.

## Support And Escalation

- Pilot support contact: `[INSERT NAME / EMAIL / PHONE]`
- Security or privacy escalation: `[INSERT SECURITY CONTACT]`
- Customer pilot owner: `[INSERT CUSTOMER CONTACT]`
- Target response window: `[INSERT AGREED PILOT RESPONSE WINDOW]`

Stop uploading new evidence and contact the pilot operator immediately if sensitive data is uploaded accidentally, suspicious file behavior occurs, access appears unauthorized, or deletion fails.
