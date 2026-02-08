# KargoGig Monorepo

Full-stack logistics platform with multiple frontend apps and shared backend.

## 📁 Structure

```
KargoGig/
├─ apps/
│  ├─ customer-web/          # Customer booking app (Next.js) - :3001
│  ├─ company-dashboard/     # Company fleet management (Next.js) - :3002
│  └─ admin-panel/           # Platform admin (Next.js) - :3003
├─ packages/
│  ├─ ui/                    # Shared React components
│  ├─ api-client/            # Typed API client
│  ├─ types/                 # Shared TypeScript types & Zod schemas
│  └─ auth/                  # Supabase auth helpers
├─ services/
│  └─ backend/               # NestJS API server
├─ infra/                    # Infrastructure configs
├─ docs/                     # Documentation
└─ tooling/                  # Dev tools & scripts
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install all dependencies for all apps and packages in the monorepo.

### 2. Environment Setup

Each app needs its own `.env.local`:

```bash
# Customer Web
cp apps/customer-web/.env.local.example apps/customer-web/.env.local

# Company Dashboard
cp apps/company-dashboard/.env.local.example apps/company-dashboard/.env.local

# Admin Panel
cp apps/admin-panel/.env.local.example apps/admin-panel/.env.local
```

Then edit each `.env.local` with your Supabase credentials.

### 3. Run Apps

**Run all apps in parallel:**
```bash
npm run dev
```

**Run specific apps:**
```bash
npm run dev:customer      # Customer web on :3001
npm run dev:company       # Company dashboard on :3002
npm run dev:admin         # Admin panel on :3003
npm run dev:backend       # NestJS backend
```

## 📦 Packages

### @kargogig/types
Shared TypeScript types and Zod validation schemas.

```typescript
import { Ride, CreateRideSchema } from '@kargogig/types';
```

### @kargogig/auth
Supabase authentication helpers for Next.js.

```typescript
import { createSupabaseBrowser, createSupabaseServer } from '@kargogig/auth';
```

### @kargogig/api-client
Type-safe API client for backend communication.

```typescript
import { createApiClient } from '@kargogig/api-client';
```

### @kargogig/ui
Shared React UI components.

```typescript
import { Button, Input, Card } from '@kargogig/ui';
```

## 🏗️ Development

### Adding New Dependencies

**To workspace root:**
```bash
npm install -D <package>
```

**To specific app:**
```bash
npm install <package> -w customer-web
```

**To specific package:**
```bash
npm install <package> -w @kargogig/types
```

### Building All Apps

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## 🌐 Port Assignments

- **3001** - Customer Web App
- **3002** - Company Dashboard
- **3003** - Admin Panel
- **3000** - Backend API (NestJS)

## 📝 Notes

- All apps share the same `node_modules` at the root level
- Packages use `"*"` version for internal dependencies (resolved via workspace)
- Each app is independently deployable
- TypeScript paths are configured to resolve package imports

## 🔗 Supabase Configuration

Make sure to configure redirect URLs in Supabase Dashboard:

**Site URLs:**
- `http://localhost:3001` (customer-web)
- `http://localhost:3002` (company-dashboard)
- `http://localhost:3003` (admin-panel)

**Redirect URLs:**
- `http://localhost:3001/auth/callback`
- `http://localhost:3002/auth/callback`
- `http://localhost:3003/auth/callback`

A delivery project
