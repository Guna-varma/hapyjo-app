-- Issue Reporting System: created_by_role, resolved_by, resolved_at; role-based insert/select; issue-images bucket

-- Add new columns to issues
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS created_by_role text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

COMMENT ON COLUMN public.issues.created_by_role IS 'Role of the user who created the issue (assistant_supervisor, driver_truck, driver_machine)';
COMMENT ON COLUMN public.issues.resolved_by IS 'Set when status = resolved; user who resolved';
COMMENT ON COLUMN public.issues.resolved_at IS 'Set when status = resolved';

-- Replace read policy: creator sees own; site-allocated Assistant Supervisor sees issues for their sites; Head Supervisor and Owner see all
DROP POLICY IF EXISTS "Authenticated read issues" ON public.issues;
DROP POLICY IF EXISTS "Issues read own or all if head/owner" ON public.issues;
DROP POLICY IF EXISTS "Issues read by creator or site or head/owner" ON public.issues;
CREATE POLICY "Issues read by creator or site or head/owner"
  ON public.issues FOR SELECT
  TO authenticated
  USING (
    auth.uid() = raised_by_id
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor'
      AND EXISTS (SELECT 1 FROM public.site_assignments sa WHERE sa.site_id = issues.site_id AND sa.user_id = auth.uid())
    )
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('head_supervisor', 'owner')
  );

-- Restrict insert to Assistant Supervisor, Driver, Operator only
DROP POLICY IF EXISTS "Raise issue" ON public.issues;
DROP POLICY IF EXISTS "Raise issue by allowed roles" ON public.issues;
CREATE POLICY "Raise issue by allowed roles"
  ON public.issues FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = raised_by_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('assistant_supervisor', 'driver_truck', 'driver_machine')
  );

-- Storage bucket for issue images (paths stored in issues.image_uris; deleted on resolve)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('issue-images', 'issue-images', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

-- Upload: authenticated users can insert under issue/ prefix (path = issue/<issueId>/...)
DROP POLICY IF EXISTS "Authenticated upload issue-images" ON storage.objects;
CREATE POLICY "Authenticated upload issue-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'issue-images' AND (storage.foldername(name))[1] = 'issue');

-- Read: authenticated can view (Head Supervisor / Owner see in app; creators see their own issue images)
DROP POLICY IF EXISTS "Authenticated read issue-images" ON storage.objects;
CREATE POLICY "Authenticated read issue-images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'issue-images');

-- Delete: only head_supervisor or owner (used when resolving an issue)
DROP POLICY IF EXISTS "Head supervisor owner delete issue-images" ON storage.objects;
CREATE POLICY "Head supervisor owner delete issue-images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'issue-images'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('head_supervisor', 'owner')
  );
