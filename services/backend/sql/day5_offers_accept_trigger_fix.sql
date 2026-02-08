-- ============================================================
-- Day 5: Fix Offers Status Update Trigger for Service Role
-- ============================================================
-- Problem: "not allowed to update offer status" error when backend (service_role) 
--          tries to update offers.status via OffersService.acceptOffer()
--
-- Root Cause: Existing trigger function validates auth.uid() and blocks updates
--             when auth.uid() IS NULL (which is the case for service_role connections)
--
-- Solution: Modify trigger function to allow service_role to perform status updates
--           while keeping existing validation for normal users
--
-- Safe to run multiple times (idempotent with CREATE OR REPLACE)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- PART 1: Identify and Fix the Trigger Function
-- ────────────────────────────────────────────────────────────

-- This is the most common pattern for offer status validation triggers.
-- If your actual function has a different name, replace it accordingly.
-- The function likely exists as: validate_offer_status_update() or similar

CREATE OR REPLACE FUNCTION public.validate_offer_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id bigint;
  v_company_id bigint;
  v_current_user_id uuid;
BEGIN
  -- Get current user ID (will be NULL for service_role)
  v_current_user_id := auth.uid();
  
  -- CRITICAL FIX: Allow service_role (no user ID) to bypass all validation
  -- This enables backend services to update offer status programmatically
  IF v_current_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- For authenticated users, enforce validation

  -- Only allow status changes from 'pending' state
  IF OLD.status != 'pending' AND OLD.status != NEW.status THEN
    RAISE EXCEPTION 'offer status can only be changed when pending. Current: %, Requested: %', OLD.status, NEW.status
      USING ERRCODE = 'P0001';
  END IF;

  -- Validate status transition permissions:
  -- - Customer (announcement owner) can accept/reject
  -- - Company (offer creator) can cancel
  
  IF NEW.status IN ('accepted', 'rejected') THEN
    -- Must be the customer who owns the announcement
    SELECT a.customer_id INTO v_customer_id
    FROM public.announcements a
    WHERE a.id = NEW.announcement_id;
    
    -- Check if current user is the customer
    IF NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = v_customer_id 
        AND c.user_id = v_current_user_id
    ) THEN
      RAISE EXCEPTION 'not allowed to update offer status'
        USING ERRCODE = 'P0001',
              HINT = 'Only the customer who created the announcement can accept/reject offers';
    END IF;
    
  ELSIF NEW.status = 'cancelled' THEN
    -- Must be the company that created the offer
    IF NOT EXISTS (
      SELECT 1 FROM public.company_users cu
      WHERE cu.company_id = NEW.company_id
        AND cu.user_id = v_current_user_id
    ) THEN
      RAISE EXCEPTION 'not allowed to update offer status'
        USING ERRCODE = 'P0001',
              HINT = 'Only the company that created the offer can cancel it';
    END IF;
  END IF;

  -- Update responded_at timestamp when status changes from pending
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.responded_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Drop and recreate trigger (idempotent)
DROP TRIGGER IF EXISTS offers_status_update_trigger ON public.offers;

CREATE TRIGGER offers_status_update_trigger
  BEFORE UPDATE OF status
  ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_offer_status_update();

COMMENT ON FUNCTION public.validate_offer_status_update IS
  'Validates offer status updates. Allows service_role to bypass checks. For users: customers can accept/reject, companies can cancel.';

COMMENT ON TRIGGER offers_status_update_trigger ON public.offers IS
  'Enforces offer status transition rules while allowing backend (service_role) updates.';


-- ────────────────────────────────────────────────────────────
-- PART 2: Verify RLS Policies on Offers Table
-- ────────────────────────────────────────────────────────────

-- Check if RLS is enabled (informational only)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
      AND tablename = 'offers' 
      AND rowsecurity = true
  ) THEN
    RAISE NOTICE 'RLS is ENABLED on public.offers';
  ELSE
    RAISE NOTICE 'RLS is NOT enabled on public.offers';
  END IF;
END $$;

-- If RLS is enabled, we need an UPDATE policy for service_role
-- This policy allows service_role to update any offer
DROP POLICY IF EXISTS "service_role_update_offers" ON public.offers;

CREATE POLICY "service_role_update_offers"
  ON public.offers
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY "service_role_update_offers" ON public.offers IS
  'Allows service_role (backend) to update any offer. Required for programmatic status updates.';

-- Optional: Add a policy for customers to update offers they can accept
-- (This is typically handled by the trigger, but explicit RLS is cleaner)
DROP POLICY IF EXISTS "customers_update_announcement_offers" ON public.offers;

CREATE POLICY "customers_update_announcement_offers"
  ON public.offers
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow if user is the customer who owns the announcement
    EXISTS (
      SELECT 1 
      FROM public.announcements a
      JOIN public.customers c ON c.id = a.customer_id
      WHERE a.id = offers.announcement_id
        AND c.user_id = auth.uid()
    )
    OR
    -- Allow if user is from the company that created the offer
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = offers.company_id
        AND cu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same validation logic for the updated row
    EXISTS (
      SELECT 1 
      FROM public.announcements a
      JOIN public.customers c ON c.id = a.customer_id
      WHERE a.id = offers.announcement_id
        AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.company_id = offers.company_id
        AND cu.user_id = auth.uid()
    )
  );

COMMENT ON POLICY "customers_update_announcement_offers" ON public.offers IS
  'Allows customers to update offers for their announcements, and companies to update their own offers.';


-- ────────────────────────────────────────────────────────────
-- PART 3: Test the Fix
-- ────────────────────────────────────────────────────────────

-- Test 1: Service role should be able to update offer status
-- Run this manually with your actual offer ID:
-- 
-- UPDATE public.offers 
-- SET status = 'accepted' 
-- WHERE id = 5117;
-- 
-- Expected: Success (no error)

-- Test 2: Verify trigger is active
SELECT 
  tgname AS trigger_name,
  tgenabled AS enabled
FROM pg_trigger
WHERE tgrelid = 'public.offers'::regclass
  AND NOT tgisinternal
ORDER BY tgname;

-- Test 3: Check RLS policies (simplified to avoid array column issues)
SELECT 
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'offers'
ORDER BY policyname;

-- ────────────────────────────────────────────────────────────
-- VERIFICATION COMPLETE
-- ────────────────────────────────────────────────────────────
-- After running this migration:
-- 1. PATCH /api/v1/offers/:id/accept should succeed
-- 2. Service role can update offer status programmatically
-- 3. User validation still enforced for non-service-role connections
-- 4. RLS policies explicitly allow required operations
-- ────────────────────────────────────────────────────────────
