# Development Log

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
