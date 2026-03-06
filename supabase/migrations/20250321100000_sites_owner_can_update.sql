-- =============================================================================
-- Allow owner to update sites (e.g. set contract_rate_rwf).
-- Without this, only admin and head_supervisor could write; owner save did not persist.
-- Reports and dashboards use sites.contract_rate_rwf for revenue; once persisted,
-- all reports are affected accordingly.
-- =============================================================================

DROP POLICY IF EXISTS "Admin head_supervisor write sites" ON public.sites;
CREATE POLICY "Admin head_supervisor owner write sites"
  ON public.sites FOR ALL
  TO authenticated
  USING ((current_user_role()) IN ('admin', 'head_supervisor', 'owner'))
  WITH CHECK ((current_user_role()) IN ('admin', 'head_supervisor', 'owner'));
