-- Run this in Supabase Dashboard → SQL Editor (as the project owner / postgres).
-- This allows trip start/end photos (path trip/<id>/...) in the issue-images bucket.
-- Without it, drivers get: "Upload failed: new row violates row-level security policy"

DROP POLICY IF EXISTS "Authenticated upload issue-images" ON storage.objects;
CREATE POLICY "Authenticated upload issue-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'issue-images'
    AND (storage.foldername(name))[1] IN ('issue', 'trip')
  );
