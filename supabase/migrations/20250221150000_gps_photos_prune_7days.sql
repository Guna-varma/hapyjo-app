-- =============================================================================
-- Auto-delete GPS photos older than 7 days (run via cron or call from app).
-- =============================================================================

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

COMMENT ON FUNCTION public.prune_old_gps_photos() IS
  'Deletes gps_photos rows older than 7 days. Call from app on GPS camera open or schedule with pg_cron.';

GRANT EXECUTE ON FUNCTION public.prune_old_gps_photos() TO authenticated;
