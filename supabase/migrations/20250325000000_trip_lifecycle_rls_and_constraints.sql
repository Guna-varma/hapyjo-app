-- =============================================================================
-- Trip lifecycle: ensure RLS and constraints so driver end-trip and
-- assigned_trips TRIP_NEED_APPROVAL work correctly.
-- Run this in Supabase SQL Editor if your app shows "Failed to end trip".
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) TRIPS: Ensure RLS enabled and policies allow driver to INSERT/UPDATE
-- -----------------------------------------------------------------------------
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trips read by role" ON public.trips;
CREATE POLICY "Trips read by role"
  ON public.trips FOR SELECT
  TO authenticated
  USING (
    (public.current_user_role())::text IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR ((public.current_user_role())::text = 'assistant_supervisor' AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
    OR ((public.current_user_role())::text IN ('driver_truck', 'driver_machine') AND driver_id = auth.uid())
  );

DROP POLICY IF EXISTS "Trips write by drivers and management" ON public.trips;
CREATE POLICY "Trips write by drivers and management"
  ON public.trips FOR ALL
  TO authenticated
  USING (
    (public.current_user_role())::text IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine')
  )
  WITH CHECK (
    (public.current_user_role())::text IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine')
  );

-- Completed trips must have start/end coords and distance_km > 0 (app sends min 0.01)
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_completed_gps_check;
ALTER TABLE public.trips
  ADD CONSTRAINT trips_completed_gps_check CHECK (
    (status IS DISTINCT FROM 'completed')
    OR (
      start_lat IS NOT NULL
      AND start_lon IS NOT NULL
      AND end_lat IS NOT NULL
      AND end_lon IS NOT NULL
      AND distance_km IS NOT NULL
      AND distance_km > 0
    )
  );

-- -----------------------------------------------------------------------------
-- 2) ASSIGNED_TRIPS: Ensure RLS and policies for driver update (TRIP_NEED_APPROVAL)
-- -----------------------------------------------------------------------------
ALTER TABLE public.assigned_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AS insert assigned_trips for own sites" ON public.assigned_trips;
CREATE POLICY "AS insert assigned_trips for own sites"
  ON public.assigned_trips FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.current_user_role())::text = 'assistant_supervisor'
    AND EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.assistant_supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "AS update assigned_trips for own sites" ON public.assigned_trips;
CREATE POLICY "AS update assigned_trips for own sites"
  ON public.assigned_trips FOR UPDATE
  TO authenticated
  USING (
    (public.current_user_role())::text = 'assistant_supervisor'
    AND EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.assistant_supervisor_id = auth.uid()
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "Driver select own assigned_trips" ON public.assigned_trips;
CREATE POLICY "Driver select own assigned_trips"
  ON public.assigned_trips FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
    OR (public.current_user_role())::text IN ('assistant_supervisor', 'head_supervisor', 'owner', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.assistant_supervisor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Driver update own assigned_trips" ON public.assigned_trips;
CREATE POLICY "Driver update own assigned_trips"
  ON public.assigned_trips FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Realtime: add assigned_trips to publication if not already there (ignore if already member)
DO $realtime$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.assigned_trips;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $realtime$;
