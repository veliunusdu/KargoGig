-- ============================================================
-- Day 4: Audit Logs Request ID Correlation
-- ============================================================
-- Her audit_logs satırına request_id ekle — "bu payment neden failed?"
-- sorusunu tek request chain ile cevapla.
-- ============================================================

-- Add request_id column to audit_logs (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'request_id'
  ) THEN
    ALTER TABLE public.audit_logs
    ADD COLUMN request_id text;

    CREATE INDEX idx_audit_logs_request_id
      ON public.audit_logs (request_id)
      WHERE request_id IS NOT NULL;

    COMMENT ON COLUMN public.audit_logs.request_id IS 'Request ID (x-request-id header) for correlation';
  END IF;
END $$;
