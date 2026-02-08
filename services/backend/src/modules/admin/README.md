# Admin Module

Week 8 Day 1: Production-ready admin endpoints for managing companies and shipments.

## Structure

```
src/admin/
├── admin.module.ts          # Module definition
├── admin.controller.ts      # Admin endpoints (all protected)
└── dto/
    ├── set-company-status.dto.ts        # Company status update DTO
    └── force-shipment-status.dto.ts     # Shipment status update DTO
```

## Endpoints

All routes under `/api/v1/admin/*` require admin JWT authentication via `AdminGuard`.

### GET /admin/ping
Auth validation test endpoint.

**Response**: `{ ok: true }`

### GET /admin/companies
List companies with filtering and pagination.

**Query Params**:
- `status`: Filter by status (pending, approved, suspended, rejected)
- `limit`: Max 100, default 50
- `offset`: Default 0

### PATCH /admin/companies/:companyId/status
Update company status with audit logging.

**Body**: `SetCompanyStatusDto`
- `status`: New status
- `notes`: Optional reason

### GET /admin/rides
List shipments (treated as rides) with filtering and pagination.

**Query Params**: Same as companies

### PATCH /admin/rides/:shipmentId/force-status
Force shipment status change with history and audit logging.

**Body**: `ForceShipmentStatusDto`
- `status`: New status
- `notes`: Optional reason

## Authentication Flow

```
Request with JWT
    ↓
AdminGuard extracts Bearer token
    ↓
sb.auth.getUser() validates token → 401 if invalid
    ↓
sb.rpc('is_admin') checks role → 403 if not admin
    ↓
Controller method executes
    ↓
Admin RPC with audit logging
```

## Dependencies

- **SQL Functions**: `is_admin()`, `admin_set_company_status()`, `admin_force_shipment_status()`
- **Database Tables**: `roles`, `user_role_assignments`, `audit_logs`, `shipment_status_history`
- **Environment**: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Testing

See [docs/admin-endpoints-guide.md](../../docs/admin-endpoints-guide.md) for:
- Complete API documentation
- PowerShell test scripts
- Troubleshooting guide
- Security notes

## Quick Test

```powershell
# Set admin token
$ADMIN_TOKEN = "your-jwt-token"

# Test ping
curl.exe http://localhost:3000/api/v1/admin/ping `
  -H "Authorization: Bearer $ADMIN_TOKEN"

# List companies
curl.exe http://localhost:3000/api/v1/admin/companies `
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
