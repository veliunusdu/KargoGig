# Week 8 Day 3 - Automation Testing & Monitoring Guide (v2)

Targeted fixes for actual cron.job_run_details errors.

## Root Causes Fixed

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `null value in column "run_after"` | `rebroadcast_sweep()` inserts `run_at` but table requires `run_after` NOT NULL | INSERT all NOT NULL cols: `run_after`, `requested_at`, `run_at` |
| `function broadcast_announcement(bigint,int,int,unknown) does not exist` | Function not in `public` schema, or `'rebroadcast'` literal not cast to `::text` | Auto-detect schema + create public wrapper; explicit `::text` cast |
| `process_rebroadcast_queue(50)` fails | Only no-arg version exists; default-param overload = ambiguity | Keep no-arg for cron; add `process_rebroadcast_queue_limit(int)` |

---

## Deployment

### Step 1: Run Migration

```powershell
psql $env:DATABASE_URL -f kargogig-backend/sql/week8_day3_automation_fix.sql
```

**Expected:** No errors. NOTICE lines about wrapper creation and unscheduled jobs are OK.

### Step 2: Verify broadcast_announcement Schema

**If migration shows WARNING about broadcast_announcement not found**, run this to find it manually:

```sql
SELECT n.nspname AS schema, p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS returns
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'broadcast_announcement';
```

If schema ≠ `public`, create wrapper manually (replace `SCHEMA_NAME` and return type):

```sql
CREATE OR REPLACE FUNCTION public.broadcast_announcement(
  p_announcement_id bigint,
  p_radius_m integer DEFAULT 5000,
  p_target_limit integer DEFAULT 25,
  p_reason text DEFAULT 'auto'
)
RETURNS uuid   -- ← match actual return type
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT SCHEMA_NAME.broadcast_announcement($1,$2,$3,$4); $$;
```

### Step 3: Wait 2 minutes, then run tests below.

---

## Test Checklist

### ✅ TEST 1: Cron Jobs Exist

```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname IN (
  'rebroadcast_sweep_1m',
  'process_rebroadcast_queue_1m',
  'document_expiry_reminders_daily_0900'
)
ORDER BY jobname;
```

**Expected:**

| jobname | schedule | active |
|---------|----------|--------|
| document_expiry_reminders_daily_0900 | 0 9 * * * | t |
| process_rebroadcast_queue_1m | * * * * * | t |
| rebroadcast_sweep_1m | * * * * * | t |

---

### ✅ TEST 2: rebroadcast_sweep() Works

```sql
SELECT public.rebroadcast_sweep() AS enqueued;
```

**Expected:** Returns integer (0+), **no error**. The `run_after NULL` error is gone.

---

### ✅ TEST 3: Queue Has Pending Items

```sql
SELECT count(*) AS pending
FROM public.rebroadcast_queue
WHERE processed_at IS NULL
  AND run_after <= now();
```

---

### ✅ TEST 4: process_rebroadcast_queue() Works (no args!)

```sql
SELECT public.process_rebroadcast_queue() AS processed;
```

**Expected:** Returns integer (0+), **no error**. The `broadcast_announcement does not exist` error is gone.

For custom limit, use the separate function:
```sql
SELECT public.process_rebroadcast_queue_limit(10) AS processed;
```

---

### ✅ TEST 5: Cron Runs Succeeding

```sql
SELECT j.jobname, jrd.status, jrd.start_time, jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('rebroadcast_sweep_1m', 'process_rebroadcast_queue_1m')
ORDER BY jrd.start_time DESC
LIMIT 20;
```

**Expected:** All recent rows show `status = 'succeeded'`. No more `failed`.

---

### ✅ TEST 6: Queue Items Processed

```sql
SELECT
  announcement_id,
  run_after,
  requested_at,
  reason,
  processed_at,
  last_error,
  CASE
    WHEN processed_at IS NOT NULL THEN '✓ Processed'
    WHEN last_error IS NOT NULL THEN '✗ Error: ' || left(last_error, 80)
    ELSE '⏳ Pending'
  END AS status
FROM public.rebroadcast_queue
ORDER BY run_after DESC
LIMIT 20;
```

