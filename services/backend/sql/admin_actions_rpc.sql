-- ============================================================
-- Admin Action RPCs
-- ============================================================
-- Security-first admin functions for managing companies and shipments.
-- All functions check admin role and log actions to audit_logs.
-- ============================================================

-- ============================================================
-- 1) admin_set_company_status
-- ============================================================
-- Updates company status and logs the action.
-- Only callable by admin users (checked via is_admin()).
--
-- Usage:
--   SELECT admin_set_company_status(123, 'approved', 'Verified documents');
--
-- Returns:
--   Updated company row
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_set_company_status(
  p_company_id bigint,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS SETOF companies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_old_status text;
BEGIN
  -- Get current user
  v_admin_id := auth.uid();
  
  -- Check admin privileges
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  -- Validate status
  IF p_new_status NOT IN ('pending', 'approved', 'suspended', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status: %', p_new_status;
  END IF;

  -- Get old status for audit log
  SELECT status INTO v_old_status
  FROM public.companies
  WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found: %', p_company_id;
  END IF;

  -- Update company status
  UPDATE public.companies
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE id = p_company_id;

  -- Log to audit_logs
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    notes
  ) VALUES (
    'companies',
    p_company_id,
    'update_status',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status),
    v_admin_id,
    p_notes
  );

  -- Return updated company
  RETURN QUERY
  SELECT * FROM public.companies WHERE id = p_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_company_status(bigint, text, text) TO authenticated;
COMMENT ON FUNCTION public.admin_set_company_status(bigint, text, text) IS 'Admin-only: Update company status with audit logging';


-- ============================================================
-- 2) admin_force_shipment_status
-- ============================================================
-- Force-updates shipment status, writes status history, and logs to audit.
-- Only callable by admin users.
--
-- Usage:
--   SELECT admin_force_shipment_status(456, 'cancelled', 'Customer request');
--
-- Returns:
--   Updated shipment row
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_force_shipment_status(
  p_shipment_id bigint,
  p_new_status text,
  p_notes text DEFAULT NULL
)
RETURNS SETOF shipments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_old_status text;
BEGIN
  -- Get current user
  v_admin_id := auth.uid();
  
  -- Check admin privileges
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required';
  END IF;

  -- Validate status (adjust based on your shipment status enum)
  IF p_new_status NOT IN (
    'pending', 'assigned', 'picked_up', 'in_transit', 
    'arrived', 'delivered', 'cancelled', 'failed'
  ) THEN
    RAISE EXCEPTION 'Invalid shipment status: %', p_new_status;
  END IF;

  -- Get old status
  SELECT status INTO v_old_status
  FROM public.shipments
  WHERE id = p_shipment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shipment not found: %', p_shipment_id;
  END IF;

  -- Update shipment status
  UPDATE public.shipments
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE id = p_shipment_id;

  -- Insert into shipment_status_history
  INSERT INTO public.shipment_status_history (
    shipment_id,
    old_status,
    new_status,
    changed_by,
    notes,
    changed_at
  ) VALUES (
    p_shipment_id,
    v_old_status,
    p_new_status,
    v_admin_id,
    p_notes,
    now()
  );

  -- Log to audit_logs
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    old_values,
    new_values,
    user_id,
    notes
  ) VALUES (
    'shipments',
    p_shipment_id,
    'force_status',
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_new_status),
    v_admin_id,
    COALESCE(p_notes, 'Admin force status change')
  );

  -- Return updated shipment
  RETURN QUERY
  SELECT * FROM public.shipments WHERE id = p_shipment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_force_shipment_status(bigint, text, text) TO authenticated;
COMMENT ON FUNCTION public.admin_force_shipment_status(bigint, text, text) IS 'Admin-only: Force shipment status with history and audit logging';

-- ============================================================
-- Migration Complete
-- ============================================================
-- Deploy with:
--   psql $DATABASE_URL < sql/admin_actions_rpc.sql
--
-- Test:
--   SELECT admin_set_company_status(1, 'approved', 'test');
--   SELECT admin_force_shipment_status(1, 'cancelled', 'test');
-- ============================================================
