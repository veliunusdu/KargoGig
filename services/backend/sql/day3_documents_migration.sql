-- ============================================================
-- Day 3 Extended: Document Management System — DB Migration
-- ============================================================

-- 1) Ensure documents table exists with all required columns
CREATE TABLE IF NOT EXISTS public.documents (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_type     text NOT NULL,   -- 'company', 'driver', 'vehicle'
  owner_id       bigint NOT NULL,
  document_type  text NOT NULL,   -- 'tax_certificate', 'drivers_license', etc.
  file_url       text NOT NULL,   -- storage path: 'company/1111/tax_certificate/uuid.pdf'
  status         text NOT NULL DEFAULT 'pending',  -- 'pending', 'verified', 'rejected'
  expires_at     timestamptz,
  verified_by    text,
  verified_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 2) Add 'meta' column for storing rejection reasons and other metadata
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'meta'
  ) THEN
    ALTER TABLE public.documents ADD COLUMN meta jsonb DEFAULT '{}'::jsonb;
  END IF;
END
$$;

-- 3) Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_documents_owner 
  ON public.documents(owner_type, owner_id);

CREATE INDEX IF NOT EXISTS idx_documents_status 
  ON public.documents(status);

CREATE INDEX IF NOT EXISTS idx_documents_created_at 
  ON public.documents(created_at DESC);

-- 4) Unique constraint to prevent duplicate document types per owner
--    (allows re-upload by doing ON CONFLICT UPDATE)
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_owner_doctype 
  ON public.documents(owner_type, owner_id, document_type);

-- 5) Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON public.documents 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6) Create storage bucket (Note: This is typically done via Supabase Dashboard or Storage API)
--    For reference, you can create it via SQL like this:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,  -- private bucket, access via signed URLs only
  10485760,  -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 7) Enable RLS on storage.objects for documents bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage policy: only service role can upload/download
-- (backend handles access control via signed URLs)
DROP POLICY IF EXISTS "service_role_documents_access" ON storage.objects;
CREATE POLICY "service_role_documents_access" ON storage.objects
  FOR ALL
  USING (bucket_id = 'documents' AND auth.role() = 'service_role')
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'service_role');

-- 8) Enable RLS on documents table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Note: Detailed RLS policies can be added in a separate migration if needed
-- For now, we'll allow service role full access (backend uses service role key)

DROP POLICY IF EXISTS "service_role_documents_full_access" ON public.documents;
CREATE POLICY "service_role_documents_full_access" ON public.documents
  FOR ALL
  USING (true)  -- Service role bypasses RLS anyway, but good to be explicit
  WITH CHECK (true);

-- ============================================================
-- Migration complete!
-- ============================================================
