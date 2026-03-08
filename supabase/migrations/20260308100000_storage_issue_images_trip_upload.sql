-- Trip start/end photo upload uses issue-images bucket with path prefix "trip/".
-- Storage RLS is owned by Supabase storage admin; migrations cannot alter it here.
-- Run the SQL in: supabase/scripts/storage_issue_images_allow_trip_upload.sql
-- via Dashboard → SQL Editor (run as project owner) to allow trip/ uploads.

SELECT 1;
