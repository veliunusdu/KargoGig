# Admin Endpoints - Testing & Usage Guide

## Overview

Week 8 Day 1 implementation: Server-side admin endpoints for managing companies and shipments (rides). All endpoints require admin JWT authentication.

## Architecture

```
Request → /api/v1/admin/* 
       → AdminGuard (validates JWT bearer token)
       → is_admin() RPC (checks role via auth.uid())
       → Admin Controller → Service-role Supabase client
       → Admin RPC actions (with audit logging)
```

## Setup

### 1. Deploy SQL Functions

Deploy the admin RPCs to your database:

```powershell
# Deploy is_admin check
psql $env:DATABASE_URL -f kargogig-backend/sql/is_admin_rpc.sql

# Deploy admin action RPCs
psql $env:DATABASE_URL -f kargogig-backend/sql/admin_actions_rpc.sql
```

Or via Supabase SQL Editor:
- Paste contents of `sql/is_admin_rpc.sql` and run
- Paste contents of `sql/admin_actions_rpc.sql` and run

### 2. Create Admin User

```sql
-- 1. Get or create admin role
INSERT INTO public.roles (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING;

-- 2. Assign admin role to user
INSERT INTO public.user_role_assignments (user_id, role_id)
VALUES (
  'your-user-uuid-here',
  (SELECT id FROM public.roles WHERE name = 'admin')
)
ON CONFLICT DO NOTHING;
```

### 3. Get User Tokens

```powershell
# Regular user (for testing 403)
$USER_EMAIL = "user@example.com"
$USER_PASSWORD = "password123"

# Admin user
$ADMIN_EMAIL = "admin@example.com"
$ADMIN_PASSWORD = "admin123"

# Sign in via Supabase Auth to get JWT tokens
# (Use Supabase client or REST API)
```

## API Endpoints

### Health Check (Public)

```powershell
curl.exe -i http://localhost:3000/health
```

**Expected**: `200 OK` (no auth required)

---

### Admin Ping (Auth Test)

```powershell
# Without token → 401
curl.exe -i http://localhost:3000/api/v1/admin/ping

# With non-admin token → 403
curl.exe -i http://localhost:3000/api/v1/admin/ping `
  -H "Authorization: Bearer $USER_TOKEN"

# With admin token → 200
curl.exe -i http://localhost:3000/api/v1/admin/ping `
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Expected Responses**:
- No token: `401 Unauthorized` - "Missing bearer token"
- Invalid token: `401 Unauthorized` - "Invalid token"
- Non-admin: `403 Forbidden` - "Admin privileges required"
- Admin: `200 OK` - `{"ok": true}`

---

### List Companies

```powershell
# Get all pending companies (default)
curl.exe http://localhost:3000/api/v1/admin/companies `
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Filter by status
curl.exe "http://localhost:3000/api/v1/admin/companies?status=approved" `
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Pagination
curl.exe "http://localhost:3000/api/v1/admin/companies?limit=10&offset=0" `
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Query Parameters**:
- `status` (optional): `pending` | `approved` | `suspended` | `rejected`
- `limit` (optional): Max 100, default 50
- `offset` (optional): Default 0

**Response**:
```json
{
  "ok": true,
  "data": [
    {
      "id": 123,
      "name": "Test Company",
      "status": "pending",
      "created_at": "2026-02-08T10:00:00Z",
      ...
    }
  ],
  "count": 1
}
```

---

### Update Company Status

```powershell
curl.exe -X PATCH http://localhost:3000/api/v1/admin/companies/123/status `
  -H "Authorization: Bearer $ADMIN_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"status\": \"approved\", \"notes\": \"Verified documents\"}'
