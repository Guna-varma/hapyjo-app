-- Backfill: insert initial budget allocation row for sites where the total from
-- site_budget_allocations is less than site.budget (e.g. initial budget was set at
-- site creation before the allocation table existed, or the insert failed).
-- Safe to run multiple times: only inserts the shortfall, so after one run no shortfall remains.

INSERT INTO public.site_budget_allocations (site_id, amount_rwf, allocated_at)
SELECT s.id, (s.budget - COALESCE(SUM(a.amount_rwf), 0))::numeric, COALESCE(s.start_date::timestamptz, now())
FROM public.sites s
LEFT JOIN public.site_budget_allocations a ON a.site_id = s.id
WHERE s.budget > 0
GROUP BY s.id, s.budget, s.start_date
HAVING (s.budget - COALESCE(SUM(a.amount_rwf), 0)) > 0;
