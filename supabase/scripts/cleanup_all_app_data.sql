-- =============================================================================
-- OPTIONAL: Remove ALL application data (full reset) – keep auth only
-- Run this in the Supabase Dashboard → SQL Editor only if you want a blank DB.
-- This deletes every row from app tables. Auth users (auth.users + profiles)
-- remain so users can still log in; all sites, vehicles, trips, etc. are gone.
-- =============================================================================

-- Child tables first (depend on notifications, trips, etc.)
DELETE FROM public.notifications;
DELETE FROM public.push_tokens;

DELETE FROM public.expenses;
DELETE FROM public.trips;
DELETE FROM public.machine_sessions;
DELETE FROM public.reports;
DELETE FROM public.surveys;
DELETE FROM public.issues;
DELETE FROM public.tasks;
DELETE FROM public.operations;
DELETE FROM public.site_assignments;
DELETE FROM public.driver_vehicle_assignments;

DELETE FROM public.vehicles;
DELETE FROM public.sites;

-- Profiles and auth.users are NOT deleted – users can still sign in.
-- To remove specific users, use Supabase Dashboard → Authentication → Users.
