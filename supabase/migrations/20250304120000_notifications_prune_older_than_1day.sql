-- =============================================================================
-- Notifications: prune older than 1 day to avoid storage growth.
-- Run prune_notifications_older_than_1day() daily (e.g. via pg_cron or Supabase cron).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.prune_notifications_older_than_1day()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH deleted AS (
    DELETE FROM public.notifications
    WHERE created_at < (now() - interval '1 day')
    RETURNING id
  )
  SELECT count(*)::integer INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.prune_notifications_older_than_1day() IS 'Deletes notifications older than 1 day. Run daily to keep storage small (e.g. pg_cron: SELECT cron.schedule(''0 2 * * *'', ''SELECT public.prune_notifications_older_than_1day()'');).';
