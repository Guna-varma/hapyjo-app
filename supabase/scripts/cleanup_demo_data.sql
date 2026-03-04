-- =============================================================================
-- Remove all dummy/demo data from Supabase (for client handover)
-- Run this in the Supabase Dashboard → SQL Editor.
-- Order matters: delete from child tables first (foreign keys).
-- Only rows with id or foreign key like 'demo-%' are removed; auth users stay.
-- =============================================================================

-- Notifications (demo id or demo link)
DELETE FROM public.notifications WHERE id LIKE 'demo-%' OR link_id LIKE 'demo-%';

-- Expenses (demo id or demo site)
DELETE FROM public.expenses WHERE id LIKE 'demo-%' OR site_id LIKE 'demo-%';

-- Trips (demo vehicle or demo site)
DELETE FROM public.trips WHERE vehicle_id LIKE 'demo-%' OR site_id LIKE 'demo-%';

-- Machine sessions (demo vehicle or demo site)
DELETE FROM public.machine_sessions WHERE vehicle_id LIKE 'demo-%' OR site_id LIKE 'demo-%';

-- Reports (demo id)
DELETE FROM public.reports WHERE id LIKE 'demo-%';

-- Surveys (demo id or demo site)
DELETE FROM public.surveys WHERE id LIKE 'demo-%' OR site_id LIKE 'demo-%';

-- Issues (demo id or demo site)
DELETE FROM public.issues WHERE id LIKE 'demo-%' OR site_id LIKE 'demo-%';

-- Tasks (demo id or demo site)
DELETE FROM public.tasks WHERE id LIKE 'demo-%' OR site_id LIKE 'demo-%';

-- Operations (demo id or demo site)
DELETE FROM public.operations WHERE id LIKE 'demo-%' OR site_id LIKE 'demo-%';

-- Site assignments (demo site)
DELETE FROM public.site_assignments WHERE site_id LIKE 'demo-%';

-- Driver–vehicle assignments (demo site)
DELETE FROM public.driver_vehicle_assignments WHERE site_id LIKE 'demo-%';

-- Vehicles (demo id)
DELETE FROM public.vehicles WHERE id LIKE 'demo-%';

-- Sites (demo id)
DELETE FROM public.sites WHERE id LIKE 'demo-%';

-- Done. Auth users (profiles) are unchanged. Only demo-prefixed data was removed.
