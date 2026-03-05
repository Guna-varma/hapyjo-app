-- Budget allocation history per site (additive). Total site budget = sum of allocations.
-- Enables history + date stamps for Assistant Supervisor planning.

CREATE TABLE IF NOT EXISTS public.site_budget_allocations (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  amount_rwf numeric NOT NULL CHECK (amount_rwf > 0),
  allocated_at timestamptz NOT NULL DEFAULT now(),
  allocated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_site_budget_allocations_site_id ON public.site_budget_allocations(site_id);
CREATE INDEX IF NOT EXISTS idx_site_budget_allocations_allocated_at ON public.site_budget_allocations(allocated_at);

ALTER TABLE public.site_budget_allocations ENABLE ROW LEVEL SECURITY;

-- Read: admin/owner/head_supervisor/accountant see all; others see allocations for sites they are assigned to
CREATE POLICY "Site budget allocations read by site readers"
  ON public.site_budget_allocations FOR SELECT
  USING (
    public.current_user_role() IN ('admin', 'owner', 'head_supervisor', 'accountant')
    OR EXISTS (
      SELECT 1 FROM public.site_assignments sa
      WHERE sa.site_id = site_budget_allocations.site_id AND sa.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin head_supervisor insert site_budget_allocations"
  ON public.site_budget_allocations FOR INSERT
  WITH CHECK (public.current_user_role() IN ('admin', 'head_supervisor'));

-- Realtime optional
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_budget_allocations;
