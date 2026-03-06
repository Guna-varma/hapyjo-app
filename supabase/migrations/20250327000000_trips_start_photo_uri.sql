-- Lightweight trip proof: store start photo separately so end trip does not overwrite it.
-- photo_uri = end trip photo only; start_photo_uri = start trip photo.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS start_photo_uri text;

COMMENT ON COLUMN public.trips.start_photo_uri IS 'URL of start trip proof photo (speedometer). End proof in photo_uri.';
