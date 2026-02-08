-- ============================================================
-- Week 8 Day 3 Automation Fix - COMPLETE MIGRATION (v2)
-- ============================================================
-- Root-cause fixes from actual cron.job_run_details errors:
--
-- ERROR 1: rebroadcast_sweep() → null value in column "run_after"
--   Cause: INSERT INTO rebroadcast_queue(announcement_id, run_at, reason)
--          but table requires run_after NOT NULL. run_at ≠ run_after.
--
-- ERROR 2: process_rebroadcast_queue() → function
--   public.broadcast_announcement(bigint,integer,integer,unknown) does not exist
--   Cause: rebroadcast_announcement() calls broadcast_announcement(bigint,int,int,text)
--          but function may live in a different schema (not public).
--
-- ERROR 3: process_rebroadcast_queue(50) fails — only no-arg version exists.
--   Fix: keep no-arg for cron, add separate process_rebroadcast_queue_limit(int).
--
-- Actual rebroadcast_queue columns (confirmed):
--   announcement_id (PK/unique), run_after NOT NULL, requested_at NOT NULL,
--   reason, run_at NOT NULL, processed_at nullable
--
-- SAFETY: Idempotent. Safe to re-run multiple times.
-- Run: psql $DATABASE_URL -f sql/week8_day3_automation_fix.sql
-- ============================================================

BEGIN;

-- ============================================================
-- PART A: Table Defaults & Backfill Safety
-- ============================================================
-- Set DEFAULT now() on all NOT-NULL timestamp columns so future
-- INSERTs that omit them won't explode.
-- ============================================================

ALTER TABLE public.rebroadcast_queue
  ALTER COLUMN run_after SET DEFAULT now();

ALTER TABLE public.rebroadcast_queue
  ALTER COLUMN requested_at SET DEFAULT now();

ALTER TABLE public.rebroadcast_queue
  ALTER COLUMN run_at SET DEFAULT now();

-- Add last_error if it doesn't exist (for error tracking)
ALTER TABLE public.rebroadcast_queue
  ADD COLUMN IF NOT EXISTS last_error text;

-- Backfill any NULL run_after rows (should be zero, but safety)
UPDATE public.rebroadcast_queue
SET run_after = COALESCE(run_after, run_at, requested_at, now())
WHERE run_after IS NULL;

-- Backfill requested_at / run_at if somehow NULL
UPDATE public.rebroadcast_queue
SET requested_at = COALESCE(requested_at, run_after, now())
WHERE requested_at IS NULL;

UPDATE public.rebroadcast_queue
SET run_at = COALESCE(run_at, run_after, now())
WHERE run_at IS NULL;

-- Partial index for efficient queue processing (pending items only)
CREATE INDEX IF NOT EXISTS idx_rebroadcast_queue_pending
  ON public.rebroadcast_queue (run_after, announcement_id)
  WHERE processed_at IS NULL;


-- ============================================================
-- PART B: Fix rebroadcast_sweep()
-- ============================================================
-- ROOT CAUSE: Old function inserts (announcement_id, run_at, reason)
-- but table requires run_after NOT NULL → NULL violation.
--
-- Fix: INSERT all NOT-NULL columns: run_after, requested_at, run_at
-- Plus proper enum casting for status filter.
-- ============================================================

CREATE OR REPLACE FUNCTION public.rebroadcast_sweep()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt integer := 0;
BEGIN
  WITH candidates AS (
    SELECT a.id AS announcement_id
    FROM public.announcements a
    WHERE a.status IN (
      'pending'::announcement_status,
      'broadcasting'::announcement_status,
      'rebroadcasting'::announcement_status
    )
      AND a.created_at < now() - interval '2 minutes'
      AND NOT EXISTS (
        SELECT 1
        FROM public.announcement_broadcast_batches b
        WHERE b.announcement_id = a.id
          AND b.created_at > now() - interval '2 minutes'
      )
    ORDER BY a.created_at ASC
    LIMIT 50
  ),
  ins AS (
    INSERT INTO public.rebroadcast_queue
      (announcement_id, run_after, requested_at, run_at, reason)
    SELECT
      announcement_id,
      now(),   -- run_after  (NOT NULL — the column cron checks)
      now(),   -- requested_at (NOT NULL)
      now(),   -- run_at       (NOT NULL)
      'sweep'
    FROM candidates
    ON CONFLICT (announcement_id) DO UPDATE
      SET run_after    = EXCLUDED.run_after,
          requested_at = EXCLUDED.requested_at,
          run_at       = EXCLUDED.run_at,
          reason       = EXCLUDED.reason,
          processed_at = NULL,   -- reset for reprocessing
          last_error   = NULL    -- clear old errors
    RETURNING 1
  )
  SELECT count(*) INTO v_cnt FROM ins;

  RETURN v_cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebroadcast_sweep() TO service_role, authenticated;

