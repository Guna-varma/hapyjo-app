-- Run this in Supabase SQL Editor to add the 7-day prune function (or use: supabase db push)
-- Then the app will call prune_old_gps_photos() when the GPS camera screen opens.

CREATE OR REPLACE FUNCTION public.prune_old_gps_photos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.gps_photos
    WHERE captured_at < (now() - interval '7 days')
    RETURNING id
  )
  SELECT count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prune_old_gps_photos() TO authenticated;
