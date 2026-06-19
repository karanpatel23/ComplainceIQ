ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS content_type TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_sha256 TEXT;

CREATE TABLE IF NOT EXISTS evidence_ai_analyses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL UNIQUE REFERENCES evidence(id) ON DELETE CASCADE,
  review_id TEXT REFERENCES audit_readiness_reviews(id) ON DELETE SET NULL,
  processing_status TEXT NOT NULL,
  text_extraction_status TEXT NOT NULL,
  detected_evidence_type TEXT,
  detected_title TEXT,
  extracted_document_date DATE,
  extracted_expiration_date DATE,
  extracted_facility_name TEXT,
  extracted_employee_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_equipment_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_chemical_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_signature_present BOOLEAN,
  extracted_authority_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  extracted_citation_mentions JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_rule_id TEXT REFERENCES compliance_rules(id) ON DELETE SET NULL,
  suggested_obligation_title TEXT,
  match_reason TEXT,
  missing_fields_or_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence DOUBLE PRECISION,
  needs_human_review BOOLEAN NOT NULL DEFAULT true,
  provider TEXT NOT NULL,
  model TEXT,
  prompt_version TEXT NOT NULL,
  raw_model_output_reference TEXT,
  error TEXT,
  human_reviewed BOOLEAN NOT NULL DEFAULT false,
  human_accepted_ai_result BOOLEAN NOT NULL DEFAULT false,
  human_reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  human_reviewed_at TIMESTAMPTZ,
  human_override_evidence_type TEXT,
  human_override_rule_id TEXT REFERENCES compliance_rules(id) ON DELETE SET NULL,
  human_review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_organization_id ON evidence_ai_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_org_facility_status ON evidence_ai_analyses(organization_id, facility_id, processing_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_facility_id ON evidence_ai_analyses(facility_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_suggested_rule_id ON evidence_ai_analyses(suggested_rule_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_human_reviewer_id ON evidence_ai_analyses(human_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_review_id ON evidence_ai_analyses(review_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_processing_status_check') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_processing_status_check
      CHECK (processing_status IN ('not_started', 'processing', 'processed', 'failed', 'needs_review'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_confidence_check') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_confidence_check
      CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_file_size_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_file_size_check
      CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0) NOT VALID;
  END IF;
END $$;

ALTER TABLE evidence VALIDATE CONSTRAINT evidence_file_size_check;
