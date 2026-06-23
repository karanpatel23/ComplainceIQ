ALTER TABLE evidence ADD COLUMN IF NOT EXISTS scan_status TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS scan_provider TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS scan_error TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMPTZ;

UPDATE evidence
SET scan_status = 'scan_unavailable'
WHERE scan_status IS NULL;

ALTER TABLE evidence ALTER COLUMN scan_status SET DEFAULT 'scan_unavailable';
ALTER TABLE evidence ALTER COLUMN scan_status SET NOT NULL;

CREATE TABLE IF NOT EXISTS evidence_processing_jobs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  facility_id TEXT NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  evidence_id TEXT NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_processing_error TEXT,
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS analysis_version INTEGER;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS previous_analysis_id TEXT;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS processing_job_id TEXT;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS created_by_type TEXT;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS output_hash TEXT;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS is_current BOOLEAN;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
ALTER TABLE evidence_ai_analyses ADD COLUMN IF NOT EXISTS superseded_by_id TEXT;

UPDATE evidence_ai_analyses
SET analysis_version = COALESCE(analysis_version, 1),
    created_by_type = COALESCE(created_by_type, 'system'),
    is_current = COALESCE(is_current, true)
WHERE analysis_version IS NULL OR created_by_type IS NULL OR is_current IS NULL;

ALTER TABLE evidence_ai_analyses ALTER COLUMN analysis_version SET NOT NULL;
ALTER TABLE evidence_ai_analyses ALTER COLUMN created_by_type SET NOT NULL;
ALTER TABLE evidence_ai_analyses ALTER COLUMN is_current SET NOT NULL;
ALTER TABLE evidence_ai_analyses ALTER COLUMN is_current SET DEFAULT true;
ALTER TABLE evidence_ai_analyses DROP CONSTRAINT IF EXISTS evidence_ai_analyses_evidence_id_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_previous_analysis_fk') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_previous_analysis_fk
      FOREIGN KEY (previous_analysis_id) REFERENCES evidence_ai_analyses(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_processing_job_fk') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_processing_job_fk
      FOREIGN KEY (processing_job_id) REFERENCES evidence_processing_jobs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_superseded_by_fk') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_superseded_by_fk
      FOREIGN KEY (superseded_by_id) REFERENCES evidence_ai_analyses(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_scan_status_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_scan_status_check
      CHECK (scan_status IN ('scan_pending', 'scan_clean', 'scan_failed', 'scan_suspicious', 'scan_unavailable')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processing_jobs_status_check') THEN
    ALTER TABLE evidence_processing_jobs ADD CONSTRAINT processing_jobs_status_check
      CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processing_jobs_attempts_check') THEN
    ALTER TABLE evidence_processing_jobs ADD CONSTRAINT processing_jobs_attempts_check
      CHECK (processing_attempts >= 0 AND max_attempts > 0 AND processing_attempts <= max_attempts);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_version_check') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_version_check
      CHECK (analysis_version > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_created_by_type_check') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_created_by_type_check
      CHECK (created_by_type IN ('system', 'user'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_analyses_extraction_status_check') THEN
    ALTER TABLE evidence_ai_analyses ADD CONSTRAINT ai_analyses_extraction_status_check
      CHECK (text_extraction_status IN ('not_started', 'manual_metadata_only', 'extracted', 'empty', 'unsupported_for_text_extraction', 'extraction_failed', 'ocr_required')) NOT VALID;
  END IF;
END $$;

ALTER TABLE evidence VALIDATE CONSTRAINT evidence_scan_status_check;
ALTER TABLE evidence_ai_analyses VALIDATE CONSTRAINT ai_analyses_extraction_status_check;

CREATE INDEX IF NOT EXISTS idx_processing_jobs_org_facility_status
  ON evidence_processing_jobs(organization_id, facility_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_evidence_id ON evidence_processing_jobs(evidence_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_by_user ON evidence_processing_jobs(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_due
  ON evidence_processing_jobs(status, next_retry_at, created_at)
  WHERE status = 'queued';
CREATE UNIQUE INDEX IF NOT EXISTS idx_processing_jobs_one_active_per_evidence
  ON evidence_processing_jobs(evidence_id)
  WHERE status IN ('queued', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analyses_evidence_version
  ON evidence_ai_analyses(evidence_id, analysis_version);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analyses_current_evidence
  ON evidence_ai_analyses(evidence_id)
  WHERE is_current = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_analyses_processing_job
  ON evidence_ai_analyses(processing_job_id)
  WHERE processing_job_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_analyses_previous_analysis ON evidence_ai_analyses(previous_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_superseded_by ON evidence_ai_analyses(superseded_by_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org_scan_status
  ON evidence(organization_id, scan_status, created_at DESC)
  WHERE archived = false;
