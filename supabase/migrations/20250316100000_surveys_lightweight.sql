-- =============================================================================
-- Lightweight surveys: store only result (site_id, survey_date, volume_m3, status).
-- No file storage (top/depth files discarded after calculation).
-- Status: approval_pending | approved | rejected.
-- =============================================================================

-- Add new columns
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS survey_date date,
  ADD COLUMN IF NOT EXISTS volume_m3 numeric(12,2),
  ADD COLUMN IF NOT EXISTS revision_of text REFERENCES public.surveys(id),
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill from existing data
UPDATE public.surveys
SET
  survey_date = COALESCE((created_at AT TIME ZONE 'UTC')::date, now()::date),
  volume_m3 = work_volume
WHERE survey_date IS NULL OR volume_m3 IS NULL;

-- Migrate status: draft/submitted -> approval_pending, approved -> approved; add rejected
UPDATE public.surveys SET status = 'approval_pending' WHERE status IN ('draft', 'submitted');
-- approved stays 'approved'

-- Drop old columns (file content, type, measurements, location, photos, work_volume, site_name)
ALTER TABLE public.surveys
  DROP COLUMN IF EXISTS before_file_content,
  DROP COLUMN IF EXISTS after_file_content,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS measurements,
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS photos,
  DROP COLUMN IF EXISTS work_volume,
  DROP COLUMN IF EXISTS site_name;

-- Enforce survey_date and volume_m3 for new rows (nullable for legacy rows during transition)
UPDATE public.surveys SET survey_date = (created_at AT TIME ZONE 'UTC')::date WHERE survey_date IS NULL;
UPDATE public.surveys SET volume_m3 = 0 WHERE volume_m3 IS NULL;

ALTER TABLE public.surveys
  ALTER COLUMN survey_date SET DEFAULT (now() AT TIME ZONE 'UTC')::date,
  ALTER COLUMN survey_date SET NOT NULL;

-- New status constraint
ALTER TABLE public.surveys DROP CONSTRAINT IF EXISTS surveys_status_check;
ALTER TABLE public.surveys
  ADD CONSTRAINT surveys_status_check CHECK (status IN ('approval_pending', 'approved', 'rejected'));

-- site_financials view: use volume_m3 instead of work_volume
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
  SELECT
    sur.site_id,
    SUM(sur.volume_m3 * COALESCE(sit.contract_rate_rwf, 0)) AS revenue
  FROM public.surveys sur
  JOIN public.sites sit ON sit.id = sur.site_id
  WHERE sur.status = 'approved' AND sur.volume_m3 IS NOT NULL
  GROUP BY sur.site_id
) rev ON rev.site_id = s.id
LEFT JOIN (
  SELECT
    site_id,
    SUM(
      CASE WHEN type = 'general' THEN COALESCE(amount_rwf, 0)
           WHEN type = 'fuel' THEN COALESCE(fuel_cost, 0)
           ELSE 0 END
    ) AS total_cost
  FROM public.expenses
  GROUP BY site_id
) cost ON cost.site_id = s.id;
