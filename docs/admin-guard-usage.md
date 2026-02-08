# Admin Guard Usage Guide

## Overview

The `AdminGuard` enforces admin-only access for protected endpoints by checking if a user has the `admin` role in the database.

## Setup

### 1. Deploy the SQL Function

First, deploy the `is_admin` RPC function to your Supabase database:

```bash
psql $DATABASE_URL < kargogig-backend/sql/is_admin_rpc.sql
```

Or via Supabase SQL Editor:
- Go to Supabase Dashboard → SQL Editor
- Paste the contents of `sql/is_admin_rpc.sql`
- Run the query

### 2. Ensure Database Schema

The `is_admin` function requires these tables:

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

-- Insert admin role
INSERT INTO public.roles (name) VALUES ('admin') ON CONFLICT (name) DO NOTHING;
```

### 3. Assign Admin Role to a User

```sql
-- Get the admin role ID
SELECT id FROM public.roles WHERE name = 'admin';

-- Assign admin role to a user
INSERT INTO public.user_role_assignments (user_id, role_id)
VALUES ('user-uuid-here', (SELECT id FROM public.roles WHERE name = 'admin'))
ON CONFLICT DO NOTHING;
```

## Usage Examples

### Basic Usage

```typescript
import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards';

@Controller('admin')
export class AdminController {
  
  @UseGuards(AdminGuard)
  @Post('users')
  async createUser() {
    // Only admins can access this endpoint
    return { message: 'User created' };
  }
}
```

### With JWT Authentication

For production use, combine with JWT authentication middleware:

```typescript
import { Controller, Post, UseGuards, Req } from '@nestjs/common';
import { AdminGuard } from '../common/guards';

@Controller('admin')
export class AdminController {
  
  // NOTE: Ensure req.user is populated by JWT middleware first
  // The AdminGuard expects req.user.id or req.user.sub to be present
  @UseGuards(AdminGuard)
  @Post('sensitive-operation')
  async performSensitiveOperation(@Req() req: any) {
    const adminUserId = req.user.id;
    
    // Perform admin-only operation
    return { ok: true, performedBy: adminUserId };
  }
}
```

### Controller-Level Guard

Apply to all routes in a controller:

```typescript
import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../common/guards';

@Controller('admin')
@UseGuards(AdminGuard)  // All routes require admin
export class AdminController {
  
  @Get('dashboard')
  async getDashboard() {
    return { message: 'Admin dashboard' };
  }
  
  @Post('settings')
  async updateSettings() {
    return { message: 'Settings updated' };
  }
}
```

## Authentication Flow

```
Request with JWT → req.user.id (populated by JWT middleware)
                 ↓
              AdminGuard checks req.user.id
                 ↓
         Database query: is_admin(user_id)
                 ↓
        ┌────────┴────────┐
        ↓                 ↓
    is_admin=true    is_admin=false
        ↓                 ↓
   Allow (200)     Forbidden (403)
```

## Error Responses

### 401 Unauthorized
When JWT token is missing or invalid:

```json
{
  "ok": false,
  "error": "unauthorized",
  "message": "Authentication required"
}
```

### 403 Forbidden
When user is authenticated but not an admin:

```json
{
  "ok": false,
  "error": "forbidden",
  "message": "Admin access required"
}
```

### 500 Internal Server Error
When database check fails:

```json
{
  "ok": false,
  "error": "admin_check_failed",
  "message": "Failed to verify admin status"
}
```

## Testing

### Manual Test with cURL

```bash
# Get JWT token first (via your auth endpoint)
TOKEN="your-jwt-token-here"

# Try accessing admin endpoint
curl -X POST http://localhost:3000/api/v1/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### E2E Test Example

```typescript
describe('Admin Guard (e2e)', () => {
  let app: INestApplication;
  let adminUserId: string;
  let adminToken: string;
  let regularUserId: string;
  let regularToken: string;

  beforeAll(async () => {
    // Setup app...
    
    // Create admin user and assign role
    const { data: admin } = await supabase.auth.admin.createUser({
      email: 'admin@test.com',
      password: 'password123',
    });
    adminUserId = admin.user.id;
    
    await supabase
      .from('user_role_assignments')
      .insert({
        user_id: adminUserId,
        role_id: (await supabase.from('roles').select('id').eq('name', 'admin').single()).data.id
      });
    
    // Get admin token
    const { data: adminAuth } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'password123',
    });
    adminToken = adminAuth.session.access_token;
    
    // Create regular user (no admin role)
    const { data: regular } = await supabase.auth.admin.createUser({
      email: 'user@test.com',
      password: 'password123',
    });
    regularUserId = regular.user.id;
    
    const { data: regularAuth } = await supabase.auth.signInWithPassword({
      email: 'user@test.com',
      password: 'password123',
    });
    regularToken = regularAuth.session.access_token;
  });

  it('allows admin access', () => {
    return request(app.getHttpServer())
      .post('/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
  });

  it('blocks non-admin access', () => {
    return request(app.getHttpServer())
      .post('/admin/users')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);
  });

  it('blocks unauthenticated access', () => {
    return request(app.getHttpServer())
      .post('/admin/users')
      .expect(401);
  });
});
```

## Requirements Checklist

Before using `AdminGuard`, ensure:

- ✅ `is_admin` RPC function is deployed to database
- ✅ `roles` and `user_role_assignments` tables exist
- ✅ Admin role exists in `roles` table
- ✅ JWT middleware populates `req.user.id` or `req.user.sub`
- ✅ Admin users have been assigned the admin role
- ✅ `SupabaseModule` is imported in your module

## Troubleshooting

### "is_admin is not a function"
Deploy the SQL function: `psql $DATABASE_URL < sql/is_admin_rpc.sql`

### "unauthorized" error but token is valid
Check that your JWT middleware is populating `req.user.id` or `req.user.sub`

### "forbidden" error for admin user
Verify the user has the admin role:
```sql
SELECT * FROM user_role_assignments ura
JOIN roles r ON r.id = ura.role_id
WHERE ura.user_id = 'user-uuid-here' AND r.name = 'admin';
```

### "admin_check_failed" error
Check Supabase logs and ensure the database connection is working.

## Security Notes

- The `is_admin` RPC function uses `SECURITY DEFINER` to check roles regardless of RLS policies
- Always use this guard **after** JWT authentication is verified
- Admin status is checked on **every request** (no caching)
- The guard logs errors to help with debugging but doesn't expose sensitive details to clients