**Expected:**
- Items with `processed_at` populated = success
- Items with `last_error` + no `processed_at` = will retry in 5 min

---

### ✅ TEST 7: Broadcast Batches Created

```sql
SELECT id, announcement_id, created_at
FROM public.announcement_broadcast_batches
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** New batches after running `process_rebroadcast_queue()`.

---

### ✅ TEST 8: Document Expiry Wrapper

```sql
SELECT public.send_document_expiry_reminders_default();
```

**Expected:** Returns integer (likely 0).

---

## End-to-End Flow Test

```sql
-- 1. Find or create stale announcement
SELECT id, status, created_at
FROM public.announcements
WHERE status IN ('pending'::announcement_status, 'broadcasting'::announcement_status)
  AND created_at < now() - interval '3 minutes'
LIMIT 1;

-- 2. Run sweep (should enqueue it)
SELECT public.rebroadcast_sweep() AS enqueued;

-- 3. Check queue
SELECT announcement_id, run_after, processed_at, last_error
FROM public.rebroadcast_queue
WHERE processed_at IS NULL
ORDER BY run_after DESC
LIMIT 5;

-- 4. Process queue
SELECT public.process_rebroadcast_queue() AS processed;

-- 5. Verify processed
SELECT announcement_id, processed_at, last_error
FROM public.rebroadcast_queue
ORDER BY run_after DESC
LIMIT 5;

-- 6. Verify broadcast batch
SELECT id, announcement_id, created_at
FROM public.announcement_broadcast_batches
ORDER BY created_at DESC
LIMIT 5;
```

---

## Troubleshooting

### "null value in column run_after"

Re-run migration. The fixed `rebroadcast_sweep()` now inserts `run_after`, `requested_at`, `run_at`.

### "function broadcast_announcement(bigint,int,int,unknown) does not exist"

1. Run the diagnostic query from Step 2 above
2. If it's in a different schema, create the public wrapper
3. Ensure `'rebroadcast'::text` cast is in `rebroadcast_announcement()`

### "function process_rebroadcast_queue(integer) does not exist"

Don't call with args. Use `process_rebroadcast_queue()` (no args) or `process_rebroadcast_queue_limit(50)`.

### Queue items stuck with last_error

```sql
-- Check what's failing
SELECT announcement_id, last_error
FROM public.rebroadcast_queue
WHERE last_error IS NOT NULL AND processed_at IS NULL;

-- Reset stuck items for immediate retry
UPDATE public.rebroadcast_queue
SET run_after = now(), last_error = NULL
WHERE last_error IS NOT NULL AND processed_at IS NULL;
```

### Cron jobs still showing "failed"

```sql
SELECT j.jobname, jrd.return_message, jrd.start_time
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE jrd.status = 'failed'
ORDER BY jrd.start_time DESC
LIMIT 10;
```

Read `return_message` — it contains the actual SQL error.

---

## Monitoring (Daily)

```sql
-- Success rate last 24h
SELECT
  j.jobname,
  COUNT(*) AS total,
  SUM(CASE WHEN jrd.status = 'succeeded' THEN 1 ELSE 0 END) AS ok,
  SUM(CASE WHEN jrd.status = 'failed' THEN 1 ELSE 0 END) AS fail
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname IN ('rebroadcast_sweep_1m','process_rebroadcast_queue_1m')
  AND jrd.start_time > now() - interval '24 hours'
GROUP BY j.jobname;

-- Queue health
SELECT
  COUNT(*) FILTER (WHERE processed_at IS NULL AND run_after <= now()) AS ready,
  COUNT(*) FILTER (WHERE processed_at IS NULL AND run_after > now()) AS backoff,
  COUNT(*) FILTER (WHERE processed_at IS NOT NULL) AS done,
  COUNT(*) FILTER (WHERE last_error IS NOT NULL AND processed_at IS NULL) AS errored
FROM public.rebroadcast_queue
WHERE run_after > now() - interval '24 hours';
```

---

**Version:** Week 8 Day 3 v2  
**Last Updated:** February 8, 2026
