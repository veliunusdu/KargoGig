-- ============================================================
-- RPC VERIFICATION: driver_complete_ride
-- ============================================================
-- Purpose: Ensure the RPC sets delivered_at + status correctly
--
-- Context: Day 2 Payment bug discovered that driver_complete_ride
-- may not be setting delivered_at, which breaks payment flow.
--
-- Expected RPC behavior (from rides.service.ts comment):
--   - sets status='completed'
--   - sets delivered_at=now()
--   - sets final_price
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- 1) Check existing shipments for bug pattern
-- ───────────────────────────────────────────────────────────
-- Pattern: final_price exists BUT delivered_at is NULL
-- This indicates RPC is incomplete.

SELECT
  id AS shipment_id,
  status,
  final_price,
  delivered_at,
  CASE
    WHEN final_price IS NOT NULL AND delivered_at IS NULL THEN '❌ BUG: has price but no delivered_at'
    WHEN status = 'completed' AND delivered_at IS NULL THEN '❌ BUG: status=completed but no delivered_at'
    WHEN delivered_at IS NOT NULL AND final_price IS NULL THEN '⚠️  WARNING: delivered but no price'
    ELSE '✅ OK'
  END AS validation
FROM public.shipments
WHERE
  -- Only check shipments that might be "completed"
  (final_price IS NOT NULL OR status = 'completed' OR delivered_at IS NOT NULL)
ORDER BY created_at DESC
LIMIT 20;

-- ───────────────────────────────────────────────────────────
-- 2) Recommended RPC structure (for Supabase Dashboard)
-- ───────────────────────────────────────────────────────────
-- If your RPC is missing delivered_at, update it with this pattern:

/*
CREATE OR REPLACE FUNCTION public.driver_complete_ride(
  p_shipment_id integer,
  p_lat numeric,
  p_lng numeric,
  p_pod_signature text DEFAULT NULL,
  p_pod_photos text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id integer;
  v_shipment record;
  v_final_price numeric;
  v_result jsonb;
BEGIN
  -- Get authenticated user's driver_id
  SELECT d.id INTO v_driver_id
  FROM public.drivers d
  WHERE d.user_id = auth.uid();

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Not a driver' USING ERRCODE = 'P0001';
  END IF;

  -- Get shipment and validate ownership + state
  SELECT * INTO v_shipment
  FROM public.shipments
  WHERE id = p_shipment_id
    AND driver_id = v_driver_id
    AND status = 'in_progress';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment not found or not in progress' USING ERRCODE = 'P0002';
  END IF;

  -- TODO: Validate geo-fence (driver near dropoff)
  -- TODO: Calculate final_price from pricing rules + actual distance/duration

  -- For now, use a mock price (replace with real calculation)
  v_final_price := 50.00;

  -- ✅ CRITICAL: Update ALL three fields atomically
  UPDATE public.shipments
  SET
    status = 'completed',
    delivered_at = now(),          -- ⭐ MUST SET THIS
    final_price = v_final_price,
    pod_signature = p_pod_signature,
    pod_photos = p_pod_photos,
    updated_at = now()
  WHERE id = p_shipment_id
  RETURNING
    jsonb_build_object(
      'id', id,
      'status', status,
      'delivered_at', delivered_at,
      'final_price', final_price,
      'pod_signature', pod_signature,
      'pod_photos', pod_photos
    ) INTO v_result;

  RETURN v_result;
END;
$$;
*/

-- ───────────────────────────────────────────────────────────
-- 3) Manual fix for existing broken shipments (if needed)
-- ───────────────────────────────────────────────────────────
-- DO NOT RUN THIS unless you've verified the shipments are actually completed.
-- This is a one-time data fix.

/*
UPDATE public.shipments
SET
  status = 'completed',
  delivered_at = updated_at  -- Use last update time as proxy
WHERE
  final_price IS NOT NULL
  AND delivered_at IS NULL
  AND status IN ('picked_up', 'in_progress')
  AND id = ?;  -- Replace with specific shipment ID
*/

-- ───────────────────────────────────────────────────────────
-- 4) Test the RPC (after fixing)
-- ───────────────────────────────────────────────────────────
-- Run this in Supabase SQL Editor with a test shipment:

/*
SELECT driver_complete_ride(
  p_shipment_id := 999,  -- Replace with test shipment ID
  p_lat := 41.0182,
  p_lng := 28.9884,
  p_pod_signature := 'test_signature',
  p_pod_photos := ARRAY['photo1.jpg', 'photo2.jpg']
);

-- Then verify:
SELECT id, status, delivered_at, final_price
FROM public.shipments
WHERE id = 999;

-- Expected result:
--   status = 'completed'
--   delivered_at = (current timestamp)
--   final_price = (calculated value)
*/
