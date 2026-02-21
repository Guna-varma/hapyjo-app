-- =============================================================================
-- Fix 500 on REST API: use current_user_role() (SECURITY DEFINER) in RLS
-- instead of inline (SELECT role FROM public.profiles WHERE id = auth.uid())
-- to avoid RLS recursion / errors when evaluating policies.
-- =============================================================================

-- Ensure helper runs with definer rights and safe search_path
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------------------------------------
-- PROFILES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor'));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor'));

-- -----------------------------------------------------------------------------
-- SITES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Sites read by role" ON public.sites;
CREATE POLICY "Sites read by role"
  ON public.sites FOR SELECT
  TO authenticated
  USING (
    (current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Admin head_supervisor write sites" ON public.sites;
CREATE POLICY "Admin head_supervisor write sites"
  ON public.sites FOR ALL
  USING ((current_user_role()) IN ('admin', 'head_supervisor'));

-- -----------------------------------------------------------------------------
-- VEHICLES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vehicles read by role" ON public.vehicles;
CREATE POLICY "Vehicles read by role"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (
    (current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Admin owner head_supervisor write vehicles" ON public.vehicles;
CREATE POLICY "Admin owner head_supervisor write vehicles"
  ON public.vehicles FOR ALL
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor'));

-- -----------------------------------------------------------------------------
-- EXPENSES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Expenses read by role" ON public.expenses;
CREATE POLICY "Expenses read by role"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (
    (current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR (site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Assistant supervisor write expenses" ON public.expenses;
CREATE POLICY "Assistant supervisor write expenses"
  ON public.expenses FOR ALL
  USING ((current_user_role()) = 'assistant_supervisor');

-- -----------------------------------------------------------------------------
-- REPORTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Reports read by management and accountant" ON public.reports;
CREATE POLICY "Reports read by management and accountant"
  ON public.reports FOR SELECT
  TO authenticated
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'accountant'));

DROP POLICY IF EXISTS "Admin owner head_supervisor write reports" ON public.reports;
CREATE POLICY "Admin owner head_supervisor write reports"
  ON public.reports FOR ALL
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor'));

DROP POLICY IF EXISTS "Accountant insert update reports" ON public.reports;
CREATE POLICY "Accountant insert update reports"
  ON public.reports FOR ALL
  USING ((current_user_role()) = 'accountant')
  WITH CHECK ((current_user_role()) = 'accountant');

DROP POLICY IF EXISTS "Accountant can write reports" ON public.reports;
CREATE POLICY "Accountant can write reports"
  ON public.reports FOR INSERT
  WITH CHECK ((current_user_role()) = 'accountant');

DROP POLICY IF EXISTS "Accountant can update reports" ON public.reports;
CREATE POLICY "Accountant can update reports"
  ON public.reports FOR UPDATE
  USING ((current_user_role()) = 'accountant');

-- -----------------------------------------------------------------------------
-- SURVEYS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Surveys read by role" ON public.surveys;
CREATE POLICY "Surveys read by role"
  ON public.surveys FOR SELECT
  TO authenticated
  USING (
    ((current_user_role()) IN ('owner', 'head_supervisor', 'admin') AND status = 'approved')
    OR ((current_user_role()) = 'assistant_supervisor' AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
    OR ((current_user_role()) = 'surveyor' AND surveyor_id = auth.uid())
    OR ((current_user_role()) IN ('accountant', 'driver_truck', 'driver_machine') AND status = 'approved')
  );

DROP POLICY IF EXISTS "Surveyor insert surveys" ON public.surveys;
CREATE POLICY "Surveyor insert surveys"
  ON public.surveys FOR INSERT
  TO authenticated
  WITH CHECK ((current_user_role()) = 'surveyor' AND surveyor_id = auth.uid());

DROP POLICY IF EXISTS "Surveyor update own surveys" ON public.surveys;
CREATE POLICY "Surveyor update own surveys"
  ON public.surveys FOR UPDATE
  TO authenticated
  USING ((current_user_role()) = 'surveyor' AND surveyor_id = auth.uid())
  WITH CHECK (true);

DROP POLICY IF EXISTS "Assistant supervisor update site surveys" ON public.surveys;
CREATE POLICY "Assistant supervisor update site surveys"
  ON public.surveys FOR UPDATE
  TO authenticated
  USING ((current_user_role()) = 'assistant_supervisor' AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- TRIPS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Trips read by role" ON public.trips;
CREATE POLICY "Trips read by role"
  ON public.trips FOR SELECT
  TO authenticated
  USING (
    (current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR ((current_user_role()) = 'assistant_supervisor' AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
    OR ((current_user_role()) IN ('driver_truck', 'driver_machine') AND driver_id = auth.uid())
  );

DROP POLICY IF EXISTS "Trips write by drivers and management" ON public.trips;
CREATE POLICY "Trips write by drivers and management"
  ON public.trips FOR ALL
  TO authenticated
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'))
  WITH CHECK ((current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'));

-- -----------------------------------------------------------------------------
-- MACHINE_SESSIONS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Machine_sessions read by role" ON public.machine_sessions;
CREATE POLICY "Machine_sessions read by role"
  ON public.machine_sessions FOR SELECT
  TO authenticated
  USING (
    (current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR ((current_user_role()) = 'assistant_supervisor' AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()))
    OR ((current_user_role()) IN ('driver_truck', 'driver_machine') AND driver_id = auth.uid())
  );

DROP POLICY IF EXISTS "Machine_sessions write by drivers and management" ON public.machine_sessions;
CREATE POLICY "Machine_sessions write by drivers and management"
  ON public.machine_sessions FOR ALL
  TO authenticated
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'))
  WITH CHECK ((current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'));

-- -----------------------------------------------------------------------------
-- ISSUES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Head supervisor owner update issues" ON public.issues;
CREATE POLICY "Head supervisor owner update issues"
  ON public.issues FOR UPDATE
  USING ((current_user_role()) IN ('head_supervisor', 'owner'));

-- -----------------------------------------------------------------------------
-- SITE_ASSIGNMENTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin write site_assignments" ON public.site_assignments;
CREATE POLICY "Admin write site_assignments"
  ON public.site_assignments FOR ALL
  USING ((current_user_role()) IN ('admin', 'head_supervisor'));

-- -----------------------------------------------------------------------------
-- DRIVER_VEHICLE_ASSIGNMENTS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Assistant supervisor write driver_vehicle_assignments" ON public.driver_vehicle_assignments;
CREATE POLICY "Assistant supervisor write driver_vehicle_assignments"
  ON public.driver_vehicle_assignments FOR ALL
  USING ((current_user_role()) = 'assistant_supervisor');

-- -----------------------------------------------------------------------------
-- GPS_PHOTOS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Managers can read all gps_photos" ON public.gps_photos;
CREATE POLICY "Managers can read all gps_photos"
  ON public.gps_photos FOR SELECT
  USING ((current_user_role()) IN ('admin', 'owner', 'head_supervisor'));
