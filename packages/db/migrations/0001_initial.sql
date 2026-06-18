CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rules_packs (
  rules_pack_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  industry TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  version TEXT NOT NULL,
  expert_reviewed BOOLEAN NOT NULL DEFAULT false,
  demo_content BOOLEAN NOT NULL DEFAULT true,
  last_updated_at DATE NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_rules (
  id TEXT PRIMARY KEY,
  rules_pack_id TEXT NOT NULL REFERENCES rules_packs(rules_pack_id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  authority TEXT NOT NULL,
  citation TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  applicability_trigger JSONB NOT NULL,
  required_evidence_types JSONB NOT NULL,
  priority TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  due_window_days INTEGER NOT NULL,
  source_url TEXT,
  expert_reviewed BOOLEAN NOT NULL DEFAULT false,
  demo_content BOOLEAN NOT NULL DEFAULT true,
  last_reviewed_at TIMESTAMPTZ,
  version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facilities (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  state_province TEXT NOT NULL,
  region TEXT NOT NULL,
  jurisdiction_code TEXT NOT NULL,
  industry TEXT NOT NULL,
  facility_type TEXT NOT NULL,
  employee_count INTEGER NOT NULL DEFAULT 0,
  hazard_profile JSONB NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS facility_applicable_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
  rules_pack_id TEXT NOT NULL REFERENCES rules_packs(rules_pack_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (facility_id, rule_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  evidence_type TEXT NOT NULL,
  file_reference TEXT,
  uploaded_by_user_id TEXT REFERENCES users(id),
  country TEXT,
  region TEXT,
  related_obligation_id TEXT,
  document_date DATE,
  expiration_date DATE,
  status TEXT NOT NULL,
  confidence TEXT NOT NULL,
  reviewer_notes TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_matches (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES compliance_rules(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  match_type TEXT NOT NULL,
  confidence TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rule_id, evidence_id)
);

CREATE TABLE IF NOT EXISTS audit_readiness_reviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  rules_pack_id TEXT NOT NULL REFERENCES rules_packs(rules_pack_id),
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  readiness_score INTEGER NOT NULL,
  score_explanation JSONB NOT NULL,
  summary JSONB NOT NULL,
  generated_by_user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS evidence_gap_rows (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id TEXT NOT NULL REFERENCES audit_readiness_reviews(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL REFERENCES compliance_rules(id),
  row_data JSONB NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id TEXT NOT NULL REFERENCES audit_readiness_reviews(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  authority TEXT NOT NULL,
  citation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  review_id TEXT NOT NULL REFERENCES audit_readiness_reviews(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  related_obligation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  item_data JSONB NOT NULL,
  bucket TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_packets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  review_id TEXT NOT NULL REFERENCES audit_readiness_reviews(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_reference TEXT NOT NULL,
  generated_by_user_id TEXT REFERENCES users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  rules_pack_id TEXT NOT NULL REFERENCES rules_packs(rules_pack_id),
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expert_reviews (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT REFERENCES facilities(id) ON DELETE CASCADE,
  review_id TEXT REFERENCES audit_readiness_reviews(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  requested_by_user_id TEXT REFERENCES users(id),
  expert_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT REFERENCES facilities(id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_organization_id ON user_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_facilities_organization_id ON facilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_facilities_country_region ON facilities(country, region);
CREATE INDEX IF NOT EXISTS idx_rules_packs_country_region ON rules_packs(country, region);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_pack ON compliance_rules(rules_pack_id);
CREATE INDEX IF NOT EXISTS idx_compliance_rules_country_region ON compliance_rules(country, region);
CREATE INDEX IF NOT EXISTS idx_facility_rules_org_facility ON facility_applicable_rules(organization_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_evidence_organization_id ON evidence(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_facility_id ON evidence(facility_id);
CREATE INDEX IF NOT EXISTS idx_evidence_related_obligation_id ON evidence(related_obligation_id);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_org ON evidence_matches(organization_id);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_rule_id ON evidence_matches(rule_id);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_evidence_id ON evidence_matches(evidence_id);
CREATE INDEX IF NOT EXISTS idx_reviews_organization_id ON audit_readiness_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_reviews_facility_id ON audit_readiness_reviews(facility_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rules_pack_id ON audit_readiness_reviews(rules_pack_id);
CREATE INDEX IF NOT EXISTS idx_gap_rows_organization_id ON evidence_gap_rows(organization_id);
CREATE INDEX IF NOT EXISTS idx_gap_rows_review_id ON evidence_gap_rows(review_id);
CREATE INDEX IF NOT EXISTS idx_gap_rows_facility_id ON evidence_gap_rows(facility_id);
CREATE INDEX IF NOT EXISTS idx_gap_rows_rule_id ON evidence_gap_rows(rule_id);
CREATE INDEX IF NOT EXISTS idx_findings_organization_id ON findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_findings_review_id ON findings(review_id);
CREATE INDEX IF NOT EXISTS idx_action_items_organization_id ON action_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_action_items_review_id ON action_items(review_id);
CREATE INDEX IF NOT EXISTS idx_packets_organization_id ON audit_packets(organization_id);
CREATE INDEX IF NOT EXISTS idx_packets_facility_id ON audit_packets(facility_id);
CREATE INDEX IF NOT EXISTS idx_packets_review_id ON audit_packets(review_id);
CREATE INDEX IF NOT EXISTS idx_expert_reviews_organization_id ON expert_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_facility_id ON audit_logs(facility_id);
