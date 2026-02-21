-- =============================================================================
-- GPS Photos table + Storage bucket for driver geo-tagged camera captures
-- Run via: supabase db push (or SQL Editor)
-- =============================================================================

-- Table: gps_photos (stores merged camera + GPS overlay image records)
CREATE TABLE IF NOT EXISTS public.gps_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  latitude numeric(10,6) NOT NULL,
  longitude numeric(10,6) NOT NULL,
  address text,
  city text,
  region text,
  country text,
  postal_code text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gps_photos_user_id ON public.gps_photos(user_id);
CREATE INDEX IF NOT EXISTS idx_gps_photos_captured_at ON public.gps_photos(captured_at DESC);

ALTER TABLE public.gps_photos ENABLE ROW LEVEL SECURITY;

-- Users can read their own GPS photos; drivers and assistant_supervisor can insert
CREATE POLICY "Users can read own gps_photos"
  ON public.gps_photos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated insert gps_photos"
  ON public.gps_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Optional: allow head_supervisor, owner, admin to read all
CREATE POLICY "Managers can read all gps_photos"
  ON public.gps_photos FOR SELECT
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor')
  );

-- Storage bucket gps-images (create in Dashboard > Storage > New bucket if this fails)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('gps-images', 'gps-images', true, 5242880, ARRAY['image/jpeg','image/jpg'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated upload gps-images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'gps-images' AND (storage.foldername(name))[1] = 'gps');

CREATE POLICY "Public read gps-images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'gps-images');
