-- Speed up "order by created_at desc limit N" for assigned_trips (lightweight list load)
CREATE INDEX IF NOT EXISTS idx_assigned_trips_created_at_desc
  ON public.assigned_trips(created_at DESC);
