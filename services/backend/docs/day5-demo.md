# Day 5 — Demo Ready

End-to-end demo: announcement → match → offer → accept → checkout → payment callback.

---

## Prerequisites

### 1. Environment Variables

Add to `.env` or `.env.test` in `kargogig-backend/`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Demo users (must exist in Supabase Auth + corresponding table rows)
DEMO_CUSTOMER_EMAIL=customer@test.com
DEMO_CUSTOMER_PASSWORD=test123456
DEMO_COMPANY_EMAIL=company@test.com
DEMO_COMPANY_PASSWORD=test123456
DEMO_DRIVER_EMAIL=driver@test.com         # optional (for matching)
DEMO_DRIVER_PASSWORD=test123456            # optional

# App settings
API_BASE_URL=http://localhost:3000         # for PowerShell script
APP_VERSION=0.5.0                          # shown in /health
PAYMENT_PROVIDER=mock                      # use mock for demo
```

### 2. Database Migrations

Run these SQL files in Supabase SQL Editor (Dashboard → SQL → New Query):

1. **Audit logs request_id** — `sql/day5_audit_logs_request_id.sql`
2. **Analytics events table** — `sql/day4_analytics_events.sql` (if not already applied)

```sql
-- Quick check if migration is needed:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'audit_logs' AND column_name = 'request_id';
```

### 3. Demo Users Setup

Ensure these exist in Supabase:

| Role     | Auth user | Table row |
|----------|-----------|-----------|
| Customer | `DEMO_CUSTOMER_EMAIL` in `auth.users` | `customers` row with `user_id` = auth user id |
| Company  | `DEMO_COMPANY_EMAIL` in `auth.users` | `companies` row with `user_id` = auth user id, `status` = `approved` |
| Driver   | `DEMO_DRIVER_EMAIL` (optional) | `drivers` + `driver_sessions` with active location |

---

## Running the Demo

### Option A: PowerShell Script

```powershell
cd kargogig-backend

# Start backend (in another terminal)
npm run start:dev

# Run demo
.\scripts\day5-demo.ps1
```

The script will:
1. Load `.env` / `.env.test`
2. Login customer & company via Supabase password grant
3. Run the full flow with colored output and request IDs
4. Print debug query commands at the end

### Option B: E2E Test

```bash
cd kargogig-backend
npm run test:e2e -- --testPathPattern=day5-demo
```

### Option C: Manual (curl/Invoke-RestMethod)

```powershell
# 1) Health
Invoke-RestMethod http://localhost:3000/api/v1/health

# 2) Login
$body = @{ email="customer@test.com"; password="test123456" } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "$env:SUPABASE_URL/auth/v1/token?grant_type=password" `
  -Method POST -Body $body `
  -Headers @{ apikey=$env:SUPABASE_ANON_KEY; Authorization="Bearer $($env:SUPABASE_ANON_KEY)"; "Content-Type"="application/json" }
$token = $resp.access_token

# 3) Create announcement
$ann = @{
  pickup_location="Kadikoy"; pickup_lat=40.99; pickup_lng=29.03
  delivery_location="Besiktas"; delivery_lat=41.04; delivery_lng=29.01
  cargo_type="box"
} | ConvertTo-Json
Invoke-RestMethod http://localhost:3000/api/v1/announcements -Method POST `
  -Body $ann -Headers @{ Authorization="Bearer $token"; "Content-Type"="application/json" }
```

---

## API Endpoints (Demo Flow)

| Step | Method | Endpoint | Auth | Notes |
|------|--------|----------|------|-------|
| 1 | GET | `/api/v1/health` | None | Returns `{ ok, version, request_id, ts }` |
| 2 | POST | `/api/v1/announcements` | Customer | Creates announcement with PostGIS points |
| 3 | POST | `/api/v1/announcements/:id/match` | Any | Finds nearby drivers |
| 4 | POST | `/api/v1/offers` | Company | Creates offer for announcement |
| 5 | PATCH | `/api/v1/offers/:id/accept` | Customer | Accepts offer → DB trigger creates shipment |
| 6 | POST | `/api/v1/payments/checkout` | Customer | Creates payment session (shipment must be completed) |
| 7 | POST | `/api/v1/payments/callback/mock` | None | Mock payment callback (success/failed) |

---

## Troubleshooting with request_id

Every response includes `x-request-id` header. Error responses include `request_id` in body.

### Query audit_logs by request_id

```powershell
$svcKey = $env:SUPABASE_SERVICE_ROLE_KEY
$url = $env:SUPABASE_URL
$headers = @{ apikey=$svcKey; Authorization="Bearer $svcKey" }

# Find all audit entries for a specific request
Invoke-RestMethod "$url/rest/v1/audit_logs?request_id=eq.demo-003&select=*&order=created_at.desc" `
  -Headers $headers
```

### Query analytics_events

```powershell
# Recent analytics events
Invoke-RestMethod "$url/rest/v1/analytics_events?select=*&order=created_at.desc&limit=20" `
  -Headers $headers

# Filter by event name
Invoke-RestMethod "$url/rest/v1/analytics_events?event_name=eq.announcement_created&select=*&order=created_at.desc" `
  -Headers $headers
```

### Query payments

```powershell
Invoke-RestMethod "$url/rest/v1/payments?shipment_id=eq.123&select=*" -Headers $headers
```

---

## What Was Fixed (Postmortem)

### 500 on POST /api/v1/announcements

**Root cause:** Two issues combined:

1. **Missing PostGIS points** — The `announcements` table has `pickup_point` and `delivery_point` as NOT NULL `geometry(Point, 4326)` columns. The service was inserting `{...createDto}` without building EWKT strings like `SRID=4326;POINT(lng lat)`. The comment said "trigger will build points" but no such trigger existed.

2. **NULL `auth.uid()`** — The service used `getClient()` (anon client without JWT), so the DB function `current_customer_id()` (which calls `auth.uid()`) returned NULL. With a NOT NULL constraint on `customer_id`, this failed.

**Fix:**
- Service now extracts user token from `Authorization` header
- Resolves `customer_id` by looking up `customers.user_id` via service client
- Builds `pickup_point` / `delivery_point` EWKT strings from lat/lng
- Uses `getServiceClient()` for the insert to bypass RLS
- Strips `customer_id` from client input (security)

### Health endpoint returned 401

**Root cause:** `@UseGuards(AdminGuard)` was on the basic health check, making it inaccessible without an admin token.

**Fix:** Removed guard from `GET /health`. Admin-only check moved to `GET /health/admin-ping`.

### Matching double prefix

**Root cause:** `@Controller('api/v1/announcements')` + global prefix `api/v1` = `/api/v1/api/v1/announcements/:id/match`.

**Fix:** Changed to `@Controller('announcements')`. Already applied in previous iteration.
