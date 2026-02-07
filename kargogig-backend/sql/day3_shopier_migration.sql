-- ============================================================
-- Day 3: Shopier Payment Integration — DB Migration
-- ============================================================

-- 1) payment_provider_events — webhook audit + idempotency
CREATE TABLE IF NOT EXISTS public.payment_provider_events (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider        text   NOT NULL DEFAULT 'shopier',
  event_key       text   NOT NULL,                    -- dedupe key (provider_payment_id)
  platform_order_id text NOT NULL,
  provider_payment_id text,
  status_raw      text   NOT NULL,                    -- success / fail as received
  signature_valid boolean NOT NULL DEFAULT false,
  payload         jsonb  NOT NULL DEFAULT '{}'::jsonb, -- full callback body
  received_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_provider_event_key UNIQUE (provider, event_key)
);

CREATE INDEX IF NOT EXISTS idx_payment_provider_events_platform_order
  ON public.payment_provider_events (platform_order_id);

-- 2) Ensure payments table has needed columns
--    (most already exist from Day 2; add installment + failed_reason if missing)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'installment'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN installment integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'failed_reason'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN failed_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.payments ADD COLUMN expires_at timestamptz;
  END IF;
END
$$;

-- 3) Unique index on (provider, provider_payment_id) — prevent double-processing
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_payment
  ON public.payments (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;

-- 4) Index on platform_order_id (already unique column, but just in case)
-- platform_order_id already has a UNIQUE constraint from schema, so skip.

-- 5) Ensure audit_logs supports the new actions
--    (table already exists; no schema change needed — we just insert rows with new action values)
--    New actions: PAYMENT_PAID, PAYMENT_FAILED, SIGNATURE_INVALID, DUPLICATE_EVENT, PAYMENT_TIMEOUT
