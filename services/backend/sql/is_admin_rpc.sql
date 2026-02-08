-- ============================================================
-- is_admin RPC Function
-- ============================================================
-- Checks if a user has the 'admin' role via user_role_assignments table.
-- Used by AdminGuard to enforce admin-only endpoints.
--
-- Usage:
--   SELECT is_admin('user-uuid-here');
--
-- Returns:
--   true if user has admin role, false otherwise
-- ============================================================

-- Underlying function that checks a specific user id
CREATE OR REPLACE FUNCTION public.is_admin_by_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check if user has admin role
  SELECT EXISTS (
    SELECT 1
    FROM public.user_role_assignments ura
    JOIN public.roles r ON r.id = ura.role_id
    WHERE ura.user_id = p_user_id
      AND r.name = 'admin'
  ) INTO v_is_admin;

  RETURN COALESCE(v_is_admin, false);
END;
$$;

-- Wrapper that uses auth.uid() so callers can rely on the request's JWT context
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT CASE WHEN auth.uid() IS NULL THEN false ELSE public.is_admin_by_user(auth.uid()::uuid) END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_by_user(uuid) TO service_role, authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.is_admin() IS 'Checks if the current auth.uid() has admin role (uses auth.uid()).';
COMMENT ON FUNCTION public.is_admin_by_user(uuid) IS 'Checks if the given user has admin role. Used by is_admin wrapper.';
