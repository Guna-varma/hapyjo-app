-- =============================================================================
-- Run this in Supabase Dashboard → SQL Editor to verify vehicles table and sync.
-- Project: dobfzbdwyimicxzcssiw (from EXPO_PUBLIC_SUPABASE_URL)
-- =============================================================================

-- 1) Check vehicles table structure (site_id must be nullable for "Free (no site)")
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vehicles'
ORDER BY ordinal_position;

-- 2) If site_id is still NOT NULL, run this to fix (same as migration 20250226130000):
-- ALTER TABLE public.vehicles ALTER COLUMN site_id DROP NOT NULL;
-- COMMENT ON COLUMN public.vehicles.site_id IS 'Optional. NULL = free vehicle (not assigned to a site).';

-- 3) Check RLS policies on vehicles (need "Admin owner head_supervisor write vehicles" for INSERT)
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'vehicles';

-- 4) Check current_user_role() exists (used by RLS)
SELECT proname FROM pg_proc WHERE proname = 'current_user_role';

-- 5) Check sync trigger exists (public.vehicles -> umugwaneza)
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgrelid = 'public.vehicles'::regclass;

-- 6) Optional: list existing vehicles (first 5)
-- SELECT id, site_id, type, vehicle_number_or_id, tank_capacity_litre, fuel_balance_litre, status FROM public.vehicles LIMIT 5;
