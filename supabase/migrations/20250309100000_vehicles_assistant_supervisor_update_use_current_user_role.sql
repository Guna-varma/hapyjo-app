-- =============================================================================
-- Use current_user_role() for assistant_supervisor vehicle UPDATE policy so
-- RLS evaluates consistently and RETURNING can return the updated row.
-- Fixes PATCH returning [] or 403 when assistant_supervisor saves vehicle.
-- =============================================================================

DROP POLICY IF EXISTS "Assistant supervisor update vehicles" ON public.vehicles;
CREATE POLICY "Assistant supervisor update vehicles"
  ON public.vehicles FOR UPDATE
  TO authenticated
  USING (current_user_role() = 'assistant_supervisor')
  WITH CHECK (current_user_role() = 'assistant_supervisor');
