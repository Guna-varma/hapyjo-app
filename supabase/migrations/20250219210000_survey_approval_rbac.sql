-- =============================================================================
-- Survey approval RBAC: Owner/Head/Admin see only approved; Assistant Supervisor sees site surveys and can approve
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated read surveys" ON public.surveys;

-- Owner, Head Supervisor, Admin: only rows where status = 'approved'
-- Assistant Supervisor: rows where site_id is in their site_assignments
-- Surveyor: own surveys (surveyor_id = auth.uid())
-- Others (accountant, drivers): only approved
CREATE POLICY "Surveys read by role"
  ON public.surveys FOR SELECT
  TO authenticated
  USING (
    (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'head_supervisor', 'admin')
      AND status = 'approved'
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor'
      AND site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'surveyor'
      AND surveyor_id = auth.uid()
    )
    OR (
      (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('accountant', 'driver_truck', 'driver_machine')
      AND status = 'approved'
    )
  );

-- Keep write policy: surveyor and assistant_supervisor can INSERT/UPDATE/DELETE
-- Assistant supervisor can only UPDATE to set approved_* and status (enforced in app or add separate policy)
-- No change to "Surveyor assistant_supervisor write surveys" for now