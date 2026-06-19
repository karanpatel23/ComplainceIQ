ALTER TABLE facilities
  ADD COLUMN IF NOT EXISTS selected_rules_pack_id TEXT REFERENCES rules_packs(rules_pack_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_facilities_org_active_created ON facilities(organization_id, archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_facilities_selected_rules_pack ON facilities(selected_rules_pack_id);
CREATE INDEX IF NOT EXISTS idx_facility_rules_rule_id ON facility_applicable_rules(rule_id);
CREATE INDEX IF NOT EXISTS idx_facility_rules_pack_id ON facility_applicable_rules(rules_pack_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org_facility_active_created ON evidence(organization_id, facility_id, archived, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_uploaded_by_user ON evidence(uploaded_by_user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_matches_org_facility_created ON evidence_matches(organization_id, facility_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_org_facility_created ON audit_readiness_reviews(organization_id, facility_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_generated_by_user ON audit_readiness_reviews(generated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_gap_rows_org_review_created ON evidence_gap_rows(organization_id, review_id, created_at);
CREATE INDEX IF NOT EXISTS idx_findings_facility_id ON findings(facility_id);
CREATE INDEX IF NOT EXISTS idx_findings_rule_id ON findings(rule_id);
CREATE INDEX IF NOT EXISTS idx_action_items_org_review_due ON action_items(organization_id, review_id, due_date);
CREATE INDEX IF NOT EXISTS idx_action_items_facility_id ON action_items(facility_id);
CREATE INDEX IF NOT EXISTS idx_packets_org_facility_generated ON audit_packets(organization_id, facility_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_packets_generated_by_user ON audit_packets(generated_by_user_id);
CREATE INDEX IF NOT EXISTS idx_packets_rules_pack_id ON audit_packets(rules_pack_id);
CREATE INDEX IF NOT EXISTS idx_expert_reviews_facility_id ON expert_reviews(facility_id);
CREATE INDEX IF NOT EXISTS idx_expert_reviews_review_id ON expert_reviews(review_id);
CREATE INDEX IF NOT EXISTS idx_expert_reviews_requested_by_user ON expert_reviews(requested_by_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_facility_created ON audit_logs(organization_id, facility_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check
      CHECK (role IN ('admin', 'compliance_manager', 'reviewer', 'auditor', 'executive')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facilities_country_check') THEN
    ALTER TABLE facilities ADD CONSTRAINT facilities_country_check
      CHECK (country IN ('US', 'CA', 'MX')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'facilities_employee_count_check') THEN
    ALTER TABLE facilities ADD CONSTRAINT facilities_employee_count_check
      CHECK (employee_count >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_status_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_status_check
      CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'needs_review')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_confidence_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_confidence_check
      CHECK (confidence IN ('high', 'medium', 'low')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_readiness_score_check') THEN
    ALTER TABLE audit_readiness_reviews ADD CONSTRAINT reviews_readiness_score_check
      CHECK (readiness_score BETWEEN 0 AND 100) NOT VALID;
  END IF;
END $$;

ALTER TABLE users VALIDATE CONSTRAINT users_role_check;
ALTER TABLE facilities VALIDATE CONSTRAINT facilities_country_check;
ALTER TABLE facilities VALIDATE CONSTRAINT facilities_employee_count_check;
ALTER TABLE evidence VALIDATE CONSTRAINT evidence_status_check;
ALTER TABLE evidence VALIDATE CONSTRAINT evidence_confidence_check;
ALTER TABLE audit_readiness_reviews VALIDATE CONSTRAINT reviews_readiness_score_check;
