-- Temporarily disable the buggy rebroadcast trigger
-- It references 'declined' which doesn't exist in the offer_status enum

ALTER TABLE public.offers DISABLE TRIGGER tr_queue_rebroadcast_on_offer_decline;

SELECT 'Buggy trigger disabled - test demo now' AS status;

-- To re-enable later (after fixing the trigger function):
-- ALTER TABLE public.offers ENABLE TRIGGER tr_queue_rebroadcast_on_offer_decline;
