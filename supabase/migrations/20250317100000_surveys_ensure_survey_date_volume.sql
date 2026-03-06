-- Ensure surveys has survey_date and volume_m3 (required by app POST).
-- Safe to run: ADD COLUMN IF NOT EXISTS. Run this if 20250316100000_surveys_lightweight was not applied.
ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS survey_date date,
  ADD COLUMN IF NOT EXISTS volume_m3 numeric(12,2),
  ADD COLUMN IF NOT EXISTS revision_of text REFERENCES public.surveys(id),
  ADD COLUMN IF NOT EXISTS notes text;

-- Backfill existing rows (do not reference work_volume; it may already be dropped by lightweight migration)
UPDATE public.surveys SET survey_date = (created_at AT TIME ZONE 'UTC')::date WHERE survey_date IS NULL;
UPDATE public.surveys SET volume_m3 = 0 WHERE volume_m3 IS NULL;

-- Default for new inserts (do not set NOT NULL here to avoid breaking legacy rows)
ALTER TABLE public.surveys
  ALTER COLUMN survey_date SET DEFAULT (now() AT TIME ZONE 'UTC')::date;
