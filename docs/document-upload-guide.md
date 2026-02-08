# Document Upload System - Quick Test Guide

## 📋 Overview

This document management system implements a secure file upload flow:

1. **Client** requests a signed upload URL from backend
2. **Client** uploads file directly to Supabase Storage using the signed URL
3. **Client** notifies backend about the completed upload
4. **Backend** creates a document record in the database

## 🏗️ Architecture

### Path Convention

```
{ownerType}/{ownerId}/{documentType}/{uuid}.{ext}

Examples:
- company/1111/tax_certificate/6f2a8b3c-...pdf
- driver/5555/drivers_license/8a9b2c1d-...jpg
- vehicle/9999/insurance/3c4d5e6f-...pdf
```

### Key Components

- **StorageProvider**: Manages Supabase Storage operations (path generation, signed URLs)
- **DocumentsRepository**: Database operations for documents table
- **DocumentsService**: Business logic layer
- **DocumentsController**: API endpoints

## 🚀 Quick Start

### 1. Run Database Migration

```bash
# Apply the documents migration to your Supabase database
psql $DATABASE_URL -f sql/day3_documents_migration.sql
```

Or via Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `sql/day3_documents_migration.sql`
3. Run the migration

### 2. Environment Variables

Make sure your `.env` file has:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Start the Backend

```bash
cd kargogig-backend
npm install
npm run start:dev
```

## 🧪 Testing

### Option A: Manual API Test (curl)

```bash
# Step 1: Get upload URL
curl -X POST http://localhost:3000/documents/upload-url \
  -H "Content-Type: application/json" \
  -d '{
    "ownerType": "company",
    "ownerId": 1111,
    "documentType": "tax_certificate",
    "ext": "pdf"
  }'

# Response:
# {
#   "ok": true,
#   "path": "company/1111/tax_certificate/6f2a8b3c-...pdf",
#   "signed_url": "https://...supabase.co/storage/v1/object/upload/..."
# }

# Step 2: Upload file (client does this)
curl -X PUT "SIGNED_URL_FROM_STEP_1" \
  -H "Content-Type: application/pdf" \
  --data-binary @/path/to/your/file.pdf

# Step 3: Create document record
curl -X POST http://localhost:3000/documents \
  -H "Content-Type: application/json" \
  -d '{
    "owner_type": "company",
    "owner_id": 1111,
    "document_type": "tax_certificate",
    "file_url": "company/1111/tax_certificate/6f2a8b3c-...pdf",
    "expires_at": "2027-01-01"
  }'

# Response:
# {
#   "id": 1,
#   "owner_type": "company",
#   "owner_id": 1111,
#   "document_type": "tax_certificate",
#   "file_url": "company/1111/tax_certificate/6f2a8b3c-...pdf",
#   "status": "pending",
#   "expires_at": "2027-01-01T00:00:00.000Z",
#   "created_at": "2026-02-08T...",
#   "updated_at": "2026-02-08T..."
# }
```

### Option B: Automated Test Script

```bash
# Run the test script
npx ts-node scripts/test-document-upload.ts
```

Expected output:
```
🚀 Starting document upload test...

📝 Step 1: Request signed upload URL
   Owner: company/1111
   Document Type: tax_certificate
   Extension: pdf

✅ Upload URL Response:
   path: company/1111/tax_certificate/6f2a8b3c-1234-5678-90ab-cdef12345678.pdf
   signed_url: https://abc.supabase.co/storage/v1/object/upload/sign...

   ✓ Path format correct: true

📤 Step 2: Client uploads file to signed_url (skipped in test)

💾 Step 3: Create document record in DB
   file_url: company/1111/tax_certificate/6f2a8b3c-1234-5678-90ab-cdef12345678.pdf

✅ Document Record Created:
   id: 1
   owner_type: company
   owner_id: 1111
   document_type: tax_certificate
   file_url: company/1111/tax_certificate/6f2a8b3c-1234-5678-90ab-cdef12345678.pdf
   status: pending
   expires_at: 2027-01-01

✅ SUCCESS: file_url matches the generated path!
```

### Option C: E2E Tests

```bash
# Run the E2E test suite
npm run test:e2e -- documents-upload.e2e-spec.ts
```

## ✅ Verification Checklist

After running tests, verify:

### 1. Storage Bucket
- Go to Supabase Dashboard → Storage → `documents` bucket
- Should see file at: `company/1111/tax_certificate/xxxx.pdf`

### 2. Database Record
```sql
SELECT * FROM documents WHERE owner_type = 'company' AND owner_id = 1111;
```

Should return:
- `file_url` = `company/1111/tax_certificate/xxxx.pdf` (storage path, NOT public URL)
- `status` = `pending`
- `owner_type` = `company`
- `owner_id` = `1111`
- `document_type` = `tax_certificate`

### 3. Path Format
The path should match the pattern:
```
{ownerType}/{ownerId}/{documentType}/{uuid}.{ext}
```

✅ **Correct**: `company/1111/tax_certificate/6f2a8b3c-...pdf`  
❌ **Wrong**: `https://...supabase.co/storage/v1/object/public/...`

## 📁 File Structure

```
kargogig-backend/
├── sql/
│   └── day3_documents_migration.sql        # Database migration
├── src/
│   └── documents/
│       ├── dto/
│       │   ├── create-upload-url.dto.ts    # Upload URL request DTO
│       │   ├── create-document.dto.ts      # Document creation DTO
│       │   └── index.ts                    # DTO exports
│       ├── documents.controller.ts          # API endpoints
│       ├── documents.service.ts             # Business logic
│       ├── documents.repository.ts          # Database operations
│       ├── documents.module.ts              # NestJS module
│       └── storage.provider.ts              # Supabase Storage wrapper
├── scripts/
│   └── test-document-upload.ts              # Manual test script
└── test/
    └── documents-upload.e2e-spec.ts         # E2E tests
```

## 🔍 Common Issues

### Issue: "Bucket 'documents' not found"
**Solution**: Run the migration to create the bucket, or create it manually via Supabase Dashboard.

### Issue: "file_url contains full URL instead of path"
**Solution**: Use just the path from `createUploadUrl()` response, not the signed URL.

Example:
```typescript
// ✅ Correct
file_url: "company/1111/tax_certificate/abc-123.pdf"

// ❌ Wrong
file_url: "https://...supabase.co/storage/v1/object/upload/sign/documents/..."
```

### Issue: "Row violates unique constraint"
**Solution**: The same `owner_type + owner_id + document_type` already exists. This is intentional to prevent duplicates. To re-upload, you can delete the old record first.

## 🎯 Next Steps

1. ✅ Upload URL endpoint works
2. ✅ Document creation works
3. ✅ Path format is correct
4. ⏭️ Add verify/reject endpoints (admin)
5. ⏭️ Add document listing endpoint
6. ⏭️ Add RLS policies for multi-tenant access
