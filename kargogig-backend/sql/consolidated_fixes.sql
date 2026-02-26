
/*
============================================================
CONSOLIDATED DATABASE FIXES
============================================================
Run this SQL in your Supabase SQL Editor.
============================================================
*/

-- Enable PostGIS if not already enabled (required for spatial queries)
CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------
-- 1. FIX DOCUMENTS TABLE & TRIGGER
-- ---------------------------------------------------------

-- Add 'meta' column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'meta'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
  END IF;
END
$$;

-- Fix updated_at trigger logic
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ---------------------------------------------------------
-- 2. CREATE MISSING CORE RPCs
-- ---------------------------------------------------------

-- RPC: create_company_as_user
CREATE OR REPLACE FUNCTION public.create_company_as_user(
  p_user_id uuid,
  p_name text,
  p_status text DEFAULT 'approved'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id bigint;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  INSERT INTO public.companies(name, status)
  VALUES (p_name, p_status)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- RPC: driver_complete_ride
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
  SELECT d.id INTO v_driver_id FROM public.drivers d WHERE d.user_id = auth.uid();
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_shipment FROM public.shipments WHERE id = p_shipment_id AND driver_id = v_driver_id AND status = 'in_progress';
  IF NOT FOUND THEN RAISE EXCEPTION 'Shipment not found or not in progress' USING ERRCODE = 'P0002'; END IF;

  v_final_price := 50.00; -- Placeholder for pricing logic

  UPDATE public.shipments
  SET status = 'completed', delivered_at = now(), final_price = v_final_price, pod_signature = p_pod_signature, pod_photos = p_pod_photos, updated_at = now()
  WHERE id = p_shipment_id
  RETURNING jsonb_build_object('id', id, 'status', status, 'delivered_at', delivered_at, 'final_price', final_price, 'pod_signature', pod_signature, 'pod_photos', pod_photos) INTO v_result;

  RETURN v_result;
END;
$$;

-- RPC: find_nearby_drivers
CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  p_pickup_lat numeric,
  p_pickup_lng numeric,
  p_radius_meters numeric,
  p_vehicle_category text DEFAULT NULL,
  p_company_id bigint DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS TABLE (
  driver_id integer,
  distance_meters numeric,
  lat numeric,
  lng numeric,
  vehicle_id integer,
  plate_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as driver_id,
    (ST_Distance(dl.point, ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography))::numeric as distance_meters,
    dl.lat,
    dl.lng,
    v.id as vehicle_id,
    v.plate_number
  FROM public.drivers d
  JOIN public.driver_locations dl ON d.id = dl.driver_id
  LEFT JOIN public.vehicles v ON d.id = v.driver_id
  WHERE d.is_online = true
    AND d.is_available = true
    AND d.status = 'approved'
    AND (p_vehicle_category IS NULL OR v.category = p_vehicle_category)
    AND (p_company_id IS NULL OR d.company_id = p_company_id)
    AND ST_DWithin(dl.point, ST_SetSRID(ST_MakePoint(p_pickup_lng, p_pickup_lat), 4326)::geography, p_radius_meters)
  ORDER BY distance_meters ASC
  LIMIT p_limit;
END;
$$;

-- RPC: upsert_my_driver_location
CREATE OR REPLACE FUNCTION public.upsert_my_driver_location(
  p_lat numeric,
  p_lng numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id integer;
BEGIN
  SELECT id INTO v_driver_id FROM public.drivers WHERE user_id = auth.uid();
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver'; END IF;

  INSERT INTO public.driver_locations (driver_id, lat, lng, point, last_seen_at)
  VALUES (v_driver_id, p_lat, p_lng, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), now())
  ON CONFLICT (driver_id) DO UPDATE
  SET lat = p_lat, lng = p_lng, point = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), last_seen_at = now();
END;
$$;

-- RPC: get_commission_rate_for_payment (Needed by refunds)
CREATE OR REPLACE FUNCTION get_commission_rate_for_payment(p_payment_id bigint)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_company_id bigint;
  v_commission_rate numeric;
BEGIN
  SELECT company_id INTO v_company_id FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN 0.20; END IF;
  SELECT platform_commission_rate INTO v_commission_rate FROM public.company_pricing WHERE company_id = v_company_id AND is_active = true ORDER BY effective_from DESC LIMIT 1;
  RETURN COALESCE(v_commission_rate, 0.20);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.create_company_as_user(uuid, text, text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_complete_ride(integer, numeric, numeric, text, text[]) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.find_nearby_drivers(numeric, numeric, numeric, text, bigint, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_driver_location(numeric, numeric) TO service_role, authenticated;

-- Note: Other missing RPCs (customer_cancel_announcement, driver_cancel_assignment, etc.)
-- RPC: customer_cancel_announcement
CREATE OR REPLACE FUNCTION public.customer_cancel_announcement(
  p_announcement_id bigint,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_shipment_id bigint;
  v_status text;
  v_fee_amount numeric := 0;
  v_currency text := 'TRY';
BEGIN
  SELECT status INTO v_status FROM public.announcements WHERE id = p_announcement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Announcement not found'; END IF;
  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'Already cancelled' USING ERRCODE = 'P4090'; END IF;

  UPDATE public.announcements SET status = 'cancelled', updated_at = now() WHERE id = p_announcement_id;

  SELECT id INTO v_shipment_id FROM public.shipments WHERE announcement_id = p_announcement_id AND status != 'cancelled' LIMIT 1;
  IF v_shipment_id IS NOT NULL THEN
    UPDATE public.shipments SET status = 'cancelled', cancellation_reason = p_reason, updated_at = now() WHERE id = v_shipment_id;
    -- Logic for fee calculation could go here
  END IF;

  RETURN jsonb_build_object('shipment_id', v_shipment_id, 'fee_amount', v_fee_amount, 'fee_currency', v_currency, 'payment_id', NULL);
END;
$$;

-- RPC: driver_cancel_assignment
CREATE OR REPLACE FUNCTION public.driver_cancel_assignment(
  p_announcement_id bigint,
  p_reason text,
  p_next_wave_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id integer;
  v_shipment_id bigint;
BEGIN
  SELECT id INTO v_driver_id FROM public.drivers WHERE user_id = auth.uid();
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver'; END IF;

  SELECT id INTO v_shipment_id FROM public.shipments WHERE announcement_id = p_announcement_id AND driver_id = v_driver_id AND status = 'assigned';
  IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found'; END IF;

  UPDATE public.shipments SET driver_id = NULL, status = 'unassigned', cancellation_reason = p_reason, updated_at = now() WHERE id = v_shipment_id;
  UPDATE public.announcements SET status = 'pending', updated_at = now() WHERE id = p_announcement_id;

  RETURN jsonb_build_object('shipment_id', v_shipment_id, 'rebroadcasted', true, 'new_batch_id', NULL, 'new_target_count', NULL);
END;
$$;

-- RPC: driver_arrive_ride
CREATE OR REPLACE FUNCTION public.driver_arrive_ride(p_shipment_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id integer;
BEGIN
  SELECT id INTO v_driver_id FROM public.drivers WHERE user_id = auth.uid();
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver'; END IF;

  UPDATE public.shipments
  SET status = 'arrived', arrived_at = now(), wait_started_at = now(), updated_at = now()
  WHERE id = p_shipment_id AND driver_id = v_driver_id;

  RETURN jsonb_build_object('shipment_id', p_shipment_id, 'status', 'arrived', 'arrived_at', now(), 'wait_started_at', now());
END;
$$;

-- RPC: driver_start_ride
CREATE OR REPLACE FUNCTION public.driver_start_ride(p_shipment_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id integer;
BEGIN
  SELECT id INTO v_driver_id FROM public.drivers WHERE user_id = auth.uid();
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver'; END IF;

  UPDATE public.shipments
  SET status = 'in_progress', picked_up_at = now(), wait_ended_at = now(), updated_at = now()
  WHERE id = p_shipment_id AND driver_id = v_driver_id AND status = 'arrived';

  RETURN jsonb_build_object('shipment_id', p_shipment_id, 'status', 'in_progress', 'picked_up_at', now(), 'wait_ended_at', now());
END;
$$;

-- RPC: driver_update_ride_location
CREATE OR REPLACE FUNCTION public.driver_update_ride_location(
  p_shipment_id bigint,
  p_lat numeric,
  p_lng numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id integer;
BEGIN
  SELECT id INTO v_driver_id FROM public.drivers WHERE user_id = auth.uid();
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'Not a driver'; END IF;

  PERFORM public.upsert_my_driver_location(p_lat, p_lng);

  INSERT INTO public.shipment_tracking (shipment_id, lat, lng, point, recorded_at)
  VALUES (p_shipment_id, p_lat, p_lng, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326), now());

  RETURN jsonb_build_object('shipment_id', p_shipment_id, 'inserted', true, 'eta_seconds', NULL, 'distance_remaining_meters', NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_cancel_announcement(bigint, text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_cancel_assignment(bigint, text, integer) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_arrive_ride(bigint) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_start_ride(bigint) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.driver_update_ride_location(bigint, numeric, numeric) TO service_role, authenticated;
