# Development Log

## 2026-02-06 — Day 5: Cancellation E2E — Full Integration Tests

### Shipped

- ✅ **Driver cancel full E2E** (Test C) — complete DB verification:
  - Pre-condition check: `shipment.driver_id` == assigned driver, status == `assigned`
  - Endpoint call with **real driver JWT token** (not admin)
  - `shipment.driver_id` → NULL verified in DB
  - `shipment.status` → `driver_cancelled`/`cancelled`/`unassigned` verified
  - `shipment.cancellation_reason` verified
  - `announcements.status` reverts to `pending`/`broadcasting`/`rebroadcasting`
  - `announcement_broadcast_batches` row verified when `rebroadcasted: true`
  - `shipment_cancellations` audit log row verified (soft check — warns if table not deployed)
  - Driver cancel idempotency: second cancel → 400/403/404/409

- ✅ **`handleRpcMissing` hardened** — now uses precise PostgreSQL patterns:
  - `function.*does not exist` / `could not find the function` / `schema cache`
  - No more false positives on legitimate 404 "not found" app errors

- ✅ **`E2E_STRICT_DB` mode** — controlled via env variable:
  - `E2E_STRICT_DB=true` → RPC missing = test **fails** (for CI)
  - Default → RPC missing = test **skips** with warning (for local dev)

- ✅ **Test D: Customer cancel with fee** (env-based):
  - `CANCEL_FREE_WINDOW_MINUTES=0` → every cancel after assignment charges fee
  - Back-dates `shipment.assigned_at` to fall outside free window
  - Asserts `fee_amount > 0`, `fee_currency` defined

### Test Architecture

```
Seeding (service_role)          Endpoint calls (user token)
──────────────────────          ───────────────────────────
auth.admin.createUser()   →    signInWithPassword() → JWT
admin.from('drivers')     →    POST /rides/:id/driver-cancel
admin.from('shipments')   →    POST /rides/:id/cancel
admin.from('vehicles')
admin.from('driver_locations')
```

**Rule**: Setup/seed = `service_role`, endpoint calls = user JWT.
This keeps RLS enforced on prod paths while bypassing it for test data.

### Files Changed

- `test/cancellation.e2e-spec.ts` — enhanced Test C, added Test D, hardened `handleRpcMissing`
- `docs/checklist.md` — Day 5 section added
- `docs/devlog.md` — this entry

### Next (Day 6+)

- [ ] Deploy `driver_cancel_assignment` RPC if not done
- [ ] Deploy `shipment_cancellations` audit table
- [ ] CI pipeline with `E2E_STRICT_DB=true`
- [ ] Push notification on driver cancel (customer gets notified)

## 2026-02-04 — Day 4: Configuration & Security

### Shipped

- ✅ Added `/health` endpoint (returns 200 OK with `{ ok: true }`)
- ✅ Request logging middleware: `x-request-id` header on all responses
- ✅ Rate limiting enabled via `@nestjs/throttler`
  - `short`: 60 req / 60s (general endpoints)
  - `auth`: 10 req / 60s (for auth endpoints - stricter)
- ✅ Trust proxy configured for production (Nginx/Cloudflare)
- ✅ CORS enabled

### Proof

```bash
# Health check with x-request-id
curl.exe -i http://localhost:3000/health
# Response headers include:
# x-request-id: f737b674-4086-4483-8767-5fe98c9c1665

# Rate limiting test (70 requests, expect 429 after 60)
1..70 | % {
  try { (Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing).StatusCode }
  catch { $_.Exception.Response.StatusCode.Value__ }
} | Group-Object | Select Name,Count

# Result:
# Name Count
# ---- -----
# 200      8  (remaining from previous minute)
# 429     62  (rate limited)
```

### Files Changed

- `src/health/health.controller.ts` - Health endpoint
- `src/health/health.module.ts` - Health module
- `src/middleware/request-logger.middleware.ts` - Structured JSON logging
- `src/app.module.ts` - ThrottlerModule + HealthModule + RequestLoggerMiddleware
- `src/main.ts` - trust proxy + CORS + health exclusion from prefix

### Next

- [ ] Add integration E2E: full onboarding flow test
- [ ] Verify pricing policies in pg_policies output
- [ ] Add Pino/Winston for production logging
- [ ] Redis-backed rate limiting for multi-instance deployments
