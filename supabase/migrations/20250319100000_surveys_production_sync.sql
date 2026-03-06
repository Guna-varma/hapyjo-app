-- =============================================================================
-- Surveys table: production sync with app (idempotent).
-- Run this once on any remote that still has the old schema. Safe to re-run.
-- Target: survey_date, volume_m3, status IN ('approval_pending','approved','rejected'),
--         no type/before_file_content/after_file_content/work_volume/etc.
-- =============================================================================

-- 1) Add new columns if missing
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS survey_date date,
  ADD COLUMN IF NOT EXISTS volume_m3 numeric(12,2),
  ADD COLUMN IF NOT EXISTS revision_of text REFERENCES public.surveys(id),
  ADD COLUMN IF NOT EXISTS notes text;

-- 2) Backfill survey_date from created_at
UPDATE public.surveys SET survey_date = (created_at AT TIME ZONE 'UTC')::date WHERE survey_date IS NULL;

-- 3) Backfill volume_m3 (from work_volume if column exists, else 0)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'surveys' AND column_name = 'work_volume') THEN
    UPDATE public.surveys SET volume_m3 = COALESCE(volume_m3, work_volume, 0) WHERE volume_m3 IS NULL;
  ELSE
    UPDATE public.surveys SET volume_m3 = 0 WHERE volume_m3 IS NULL;
  END IF;
END $$;

-- 4) If "type" exists: set default and backfill (so INSERT without type works)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'surveys' AND column_name = 'type') THEN
    ALTER TABLE public.surveys ALTER COLUMN type SET DEFAULT 'before_after';
    UPDATE public.surveys SET type = 'before_after' WHERE type IS NULL;
  END IF;
END $$;

-- 5) Drop old status constraint first (it only allows draft/submitted/approved)
ALTER TABLE public.surveys DROP CONSTRAINT IF EXISTS surveys_status_check;

-- 6) Migrate status values: draft/submitted -> approval_pending (approved stays approved)
UPDATE public.surveys SET status = 'approval_pending' WHERE status IN ('draft', 'submitted');

-- 7) Add new status constraint (app values)
ALTER TABLE public.surveys
  ADD CONSTRAINT surveys_status_check CHECK (status IN ('approval_pending', 'approved', 'rejected'));

-- 8) Replace site_financials view to use volume_m3 (must be before dropping work_volume)
CREATE OR REPLACE VIEW public.site_financials AS
SELECT
  s.id AS site_id,
  s.name AS site_name,
  s.budget,
  s.spent,
  (s.budget - s.spent) AS remaining_budget,
  COALESCE(rev.revenue, 0)::bigint AS revenue,
  COALESCE(cost.total_cost, 0)::bigint AS site_total_cost,
  (COALESCE(rev.revenue, 0) - COALESCE(cost.total_cost, 0))::bigint AS profit
FROM public.sites s
LEFT JOIN (
  SELECT sur.site_id, SUM(sur.volume_m3 * COALESCE(sit.contract_rate_rwf, 0)) AS revenue
  FROM public.surveys sur
  JOIN public.sites sit ON sit.id = sur.site_id
  WHERE sur.status = 'approved' AND sur.volume_m3 IS NOT NULL
  GROUP BY sur.site_id
) rev ON rev.site_id = s.id
LEFT JOIN (
  SELECT site_id,
    SUM(CASE WHEN type = 'general' THEN COALESCE(amount_rwf, 0) WHEN type = 'fuel' THEN COALESCE(fuel_cost, 0) ELSE 0 END) AS total_cost
  FROM public.expenses
  GROUP BY site_id
) cost ON cost.site_id = s.id;

-- 9) Drop old columns (view no longer depends on work_volume)
ALTER TABLE public.surveys
  DROP COLUMN IF EXISTS before_file_content,
  DROP COLUMN IF EXISTS after_file_content,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS measurements,
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS photos,
  DROP COLUMN IF EXISTS work_volume,
  DROP COLUMN IF EXISTS site_name;

-- 10) Enforce survey_date default and NOT NULL
ALTER TABLE public.surveys
  ALTER COLUMN survey_date SET DEFAULT (now() AT TIME ZONE 'UTC')::date;
UPDATE public.surveys SET survey_date = (created_at AT TIME ZONE 'UTC')::date WHERE survey_date IS NULL;
ALTER TABLE public.surveys ALTER COLUMN survey_date SET NOT NULL;
