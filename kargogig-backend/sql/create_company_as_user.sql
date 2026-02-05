-- Create a function that inserts a company with a proper user context
-- This is needed because the companies table has a trigger that writes to company_users
-- using auth.uid(), which is NULL when using service role client directly.
-- 
-- Run this SQL in Supabase SQL Editor or via psql.

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
  -- Set the JWT claim so auth.uid() returns the provided user ID
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  
  -- Now insert the company - the trigger will use auth.uid() correctly
  INSERT INTO public.companies(name, status)
  VALUES (p_name, p_status)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute permission to service_role and authenticated users
GRANT EXECUTE ON FUNCTION public.create_company_as_user(uuid, text, text) TO service_role, authenticated;
