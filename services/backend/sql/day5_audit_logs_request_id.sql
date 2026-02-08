-- ============================================================
-- Day 5: Add request_id column to audit_logs for correlation
-- ============================================================
-- Enables tracing all audit entries by request_id from HTTP request.
-- ============================================================

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS request_id text;

CREATE INDEX IF NOT EXISTS audit_logs_request_id_created_at_idx
  ON public.audit_logs (request_id, created_at);