COMMENT ON FUNCTION public.rebroadcast_sweep() IS
  'Sweep stale announcements (no broadcast batch in 2+ min) into rebroadcast_queue. Returns count enqueued.';


-- ============================================================
-- PART C: Fix rebroadcast_announcement()
-- ============================================================
-- ROOT CAUSE: Calls public.broadcast_announcement(bigint,int,int,text)
-- but function may live in another schema.
--
-- Strategy:
--   1. CREATE OR REPLACE with explicit ::text cast on reason literal
--   2. Use a DO block to detect broadcast_announcement's actual schema
--      and create a public wrapper if it's not already in public.
-- ============================================================

-- C.1: Detect broadcast_announcement schema and create public wrapper if needed
DO $$
DECLARE
  v_schema text;
  v_args   text;
  v_ret    text;
BEGIN
  -- Find broadcast_announcement with 4 args (bigint, integer, integer, text)
  SELECT n.nspname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid)
  INTO v_schema, v_args, v_ret
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE p.proname = 'broadcast_announcement'
    AND pg_get_function_identity_arguments(p.oid) LIKE '%bigint%integer%integer%text%'
  LIMIT 1;

  IF v_schema IS NULL THEN
    -- Try any broadcast_announcement overload
    SELECT n.nspname, pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid)
    INTO v_schema, v_args, v_ret
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'broadcast_announcement'
    LIMIT 1;
  END IF;

  IF v_schema IS NULL THEN
    RAISE WARNING 'broadcast_announcement not found in any schema — process_rebroadcast_queue will fail until it exists.';
  ELSIF v_schema = 'public' THEN
    RAISE NOTICE 'broadcast_announcement already in public schema (args: %). No wrapper needed.', v_args;
  ELSE
    RAISE NOTICE 'broadcast_announcement found in schema "%" (args: %, returns: %). Creating public wrapper.', v_schema, v_args, v_ret;

    -- Create a public pass-through wrapper
    -- We use dynamic SQL because we need the schema name at runtime
    EXECUTE format(
      $wrapper$
      CREATE OR REPLACE FUNCTION public.broadcast_announcement(
        p_announcement_id bigint,
        p_radius_m integer DEFAULT 5000,
        p_target_limit integer DEFAULT 25,
        p_reason text DEFAULT 'auto'
      )
      RETURNS %s
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public
      AS $fn$
        SELECT %I.broadcast_announcement($1, $2, $3, $4);
      $fn$;
      $wrapper$,
      v_ret,   -- return type (e.g. uuid, bigint, void, etc.)
      v_schema -- actual schema name
    );

    RAISE NOTICE 'Created public.broadcast_announcement wrapper → %.broadcast_announcement', v_schema;
  END IF;
END;
$$;

