-- ============================================================
-- Day 5: Refunds — DB Migration
-- ============================================================

-- 1) Add unique constraint for idempotency on payment_refunds
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_idempotency
  ON public.payment_refunds (payment_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2) Index on provider_refund_id for lookups
CREATE INDEX IF NOT EXISTS idx_payment_refunds_provider_refund_id
  ON public.payment_refunds (provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

-- 3) Index on payment_id for fast refund history lookup
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment_id
  ON public.payment_refunds (payment_id);

-- 4) Helper function: get commission rate for payment
-- (looks up active company_pricing, falls back to 0.20)
CREATE OR REPLACE FUNCTION get_commission_rate_for_payment(p_payment_id bigint)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_company_id bigint;
  v_commission_rate numeric;
BEGIN
  -- Get company_id from payment
  SELECT company_id INTO v_company_id
  FROM public.payments
  WHERE id = p_payment_id;

  IF NOT FOUND THEN
    RETURN 0.20; -- fallback
  END IF;

  -- Get active pricing commission rate
  SELECT platform_commission_rate INTO v_commission_rate
  FROM public.company_pricing
  WHERE company_id = v_company_id
    AND is_active = true
  ORDER BY effective_from DESC
  LIMIT 1;

  RETURN COALESCE(v_commission_rate, 0.20);
END;
$$;
