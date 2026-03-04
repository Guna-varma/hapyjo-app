-- Run in Supabase SQL Editor to delete all notifications older than 1 day.
-- For automatic daily reset, use the function in a scheduled job (see REMOVING_DUMMY_DATA.md or migration 20250304120000).
SELECT public.prune_notifications_older_than_1day() AS deleted_count;
