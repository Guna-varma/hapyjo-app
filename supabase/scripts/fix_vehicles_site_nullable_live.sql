-- =============================================================================
-- FIX: Allow adding vehicles with no site ("Free (no site)").
-- Run this in Supabase Dashboard → SQL Editor if "Failed to add vehicle" happens
-- and the error mentions site_id or null value.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- 1) Make site_id nullable (required for "Free (no site)" vehicles)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'site_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.vehicles ALTER COLUMN site_id DROP NOT NULL;
    COMMENT ON COLUMN public.vehicles.site_id IS 'Optional. NULL = free vehicle (not assigned to a site).';
  END IF;
END $$;

-- 2) Ensure capacity_tons exists (for trucks)
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS capacity_tons numeric(10,2);

-- 3) Ensure status column exists (active/inactive for soft delete) – add if missing
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'inactive'));