```

**Body**:
```json
{
  "status": "pending" | "approved" | "suspended" | "rejected",
  "notes": "Optional reason"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": 123,
    "status": "approved",
    "updated_at": "2026-02-08T10:05:00Z",
    ...
  }
}
```

**Side Effects**:
- Updates `companies.status` and `companies.updated_at`
- Creates entry in `audit_logs` table
- Logs admin user ID, old/new values, and notes

---

### List Rides (Shipments)

```powershell
# Get all assigned rides
curl.exe "http://localhost:3000/api/v1/admin/rides?status=assigned" `
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Pagination
curl.exe "http://localhost:3000/api/v1/admin/rides?limit=20&offset=0" `
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Query Parameters**:
- `status` (optional): `pending` | `assigned` | `picked_up` | `in_transit` | `arrived` | `delivered` | `cancelled` | `failed`
- `limit` (optional): Max 100, default 50
- `offset` (optional): Default 0

**Response**: Same structure as companies list

---

### Force Shipment Status

```powershell
curl.exe -X PATCH http://localhost:3000/api/v1/admin/rides/456/force-status `
  -H "Authorization: Bearer $ADMIN_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"status\": \"cancelled\", \"notes\": \"Customer request\"}'
```

**Body**:
```json
{
  "status": "pending" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered" | "cancelled" | "failed",
  "notes": "Optional reason"
}
```

**Response**:
```json
{
  "ok": true,
  "data": {
    "id": 456,
    "status": "cancelled",
    "updated_at": "2026-02-08T10:10:00Z",
    ...
  }
}
```

**Side Effects**:
- Updates `shipments.status` and `shipments.updated_at`
- Creates entry in `shipment_status_history` table
- Creates entry in `audit_logs` table
- Logs admin user ID, old/new values, and notes

---

## Complete Test Script

```powershell
# Set your tokens
$ADMIN_TOKEN = "eyJhbGc..."
$USER_TOKEN = "eyJhbGc..."

# 1. Health check (public)
Write-Host "`n=== Health Check ===" -ForegroundColor Cyan
curl.exe -i http://localhost:3000/health

# 2. Admin ping (no auth) → 401
Write-Host "`n=== Admin Ping (No Token) ===" -ForegroundColor Cyan
curl.exe -i http://localhost:3000/api/v1/admin/ping

# 3. Admin ping (non-admin) → 403
Write-Host "`n=== Admin Ping (Non-Admin) ===" -ForegroundColor Cyan
curl.exe -i http://localhost:3000/api/v1/admin/ping `
  -H "Authorization: Bearer $USER_TOKEN"

# 4. Admin ping (admin) → 200
Write-Host "`n=== Admin Ping (Admin) ===" -ForegroundColor Cyan
curl.exe -i http://localhost:3000/api/v1/admin/ping `
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. List companies
Write-Host "`n=== List Companies ===" -ForegroundColor Cyan
curl.exe http://localhost:3000/api/v1/admin/companies `
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 6. Update company status
Write-Host "`n=== Update Company Status ===" -ForegroundColor Cyan
curl.exe -X PATCH http://localhost:3000/api/v1/admin/companies/1/status `
  -H "Authorization: Bearer $ADMIN_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"status\": \"approved\", \"notes\": \"Test approval\"}'

# 7. List rides
Write-Host "`n=== List Rides ===" -ForegroundColor Cyan
curl.exe http://localhost:3000/api/v1/admin/rides `
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 8. Force ride status
Write-Host "`n=== Force Ride Status ===" -ForegroundColor Cyan
curl.exe -X PATCH http://localhost:3000/api/v1/admin/rides/1/force-status `
  -H "Authorization: Bearer $ADMIN_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{\"status\": \"cancelled\", \"notes\": \"Test cancellation\"}'
```

---

## Troubleshooting

### 404 Not Found on /api/v1/admin/*

**Causes**:
- AdminModule not imported in `app.module.ts` imports array
- Server not restarted after adding module
- Wrong URL (check if global prefix is correct)

**Fix**:
```typescript
// app.module.ts
imports: [
  // ... other modules
  AdminModule,  // ← Must be present
]
```

### 401 Unauthorized - "Missing bearer token"

**Cause**: No `Authorization` header sent

**Fix**: Add header:
```powershell
-H "Authorization: Bearer your-jwt-token-here"
```

### 401 Unauthorized - "Invalid token"

**Causes**:
- Token expired
- Token malformed
- Wrong Supabase project

**Fix**: Get fresh token via Supabase Auth

### 403 Forbidden - "Admin privileges required"

**Causes**:
- User not assigned admin role
- `is_admin()` RPC not deployed
- `auth.uid()` returns null (token not properly bound)

**Fix**:
```sql
-- Check if user has admin role
SELECT 
  u.id,
  u.email,
  r.name as role
