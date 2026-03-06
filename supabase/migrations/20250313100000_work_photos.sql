-- Work Progress Photos: only Surveyor and Assistant Supervisor can capture; lightweight for field use

CREATE TABLE IF NOT EXISTS public.work_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text NOT NULL,
  thumbnail_url text NOT NULL,
  latitude numeric(10,6) NOT NULL,
  longitude numeric(10,6) NOT NULL,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  project_id text,
  uploaded_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_work_photos_site_id ON public.work_photos(site_id);
CREATE INDEX IF NOT EXISTS idx_work_photos_uploaded_by ON public.work_photos(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_work_photos_created_at ON public.work_photos(created_at DESC);

ALTER TABLE public.work_photos ENABLE ROW LEVEL SECURITY;

-- Surveyor: own photos only. Assistant Supervisor: photos for their assigned sites. Owner / Head Supervisor: all.
DROP POLICY IF EXISTS "work_photos_select_owner_head" ON public.work_photos;
CREATE POLICY "work_photos_select_owner_head"
  ON public.work_photos FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'head_supervisor', 'admin'));

DROP POLICY IF EXISTS "work_photos_select_asst_site" ON public.work_photos;
CREATE POLICY "work_photos_select_asst_site"
  ON public.work_photos FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor'
    AND EXISTS (SELECT 1 FROM public.site_assignments sa WHERE sa.site_id = work_photos.site_id AND sa.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "work_photos_select_surveyor_own" ON public.work_photos;
CREATE POLICY "work_photos_select_surveyor_own"
  ON public.work_photos FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'surveyor'
    AND uploaded_by = auth.uid()
  );

-- Insert: only surveyor and assistant_supervisor
DROP POLICY IF EXISTS "work_photos_insert_role" ON public.work_photos;
CREATE POLICY "work_photos_insert_role"
  ON public.work_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('surveyor', 'assistant_supervisor')
  );

-- Storage bucket work-photos (compressed ~50KB + thumbnails 10-20KB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('work-photos', 'work-photos', true, 524288, ARRAY['image/jpeg', 'image/jpg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "work_photos_upload" ON storage.objects;
CREATE POLICY "work_photos_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'work-photos' AND (storage.foldername(name))[1] = 'work');

DROP POLICY IF EXISTS "work_photos_read" ON storage.objects;
CREATE POLICY "work_photos_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'work-photos');
