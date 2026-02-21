-- Real-time driver geo: current position during in-progress trip (for supervisor live tracking)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS current_lat numeric(10,6),
  ADD COLUMN IF NOT EXISTS current_lon numeric(10,6),
  ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

COMMENT ON COLUMN public.trips.current_lat IS 'Latest driver latitude during in_progress trip (real-time tracking)';
COMMENT ON COLUMN public.trips.current_lon IS 'Latest driver longitude during in_progress trip (real-time tracking)';
COMMENT ON COLUMN public.trips.location_updated_at IS 'When current_lat/current_lon were last updated';
