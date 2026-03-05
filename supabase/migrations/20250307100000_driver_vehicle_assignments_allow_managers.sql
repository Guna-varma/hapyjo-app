-- Allow admin, head_supervisor, and assistant_supervisor to write driver_vehicle_assignments
-- (owner excluded). So "Save Assignments" works for site managers.
DROP POLICY IF EXISTS "Assistant supervisor write driver_vehicle_assignments" ON public.driver_vehicle_assignments;
CREATE POLICY "Managers and assistant supervisor write driver_vehicle_assignments"
  ON public.driver_vehicle_assignments FOR ALL
  USING (
    (public.current_user_role()) IN ('admin', 'head_supervisor', 'assistant_supervisor')
  )
  WITH CHECK (
    (public.current_user_role()) IN ('admin', 'head_supervisor', 'assistant_supervisor')
  );
