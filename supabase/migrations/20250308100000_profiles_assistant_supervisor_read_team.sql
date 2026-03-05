-- =============================================================================
-- Allow Assistant Supervisor to read profiles of users assigned to their site(s):
-- - Users in site_assignments for any site the assistant supervisor is assigned to
-- - Drivers in driver_vehicle_assignments for vehicles at those sites
-- - Plus their own profile (auth.uid())
-- This fixes "Team at this site" showing names/contacts (—) because RLS
-- previously only allowed admin/owner/head_supervisor to read all profiles.
-- =============================================================================

-- Assistant supervisor can read own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Assistant supervisor can read profiles of team members at their site(s)
-- (users in site_assignments + drivers in driver_vehicle_assignments for those sites)
DROP POLICY IF EXISTS "Assistant supervisor can read team profiles" ON public.profiles;
CREATE POLICY "Assistant supervisor can read team profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (current_user_role()) = 'assistant_supervisor'
    AND (
      id IN (
        SELECT user_id FROM public.site_assignments
        WHERE site_id IN (
          SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()
        )
      )
      OR id IN (
        SELECT driver_id FROM public.driver_vehicle_assignments
        WHERE site_id IN (
          SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid()
        )
      )
    )
  );
