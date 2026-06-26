ALTER TABLE evidence ADD COLUMN IF NOT EXISTS detected_content_type TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_validation_status TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS file_validation_error TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS deleted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS storage_deletion_status TEXT;
ALTER TABLE evidence ADD COLUMN IF NOT EXISTS storage_deletion_error TEXT;

UPDATE evidence
SET file_validation_status = CASE WHEN file_reference IS NULL THEN 'not_applicable' ELSE 'legacy_unverified' END,
    storage_deletion_status = CASE WHEN file_reference IS NULL THEN 'not_applicable' ELSE 'retained' END
WHERE file_validation_status IS NULL OR storage_deletion_status IS NULL;

ALTER TABLE evidence ALTER COLUMN file_validation_status SET DEFAULT 'not_applicable';
ALTER TABLE evidence ALTER COLUMN file_validation_status SET NOT NULL;
ALTER TABLE evidence ALTER COLUMN storage_deletion_status SET DEFAULT 'not_applicable';
ALTER TABLE evidence ALTER COLUMN storage_deletion_status SET NOT NULL;

ALTER TABLE audit_packets ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE audit_packets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE audit_packets ADD COLUMN IF NOT EXISTS deleted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE audit_packets ADD COLUMN IF NOT EXISTS deletion_reason TEXT;
ALTER TABLE audit_packets ADD COLUMN IF NOT EXISTS retention_until TIMESTAMPTZ;
ALTER TABLE audit_packets ADD COLUMN IF NOT EXISTS storage_deletion_status TEXT NOT NULL DEFAULT 'retained';
ALTER TABLE audit_packets ADD COLUMN IF NOT EXISTS storage_deletion_error TEXT;
ALTER TABLE audit_packets ALTER COLUMN file_reference DROP NOT NULL;

ALTER TABLE evidence_processing_jobs ADD COLUMN IF NOT EXISTS worker_id TEXT;
ALTER TABLE evidence_processing_jobs ADD COLUMN IF NOT EXISTS lease_token TEXT;
ALTER TABLE evidence_processing_jobs ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;
ALTER TABLE evidence_processing_jobs ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;
ALTER TABLE evidence_processing_jobs ADD COLUMN IF NOT EXISTS dead_lettered_at TIMESTAMPTZ;

ALTER TABLE evidence_processing_jobs DROP CONSTRAINT IF EXISTS processing_jobs_status_check;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processing_jobs_status_check') THEN
    ALTER TABLE evidence_processing_jobs ADD CONSTRAINT processing_jobs_status_check
      CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'dead_letter', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_validation_status_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_validation_status_check
      CHECK (file_validation_status IN ('not_applicable', 'validated', 'legacy_unverified', 'rejected')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'evidence_storage_deletion_status_check') THEN
    ALTER TABLE evidence ADD CONSTRAINT evidence_storage_deletion_status_check
      CHECK (storage_deletion_status IN ('not_applicable', 'retained', 'deleted', 'failed')) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'packet_storage_deletion_status_check') THEN
    ALTER TABLE audit_packets ADD CONSTRAINT packet_storage_deletion_status_check
      CHECK (storage_deletion_status IN ('retained', 'deleted', 'failed')) NOT VALID;
  END IF;
END $$;

ALTER TABLE evidence VALIDATE CONSTRAINT evidence_validation_status_check;
ALTER TABLE evidence VALIDATE CONSTRAINT evidence_storage_deletion_status_check;
ALTER TABLE audit_packets VALIDATE CONSTRAINT packet_storage_deletion_status_check;

DROP INDEX IF EXISTS idx_processing_jobs_due;
CREATE INDEX IF NOT EXISTS idx_processing_jobs_due
  ON evidence_processing_jobs(next_retry_at, created_at)
  WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_processing_jobs_expired_lease
  ON evidence_processing_jobs(lease_expires_at)
  WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_processing_jobs_worker
  ON evidence_processing_jobs(worker_id, status)
  WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_evidence_deleted_by_user ON evidence(deleted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_packets_deleted_by_user ON audit_packets(deleted_by_user_id);
CREATE INDEX IF NOT EXISTS idx_packets_org_facility_active
  ON audit_packets(organization_id, facility_id, generated_at DESC)
  WHERE archived = false;
