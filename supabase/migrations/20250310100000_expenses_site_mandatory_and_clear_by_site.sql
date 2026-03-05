-- =============================================================================
-- Expenses: site location is mandatory. All expenses (general and fuel) are
-- stored per site. This migration enforces non-empty site_id and documents
-- the safe way to clear expenses by site.
-- =============================================================================

-- 1) Ensure site_id cannot be null or blank (NOT NULL already exists; add CHECK)
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_site_id_not_empty;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_site_id_not_empty
  CHECK (site_id IS NOT NULL AND trim(site_id) <> '');

COMMENT ON COLUMN public.expenses.site_id IS 'Mandatory: every expense is attributed to a site location.';

-- 2) Safe query to clear expenses for a single site (use in app or SQL client):
--    DELETE FROM public.expenses WHERE site_id = 'site_xxx';
--    RLS applies: only rows the user is allowed to delete will be removed.
