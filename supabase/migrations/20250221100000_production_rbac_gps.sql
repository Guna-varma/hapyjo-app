-- =============================================================================
-- Production logic patch: RBAC (Assistant Supervisor site scoping, Driver/Accountant
-- restrictions), Reports SELECT-only for Accountant, Survey write by site,
-- Trips/Machine_sessions write exclude Accountant, GPS validation for completed trips.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) SITES: Replace open read with role-based read (site_assignments for AS/drivers/surveyor)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read sites" ON public.sites;

CREATE POLICY "Sites read by role"
  ON public.sites FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (
      id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 2) VEHICLES: Replace open read; Drivers/Assistant Supervisor only assigned sites
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read vehicles" ON public.vehicles;

CREATE POLICY "Vehicles read by role"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (
      site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 3) EXPENSES: Replace open read with role-based (site_assignments for AS/drivers)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read expenses" ON public.expenses;

CREATE POLICY "Expenses read by role"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (
      site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- 4) REPORTS: SELECT only for admin, owner, head_supervisor, accountant.
--    Remove Accountant write (read-only access).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read reports" ON public.reports;
DROP POLICY IF EXISTS "Accountant insert update reports" ON public.reports;
DROP POLICY IF EXISTS "Accountant can write reports" ON public.reports;
DROP POLICY IF EXISTS "Accountant can update reports" ON public.reports;

CREATE POLICY "Reports read by management and accountant"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
  );

-- Write remains only for admin, owner, head_supervisor (already in 20250220200000)
-- No change to "Admin owner head_supervisor write reports" if present

-- -----------------------------------------------------------------------------
-- 5) SURVEYS: Restrict write – Assistant Supervisor only update for assigned sites;
--    Surveyor insert/update own. (Read already in 20250219210000.)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Surveyor assistant_supervisor write surveys" ON public.surveys;

CREATE POLICY "Surveyor insert surveys"
  ON public.surveys FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'surveyor'
    AND surveyor_id = auth.uid()
  );

CREATE POLICY "Surveyor update own surveys"
  ON public.surveys FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'surveyor'
    AND surveyor_id = auth.uid()
  )
  WITH CHECK (true);

CREATE POLICY "Assistant supervisor update site surveys"
  ON public.surveys FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor'
    AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())
  )
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6) TRIPS: Read by role; Write exclude Accountant (drivers/supervisors/management only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read trips" ON public.trips;
DROP POLICY IF EXISTS "Authenticated write trips" ON public.trips;

CREATE POLICY "Trips read by role"
  ON public.trips FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor'
      AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('driver_truck', 'driver_machine')
      AND driver_id = auth.uid()
    )
  );

CREATE POLICY "Trips write by drivers and management"
  ON public.trips FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine')
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine')
  );

-- -----------------------------------------------------------------------------
-- 7) MACHINE_SESSIONS: Same as trips
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read machine_sessions" ON public.machine_sessions;
DROP POLICY IF EXISTS "Authenticated write machine_sessions" ON public.machine_sessions;

CREATE POLICY "Machine_sessions read by role"
  ON public.machine_sessions FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor'
      AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('driver_truck', 'driver_machine')
      AND driver_id = auth.uid()
    )
  );

CREATE POLICY "Machine_sessions write by drivers and management"
  ON public.machine_sessions FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine')
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine')
  );

-- -----------------------------------------------------------------------------
-- 8) GPS: Completed trips must have start/end coords and distance_km > 0
-- -----------------------------------------------------------------------------
ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_completed_gps_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_completed_gps_check CHECK (
    (status IS DISTINCT FROM 'completed')
    OR (
      start_lat IS NOT NULL
      AND start_lon IS NOT NULL
      AND end_lat IS NOT NULL
      AND end_lon IS NOT NULL
      AND distance_km > 0
    )
  );