-- C.2: Fix rebroadcast_announcement() — explicit ::text cast
CREATE OR REPLACE FUNCTION public.rebroadcast_announcement(
  p_announcement_id bigint,
  p_radius_start  integer DEFAULT 5000,
  p_radius_step   integer DEFAULT 5000,
  p_radius_max    integer DEFAULT 20000,
  p_target_limit  integer DEFAULT 25
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_radius integer;
  v_batch uuid;
BEGIN
  -- Simple strategy: start at p_radius_start
  -- (extend with progressive radius logic as needed)
  v_next_radius := p_radius_start;

  v_batch := public.broadcast_announcement(
    p_announcement_id,
    v_next_radius,
    p_target_limit,
    'rebroadcast'::text       -- ← explicit cast prevents unknown/text ambiguity
  );

  RETURN v_batch;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebroadcast_announcement(bigint,integer,integer,integer,integer)
  TO service_role, authenticated;


-- ============================================================
-- PART D: Fix process_rebroadcast_queue()  (no-arg only)
-- ============================================================
-- ROOT CAUSE: Only no-arg version exists. Adding (p_limit int DEFAULT 50)
-- would create an AMBIGUOUS overload when called without args.
--
-- Fix: Replace no-arg version with hardcoded limit=50.
--      Add separate process_rebroadcast_queue_limit(int) for manual use.
-- ============================================================

-- D.1: Replace the existing no-arg function (cron calls this)
CREATE OR REPLACE FUNCTION public.process_rebroadcast_queue()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_record record;
  v_error_msg text;
BEGIN
  FOR v_record IN
    SELECT rq.announcement_id, rq.run_after, rq.reason
    FROM public.rebroadcast_queue rq
    WHERE rq.processed_at IS NULL
      AND rq.run_after <= now()
    ORDER BY rq.run_after ASC
    LIMIT 50                    -- hardcoded; use _limit() variant to override
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Call rebroadcast_announcement which handles broadcast_announcement dispatch
      PERFORM public.rebroadcast_announcement(v_record.announcement_id);

      UPDATE public.rebroadcast_queue
      SET processed_at = now(),
          last_error   = NULL
      WHERE announcement_id = v_record.announcement_id;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;

      UPDATE public.rebroadcast_queue
      SET last_error = v_error_msg,
          run_after  = now() + interval '5 minutes'   -- backoff
      WHERE announcement_id = v_record.announcement_id;

      RAISE WARNING 'rebroadcast failed for announcement % (retry in 5 min): %',
        v_record.announcement_id, v_error_msg;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_rebroadcast_queue() TO service_role, authenticated;

COMMENT ON FUNCTION public.process_rebroadcast_queue() IS
  'Process up to 50 pending rebroadcast queue items (cron-safe, no args). Returns count processed.';

-- D.2: Separate function with configurable limit (for manual / ad-hoc use)
CREATE OR REPLACE FUNCTION public.process_rebroadcast_queue_limit(p_limit integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_record record;
  v_error_msg text;
BEGIN
  FOR v_record IN
    SELECT rq.announcement_id, rq.run_after, rq.reason
    FROM public.rebroadcast_queue rq
    WHERE rq.processed_at IS NULL
      AND rq.run_after <= now()
    ORDER BY rq.run_after ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public.rebroadcast_announcement(v_record.announcement_id);

      UPDATE public.rebroadcast_queue
      SET processed_at = now(),
          last_error   = NULL
      WHERE announcement_id = v_record.announcement_id;

      v_count := v_count + 1;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_error_msg = MESSAGE_TEXT;

      UPDATE public.rebroadcast_queue
      SET last_error = v_error_msg,
          run_after  = now() + interval '5 minutes'
      WHERE announcement_id = v_record.announcement_id;

      RAISE WARNING 'rebroadcast failed for announcement % (retry in 5 min): %',
        v_record.announcement_id, v_error_msg;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_rebroadcast_queue_limit(integer) TO service_role, authenticated;

COMMENT ON FUNCTION public.process_rebroadcast_queue_limit(integer) IS
  'Process pending rebroadcast queue items with custom limit. Use for manual/ad-hoc processing.';


-- ============================================================
-- PART E: Document Expiry Reminders Wrapper
-- ============================================================

CREATE OR REPLACE FUNCTION public.send_document_expiry_reminders_default()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.send_document_expiry_reminders(ARRAY[1, 3, 7]::integer[]);
$$;

GRANT EXECUTE ON FUNCTION public.send_document_expiry_reminders_default() TO service_role, authenticated;

COMMENT ON FUNCTION public.send_document_expiry_reminders_default() IS
  'Default wrapper: document expiry reminders at 1,3,7 day intervals. Avoids overload ambiguity.';


-- ============================================================
-- PART F: Cron Job Setup (Idempotent)
-- ============================================================

CREATE OR REPLACE FUNCTION public._unschedule_job(p_name text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_id bigint;
BEGIN
  SELECT jobid INTO v_id FROM cron.job WHERE jobname = p_name;
  IF v_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_id);
    RAISE NOTICE 'Unscheduled: %', p_name;
  END IF;
END;
$$;

-- 1) rebroadcast_sweep — every minute
SELECT public._unschedule_job('rebroadcast_sweep_1m');
SELECT cron.schedule(
  'rebroadcast_sweep_1m',
  '* * * * *',
  $$SELECT public.rebroadcast_sweep();$$
);

-- 2) process_rebroadcast_queue — every minute (NO args)
SELECT public._unschedule_job('process_rebroadcast_queue_1m');
SELECT cron.schedule(
  'process_rebroadcast_queue_1m',
  '* * * * *',
  $$SELECT public.process_rebroadcast_queue();$$
);

