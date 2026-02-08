# Backend Reorganization - Quick Reference

## 🎯 Goal

Transform flat module structure into organized `src/modules/` structure with proper common utilities and configuration.

## 📋 Quick Start

```powershell
# From project root
cd services\backend

# Run reorganization script
.\reorganize-backend.ps1

# Verify structure
tree src /F /A
```

## ✅ What Gets Created/Updated

### Created:
- `src/config/` - Environment configuration with Zod
- `src/common/constants/` - App constants
- `src/common/decorators/` - Custom decorators
- `src/common/filters/` - Exception filters
- `src/common/interceptors/` - Request/response interceptors
- `src/common/middleware/` - Express middleware
- `src/common/pipes/` - Validation pipes
- `src/common/types/` - Shared TypeScript types
- `src/modules/` - All feature modules moved here
- `sql/migrations/`, `sql/rpcs/`, `sql/triggers/`, `sql/debug/` - Organized SQL

### Updated:
- `tsconfig.json` - Path aliases added

### Moved:
- All modules → `src/modules/`
- SQL files → Organized subdirectories

## 🔧 After Running Script

1. **Update app.module.ts imports:**
   ```typescript
   // Old: import { RidesModule } from './rides/rides.module';
   // New: import { RidesModule } from './modules/rides/rides.module';
   ```

2. **Use path aliases (optional but recommended):**
   ```typescript
   import { config } from '@config';
   import { Public, Roles } from '@common';
   import { RidesService } from '@modules/rides/rides.service';
   ```

3. **Test everything:**
   ```bash
   npm run build
   npm run start:dev
   npm run test:e2e
   ```

## 📝 Manual Steps (if needed)

If automatic reorganization fails, manually:

1. Create `src/modules/` folder
2. Move these folders into it:
   - admin, customers, drivers, companies, vehicles
   - rides, offers, payments, refunds, shipments
   - notifications, maps, matching, health
   - observability

3. Keep these at `src/` level:
   - supabase/
   - main.ts, app.module.ts

4. Update all imports in `app.module.ts`

## 🆘 Troubleshooting

**Problem:** Import errors after reorganization

**Solution:**
```bash
rm -rf dist/
npm run build
```

**Problem:** Can't find moved modules

**Solution:** Check `tsconfig.json` has the path aliases from the guide

**Problem:** SQL files in wrong folders

**Solution:** Check `sql/migrations/`, `sql/rpcs/`, `sql/triggers/` exist and files are moved correctly

## 📚 Full Guide

See [BACKEND-REORGANIZATION.md](./BACKEND-REORGANIZATION.md) for complete details.
