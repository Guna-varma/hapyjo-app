-- =============================================================================
-- Auto-delete work progress photos older than 7 days.
-- Run periodically via pg_cron or call from app/edge function.
-- Storage objects in bucket work-photos are not deleted here; optional cleanup
-- can be done by an edge function that lists and removes files for deleted rows.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prune_old_work_photos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.work_photos
    WHERE created_at < (now() - interval '7 days')
    RETURNING id
  )
  SELECT count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.prune_old_work_photos() IS
  'Deletes work_photos rows older than 7 days. Schedule with pg_cron (e.g. daily) or call from app/edge.';

GRANT EXECUTE ON FUNCTION public.prune_old_work_photos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.prune_old_work_photos() TO service_role;
