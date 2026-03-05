-- Site project dates: expected end (target) and actual completion (real-time when completed).
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS expected_end_date date,
  ADD COLUMN IF NOT EXISTS actual_completed_at timestamptz;

COMMENT ON COLUMN public.sites.expected_end_date IS 'Target end date; Head Supervisor can edit.';
COMMENT ON COLUMN public.sites.actual_completed_at IS 'Set when status becomes completed (real-time).';
