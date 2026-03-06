-- Allow drivers to read the profile of the Assistant Supervisor (manager) of their assigned site(s).
-- This enables the Driver Dashboard to show "Manager" name and contact for call.
-- Covers: (1) site.assistant_supervisor_id and (2) site_assignments with role assistant_supervisor.

CREATE POLICY "Driver can read manager profile at assigned site"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    (current_user_role()) IN ('driver_truck', 'driver_machine')
    AND (
      id IN (
        SELECT s.assistant_supervisor_id
        FROM public.sites s
        WHERE s.assistant_supervisor_id IS NOT NULL
          AND s.id IN (SELECT site_id FROM public.driver_vehicle_assignments WHERE driver_id = auth.uid())
      )
      OR id IN (
        SELECT sa.user_id
        FROM public.site_assignments sa
        WHERE sa.role = 'assistant_supervisor'
          AND sa.site_id IN (SELECT site_id FROM public.driver_vehicle_assignments WHERE driver_id = auth.uid())
      )
    )
  );
