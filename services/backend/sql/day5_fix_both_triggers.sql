-- Fix: Drop BOTH offer status triggers and recreate with service_role bypass
-- Problem: There are TWO triggers validating offer status updates

-- Drop both triggers
DROP TRIGGER IF EXISTS offers_status_update_trigger ON public.offers;
DROP TRIGGER IF EXISTS trg_enforce_offer_status_update ON public.offers;

-- Drop both functions
DROP FUNCTION IF EXISTS public.validate_offer_status_update();
DROP FUNCTION IF EXISTS public._enforce_offer_status_update();

-- Create single unified function with service_role bypass
CREATE OR REPLACE FUNCTION public.validate_offer_status_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_customer_id bigint;
BEGIN
  -- Get user ID (NULL for service_role)
  v_user_id := auth.uid();
  
  -- BYPASS: Allow updates when no user (service_role)
  IF v_user_id IS NULL THEN
    -- Update timestamp
    IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
      NEW.responded_at := NOW();
    END IF;
    RETURN NEW;
  END IF;
  
  -- For authenticated users, enforce basic rules
  
  -- Only allow status changes from 'pending' state
  IF OLD.status != 'pending' AND OLD.status != NEW.status THEN
    RAISE EXCEPTION 'Teklif zaten cevaplanmış'
      USING ERRCODE = 'P0001';
  END IF;
  
  -- Update timestamp
  IF OLD.status = 'pending' AND NEW.status != 'pending' THEN
    NEW.responded_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate single trigger
CREATE TRIGGER offers_status_update_trigger
  BEFORE UPDATE OF status
  ON public.offers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_offer_status_update();

-- Success message
SELECT 'Both triggers fixed - service_role bypass enabled' AS status;
