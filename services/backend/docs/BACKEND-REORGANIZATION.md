# Backend Structure Reorganization Guide

## 🎯 Overview

This guide explains the new organized backend structure and how to migrate from the old flat structure.

## 📁 New Structure

```
services/backend/
  src/
    main.ts
    app.module.ts
    
    config/                    ✅ NEW
      env.ts                   # Environment schema (Zod)
      configuration.ts         # Config loader
      index.ts
    
    common/                    ✅ ENHANCED
      constants/               # App-wide constants
      decorators/              # Custom decorators (@Public, @Roles)
      guards/                  # Auth guards
      filters/                 # Exception filters
      interceptors/            # Request/response interceptors
      middleware/              # Express middleware
      pipes/                   # Validation pipes (Zod)
      utils/                   # Utility functions
      types/                   # Shared TypeScript types
      index.ts
    
    supabase/                  ✅ STAYS HERE
      supabase.module.ts
      supabase.client.ts
      supabase.service.ts
    
    modules/                   ✅ NEW - All feature modules here
      auth/
        auth.module.ts
        auth.service.ts
        guards/
      
      customers/
        customers.module.ts
        customers.controller.ts
        customers.service.ts
        customers.repository.ts
        dto/
        types/
      
      drivers/
      companies/
      vehicles/
      rides/
      shipments/
      offers/
      payments/
        providers/             # Shopier, Stripe, Mock
      notifications/
        providers/             # Expo, Mock
      maps/
      matching/
      admin/
      observability/           # Moved here
        logger.ts
        analytics.ts
        http-logger.middleware.ts
        pino-logger.service.ts
      health/
  
  test/
    jest-e2e.json
    *.e2e-spec.ts
  
  sql/                         ✅ ORGANIZED
    migrations/                # Schema changes
      day3_shopier_migration.sql
      day4_analytics_events.sql
      day5_refunds_migration.sql
    rpcs/                      # Stored procedures
      admin_actions_rpc.sql
      verify_complete_ride_rpc.sql
    triggers/                  # Database triggers
      day5_offers_accept_trigger_fix.sql
    debug/                     # Debug queries
      debug_enum.sql
  
  scripts/
  docs/
```

## 🚀 Migration Steps

### Step 1: Backup Current State

```powershell
# Create a backup branch
git checkout -b backup-before-reorganization
git add .
git commit -m "Backup before backend reorganization"
git checkout -
```

### Step 2: Run Reorganization Script

```powershell
cd services\backend
.\reorganize-backend.ps1
```

This script will:
- Create `src/modules/` directory
- Move all feature modules to `src/modules/`
- Move `observability/` to `src/modules/observability/`
- Organize SQL files into subdirectories

### Step 3: Update app.module.ts

**Before:**
```typescript
import { CustomersModule } from './customers/customers.module';
import { DriversModule } from './drivers/drivers.module';
```

**After:**
```typescript
import { CustomersModule } from './modules/customers/customers.module';
import { DriversModule } from './modules/drivers/drivers.module';
```

### Step 4: Update Imports Across Files

Use VS Code's global search and replace:

**Find:** `from '\.\.\/(admin|customers|drivers|companies|vehicles|rides|offers|payments|notifications|maps|matching|health|observability)'`

**Replace:** `from '../modules/$1'`

Or use this PowerShell script:

```powershell
cd services\backend\src

# Update imports
$files = Get-ChildItem -Recurse -Filter "*.ts"
foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Update module imports
    $content = $content -replace "from './([a-z-]+)/", "from './modules/`$1/"
    $content = $content -replace "from '../([a-z-]+)/", "from '../modules/`$1/"
    
    Set-Content $file.FullName $content
}
```

### Step 5: Use New Config Module

**Before:**
```typescript
const supabaseUrl = process.env.SUPABASE_URL;
```

**After:**
```typescript
import { config } from './config';

const supabaseUrl = config.SUPABASE_URL; // Typed and validated!
```

### Step 6: Use Common Utilities

**Before:**
```typescript
// Scattered custom decorators and guards
```

**After:**
```typescript
import { Public, Roles, AllExceptionsFilter } from './common';

@Public()
@Roles('admin', 'driver')
export class MyController {}
```

### Step 7: Test Everything

```powershell
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Start dev server
npm run start:dev
```

## 📝 What Changed?

### ✅ Added:
- **`src/config/`** - Centralized, typed, validated environment configuration
- **`src/modules/`** - All feature modules organized here
- **`src/common/constants/`** - App-wide constants
- **`src/common/decorators/`** - Custom decorators
- **`src/common/filters/`** - Exception filters
- **`src/common/interceptors/`** - Request/response interceptors
- **`src/common/middleware/`** - Express middleware
- **`src/common/pipes/`** - Validation pipes
- **`src/common/types/`** - Shared TypeScript types
- **`sql/migrations/`**, **`sql/rpcs/`**, **`sql/triggers/`**, **`sql/debug/`** - Organized SQL files

### 🔄 Moved:
- All feature modules → `src/modules/`
- `observability/` → `src/modules/observability/`
- SQL files → Organized into subdirectories

### ✨ Stays:
- `src/supabase/` - Core infrastructure, not a feature module
- `src/main.ts`, `src/app.module.ts` - Entry points

## 🎯 Benefits

1. **Clear Separation**: Config, common utilities, and feature modules are distinct
2. **Scalability**: Easy to add new modules without cluttering `src/`
3. **Type Safety**: Config validation with Zod
4. **Consistency**: All modules follow the same structure
5. **Organized SQL**: Easy to find migrations, RPCs, and triggers
6. **Better DX**: Auto-import suggestions work better with organized structure

## 🆘 Troubleshooting

### Import errors after reorganization?

```powershell
# Clear NestJS cache
rm -rf dist/
npm run build
```

### TypeScript can't find modules?

Check `tsconfig.json` paths:
```json
{
  "compilerOptions": {
    "paths": {
      "@common/*": ["src/common/*"],
      "@config/*": ["src/config/*"],
      "@modules/*": ["src/modules/*"]
    }
  }
}
```

## 📚 Next Steps

1. ✅ Run reorganization script
2. ✅ Update imports
3. ✅ Test everything
4. Consider adding:
   - Path aliases in `tsconfig.json`
   - Barrel exports in each module
   - API documentation (Swagger)
   - Integration tests for new structure
