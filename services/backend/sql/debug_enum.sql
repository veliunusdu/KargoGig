-- Test: Check what values are valid for offer_status enum
-- and disable problematic triggers temporarily

-- Check enum values
SELECT enum_range(NULL::offer_status);

-- Temporarily disable the problematic queue rebroadcast trigger
ALTER TABLE public.offers DISABLE TRIGGER tr_queue_rebroadcast_on_offer_decline;

-- Test update
-- UPDATE public.offers SET status = 'accepted' WHERE id = 5123;

-- Re-enable after testing
-- ALTER TABLE public.offers ENABLE TRIGGER tr_queue_rebroadcast_on_offer_decline;
