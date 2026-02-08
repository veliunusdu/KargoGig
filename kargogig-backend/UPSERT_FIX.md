# 🔧 UPSERT Fix Applied

## ✅ What Was Fixed

Changed `documents.repository.ts` from **INSERT** to **UPSERT** logic.

## 🔄 Before vs After

### Before (INSERT - would fail on duplicate)
```typescript
async create(dto: CreateDocumentDto): Promise<DocumentRow> {
  const { data, error } = await this.supabase
    .from('documents')
    .insert({
      owner_type: dto.owner_type,
      owner_id: dto.owner_id,
      document_type: dto.document_type,
      file_url: dto.file_url,
      status: 'pending',
      expires_at: dto.expires_at || null,
    })
    .select('*')
    .single();
  // ...
}
```

**Problem:** If `company/1111/tax_certificate` already exists, would throw unique constraint error.

### After (UPSERT - updates existing record)
```typescript
async create(dto: CreateDocumentDto): Promise<DocumentRow> {
  const payload = {
    owner_type: dto.owner_type,
    owner_id: dto.owner_id,
    document_type: dto.document_type,
    file_url: dto.file_url,           // ← New path
    status: 'pending',                 // ← Reset to pending
    expires_at: dto.expires_at || null,
    verified_by: null,                 // ← Clear verification
    verified_at: null,                 // ← Clear verification
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await this.supabase
    .from('documents')
    .upsert(payload, { 
      onConflict: 'owner_type,owner_id,document_type'  // ← Key point!
    })
    .select('*')
    .single();
  // ...
}
```

**Solution:** If `company/1111/tax_certificate` exists, updates the existing record with:
- New `file_url` (new path)
- Reset `status` to `pending`
- Clear `verified_by` and `verified_at` (needs re-verification)

## 🎯 Why This Matters

### Scenario: Re-upload Document

**User Flow:**
1. Company uploads `tax_certificate.pdf` → status: `pending`
2. Admin verifies it → status: `verified`, verified_by: `admin@example.com`
3. Company uploads NEW `tax_certificate.pdf` (updated document)
   - **OLD behavior:** ❌ Would fail with "unique constraint violation"
   - **NEW behavior:** ✅ Updates existing record, resets to `pending` for re-verification

### Database Behavior

**Unique Constraint:**
```sql
UNIQUE (owner_type, owner_id, document_type)
```

This means: **One company can only have ONE tax_certificate at a time.**

When re-uploading:
- Same `id` is kept
- `file_url` points to new file
- Status resets to `pending` (admin must re-verify)
- Old verification data is cleared

## ✅ Updated Interface

Added `meta` field to `DocumentRow`:

```typescript
export interface DocumentRow {
  id: number;
  owner_type: string;
  owner_id: number;
  document_type: string;
  file_url: string;
  status: string;
  expires_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  meta: Record<string, any>;  // ← NEW: For rejection reasons, etc.
  created_at: string;
  updated_at: string;
}
```

## 🧪 Testing UPSERT

**Run test script:**
```powershell
.\scripts\test-upsert.ps1
```

**Expected behavior:**
1. First upload → creates new record (ID: 1)
2. Second upload → updates same record (ID: still 1)
   - `file_url` changes to new path
   - `status` resets to `pending`
   - `verified_by` and `verified_at` become `null`

## 📊 Example

```json
// First upload
POST /documents
{
  "owner_type": "company",
  "owner_id": 1111,
  "document_type": "tax_certificate",
  "file_url": "company/1111/tax_certificate/abc-111.pdf"
}

Response: { "id": 1, "status": "pending", ... }

// Admin verifies
POST /documents/1/verify
Response: { "id": 1, "status": "verified", "verified_by": "admin", ... }

// Company re-uploads (new file)
POST /documents
{
  "owner_type": "company",
  "owner_id": 1111,
  "document_type": "tax_certificate",
  "file_url": "company/1111/tax_certificate/xyz-222.pdf"  // ← NEW path
}

Response: { 
  "id": 1,                    // ← SAME ID (updated, not inserted)
  "status": "pending",        // ← Reset to pending
  "verified_by": null,        // ← Cleared
  "verified_at": null,        // ← Cleared
  "file_url": "company/1111/tax_certificate/xyz-222.pdf"
}
```

## ✅ Key Points

1. **onConflict** uses DB column names: `owner_type,owner_id,document_type`
2. **`.select('*').single()`** ensures `data` is returned (otherwise might be `null`)
3. **verified_by/verified_at** reset to `null` when re-uploading
4. **status** always resets to `pending` on re-upload
5. **Same ID** preserved → clean audit trail in DB

---

**Status: ✅ Ready to test**

Start backend and run `.\scripts\test-upsert.ps1` to verify!
