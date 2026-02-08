-- ============================================================
-- Migration: Payment Guardrails (Day 2)
-- ============================================================
-- Purpose: Prevent payment bugs at DB level via constraints
--
-- 1) Unique index: Only 1 pending payment per shipment (idempotency)
-- 2) Trigger: Paid payment requires shipment.delivered_at NOT NULL
--
-- Run this AFTER payments table exists.
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1) IDEMPOTENCY: One pending payment per shipment maximum
-- ───────────────────────────────────────────────────────────
-- Prevents race conditions where multiple /pay calls create duplicate pending rows.
-- Partial unique index (WHERE status='pending') allows multiple failed/paid rows.

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_per_shipment
  ON public.payments (shipment_id)
  WHERE status = 'pending';

COMMENT ON INDEX public.payments_one_pending_per_shipment IS
  'Ensures only ONE pending payment per shipment. Allows multiple failed/paid.';

-- ───────────────────────────────────────────────────────────
-- 2) GUARDRAIL: Paid payment MUST have delivered_at
-- ───────────────────────────────────────────────────────────
-- Prevents paying for incomplete rides (status lies, delivered_at doesn't).
-- Uses trigger because CHECK constraint with subquery is unreliable.

CREATE OR REPLACE FUNCTION public.payment_paid_requires_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_delivered_at timestamptz;
BEGIN
  -- Only validate when payment becomes 'paid'
  IF NEW.status = 'paid' AND NEW.shipment_id IS NOT NULL THEN
    -- Fetch shipment's delivered_at
    SELECT delivered_at INTO v_delivered_at
    FROM public.shipments
    WHERE id = NEW.shipment_id;

    -- Reject if delivered_at is NULL
    IF v_delivered_at IS NULL THEN
      RAISE EXCEPTION 'Cannot mark payment as paid: shipment % has no delivered_at', NEW.shipment_id
        USING ERRCODE = 'check_violation',
              HINT = 'Ride must be completed (delivered_at set) before payment.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists (for idempotent re-run)
DROP TRIGGER IF EXISTS payment_paid_check_delivered ON public.payments;

-- Create trigger on INSERT or UPDATE
CREATE TRIGGER payment_paid_check_delivered
  BEFORE INSERT OR UPDATE OF status, shipment_id
  ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.payment_paid_requires_delivered();

COMMENT ON FUNCTION public.payment_paid_requires_delivered IS
  'Trigger: prevents marking payment as paid if shipment.delivered_at is NULL.';

COMMENT ON TRIGGER payment_paid_check_delivered ON public.payments IS
  'Ensures paid payments always correspond to completed (delivered) rides.';

-- ───────────────────────────────────────────────────────────
-- VERIFICATION QUERIES (for testing)
-- ───────────────────────────────────────────────────────────

-- Test 1: Try to insert pending without delivered_at (should work)
-- INSERT INTO payments (shipment_id, customer_id, company_id, amount, currency, provider, platform_order_id, status)
-- VALUES (999, 1, 1, 50, 'TRY', 'mock', 'PO-TEST1', 'pending');

-- Test 2: Try to update to paid without delivered_at (should FAIL)
-- UPDATE payments SET status = 'paid' WHERE platform_order_id = 'PO-TEST1';

-- Test 3: Create duplicate pending (should FAIL due to unique index)
-- INSERT INTO payments (shipment_id, customer_id, company_id, amount, currency, provider, platform_order_id, status)
-- VALUES (999, 1, 1, 50, 'TRY', 'mock', 'PO-TEST2', 'pending');

-- Clean up test data
-- DELETE FROM payments WHERE platform_order_id LIKE 'PO-TEST%';