-- 3) document_expiry_reminders — daily 09:00 UTC
SELECT public._unschedule_job('document_expiry_reminders_daily_0900');
SELECT cron.schedule(
  'document_expiry_reminders_daily_0900',
  '0 9 * * *',
  $$SELECT public.send_document_expiry_reminders_default();$$
);

DROP FUNCTION IF EXISTS public._unschedule_job(text);

COMMIT;


-- ============================================================
-- POST-MIGRATION: DIAGNOSTIC QUERIES (run manually)
-- ============================================================
-- STEP 0: Find broadcast_announcement's actual schema (if wrapper failed)
--
-- SELECT n.nspname AS schema, p.proname,
--        pg_get_function_identity_arguments(p.oid) AS args,
--        pg_get_function_result(p.oid) AS returns
-- FROM pg_proc p
-- JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE p.proname = 'broadcast_announcement';
--
-- If the schema is NOT "public" and the DO block wrapper failed,
-- create the wrapper manually (replace SCHEMA_NAME below):
--
-- CREATE OR REPLACE FUNCTION public.broadcast_announcement(
--   p_announcement_id bigint,
--   p_radius_m integer DEFAULT 5000,
--   p_target_limit integer DEFAULT 25,
--   p_reason text DEFAULT 'auto'
-- )
-- RETURNS uuid   -- ← match actual return type from query above
-- LANGUAGE sql SECURITY DEFINER SET search_path = public
-- AS $$ SELECT SCHEMA_NAME.broadcast_announcement($1,$2,$3,$4); $$;

-- ============================================================
-- STEP 1: Verify cron jobs exist
-- ============================================================
-- SELECT jobid, jobname, schedule, command, active
-- FROM cron.job
-- WHERE jobname IN (
--   'rebroadcast_sweep_1m',
--   'process_rebroadcast_queue_1m',
--   'document_expiry_reminders_daily_0900'
-- )
-- ORDER BY jobname;

-- ============================================================
-- STEP 2: Test rebroadcast_sweep manually
-- ============================================================
-- SELECT public.rebroadcast_sweep() AS enqueued;

-- ============================================================
-- STEP 3: Check pending queue
-- ============================================================
-- SELECT count(*) AS pending
-- FROM public.rebroadcast_queue
-- WHERE processed_at IS NULL
--   AND run_after <= now();

-- ============================================================
-- STEP 4: Test process_rebroadcast_queue manually
-- ============================================================
-- SELECT public.process_rebroadcast_queue() AS processed;
-- -- For custom limit:
-- -- SELECT public.process_rebroadcast_queue_limit(10) AS processed;

-- ============================================================
-- STEP 5: Verify broadcast batches created
-- ============================================================
-- SELECT id, announcement_id, created_at
-- FROM public.announcement_broadcast_batches
-- ORDER BY created_at DESC
-- LIMIT 10;

-- ============================================================
-- STEP 6: Check cron run history (wait 2 min after migration)
-- ============================================================
-- SELECT j.jobname, jrd.status, jrd.start_time, jrd.return_message
-- FROM cron.job_run_details jrd
-- JOIN cron.job j ON j.jobid = jrd.jobid
-- WHERE j.jobname IN ('rebroadcast_sweep_1m','process_rebroadcast_queue_1m')
-- ORDER BY jrd.start_time DESC
-- LIMIT 20;
