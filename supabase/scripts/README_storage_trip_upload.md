# Allow trip start/end photo uploads (issue-images bucket)

Drivers get **"Upload failed: new row violates row-level security policy"** because the storage policy for `issue-images` only allowed paths starting with `issue/`. Trip photos use `trip/<assignedTripId>/...`.

## Option 1: SQL Editor (if you have owner rights)

1. Open **Supabase Dashboard** → **SQL Editor**.
2. Open `supabase/scripts/storage_issue_images_allow_trip_upload.sql`, copy its contents, paste into the editor, and **Run**.

If you see **"must be owner of relation objects"**, use Option 2.

## Option 2: Dashboard Storage policies

1. Go to **Storage** → **Policies** (or **Buckets** → **issue-images** → **Policies**).
2. Find the policy that allows **INSERT** on `issue-images` (e.g. "Authenticated upload issue-images").
3. **Edit** that policy.
4. Change the **WITH CHECK** expression from first folder = `issue` only to allow **both** `issue` and `trip`:
   - If using the expression builder: add a condition so the first path segment is either `issue` or `trip`.
   - Raw SQL equivalent: `bucket_id = 'issue-images' AND (storage.foldername(name))[1] IN ('issue', 'trip')`.
5. Save.

After applying either option, trip start/end photo uploads should work for drivers/operators.
