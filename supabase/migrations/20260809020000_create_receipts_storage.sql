-- Receipt OCR Storage — bucket + RLS policies
--
-- Creates a dedicated, public `receipts` bucket so the ai-receipt-ocr edge
-- function can fetch uploaded images by public URL (it cannot read
-- device-local URIs). Access to the bucket is scoped to authenticated users
-- via storage.objects RLS policies keyed on auth.uid()::text = owner_id.
--
-- Idempotent — safe to run multiple times.

-- 1. Create the bucket (public, image types only, 10 MB cap).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  10485760, -- 10 MiB
  ARRAY['image/png', 'image/jpeg', 'image/heic', 'image/heif', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS policies — authenticated users manage only their own objects.
DROP POLICY IF EXISTS "Receipts: authenticated insert" ON storage.objects;
CREATE POLICY "Receipts: authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Receipts: users read own" ON storage.objects;
CREATE POLICY "Receipts: users read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "Receipts: users update own" ON storage.objects;
CREATE POLICY "Receipts: users update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Receipts: users delete own" ON storage.objects;
CREATE POLICY "Receipts: users delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND owner_id = auth.uid()::text);

-- 3. Grant storage API roles access (matching the existing grant pattern).
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