FROM auth.users u
LEFT JOIN public.user_role_assignments ura ON ura.user_id = u.id
LEFT JOIN public.roles r ON r.id = ura.role_id
WHERE u.email = 'your-email@example.com';

-- Assign admin role if missing
INSERT INTO public.user_role_assignments (user_id, role_id)
VALUES (
  'user-uuid',
  (SELECT id FROM public.roles WHERE name = 'admin')
);
```

### 500 Internal Server Error - "Admin check failed"

**Causes**:
- `is_admin()` RPC not deployed
- Missing GRANT permissions
- RPC function error

**Fix**:
```powershell
# Redeploy RPC functions
psql $env:DATABASE_URL -f kargogig-backend/sql/is_admin_rpc.sql
```

**Check RPC exists**:
```sql
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_admin', 'admin_set_company_status', 'admin_force_shipment_status');
```

### 500 on company/ride updates

**Causes**:
- Admin action RPCs not deployed
- Missing audit_logs or shipment_status_history tables
- Invalid status value

**Fix**:
```powershell
psql $env:DATABASE_URL -f kargogig-backend/sql/admin_actions_rpc.sql
```

---

## Database Schema Requirements

### Required Tables

```sql
-- roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id bigserial PRIMARY KEY,
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- user_role_assignments table
CREATE TABLE IF NOT EXISTS public.user_role_assignments (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id bigint NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  record_id bigint NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  user_id uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

-- shipment_status_history table
CREATE TABLE IF NOT EXISTS public.shipment_status_history (
  id bigserial PRIMARY KEY,
  shipment_id bigint NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  old_status text NOT NULL,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  changed_at timestamptz DEFAULT now()
);
```

---

## Security Notes

- **AdminGuard validates every request**: No caching, fresh auth.uid() check per request
- **Service role used for DB ops**: Controller uses service_role key to bypass RLS
- **Admin RPCs check is_admin()**: Double security layer (guard + RPC)
- **Audit logging**: All admin actions logged with user ID and notes
- **Token expiry**: Supabase JWTs expire (default 1 hour), refresh on client
- **Rate limiting**: ThrottlerGuard applies globally (check app.module.ts)

---

## Route Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | Public | Health check (no prefix) |
| `/api/v1/admin/ping` | GET | Admin | Auth validation test |
| `/api/v1/admin/companies` | GET | Admin | List companies (filterable) |
| `/api/v1/admin/companies/:id/status` | PATCH | Admin | Approve/suspend company |
| `/api/v1/admin/rides` | GET | Admin | List shipments (filterable) |
| `/api/v1/admin/rides/:id/force-status` | PATCH | Admin | Force shipment status |

---

## Next Steps

1. **Deploy SQL functions** to your database
2. **Assign admin role** to at least one user
3. **Get JWT tokens** for admin and regular user
4. **Run test script** above to verify all endpoints
5. **Monitor audit_logs** table for admin actions
6. **Add admin UI** (optional) - connect to these endpoints from admin dashboard

---

## Development vs Production

### Development
- Use `curl.exe` or Postman for testing
- Check server logs for detailed errors
- Verify RPC deployment in Supabase SQL Editor

### Production
- Use proper secret management for SUPABASE_SERVICE_ROLE_KEY
- Enable HTTPS only
- Monitor audit_logs for suspicious activity
- Set up alerts for failed admin authentication attempts
- Consider IP whitelisting for admin endpoints
- Add rate limiting specifically for admin routes (stricter than public)

---

**Last Updated**: February 8, 2026
**Version**: Week 8 Day 1
