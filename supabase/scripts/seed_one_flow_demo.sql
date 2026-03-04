-- =============================================================================
-- One flow of demo data (for testing – small numbers, max 100000)
-- Run in Supabase Dashboard → SQL Editor.
-- Requires: at least one user in Auth + public.profiles (e.g. create via sign-up
-- or run scripts/seed-auth-users.js first). All demo IDs use prefix "demo-";
-- remove with scripts/cleanup_demo_data.sql when done testing.
--
-- Notifications: none are seeded. Notifications are real-time only—every useful
-- interaction in the app (issue, trip, expense, survey, task, report, etc.)
-- inserts into notifications and triggers a system notification for the right roles.
-- =============================================================================

-- 1) Site (budget/spent ≤ 100000)
INSERT INTO public.sites (
  id, name, location, status, start_date, budget, spent, progress, contract_rate_rwf
) VALUES (
  'demo-site-1',
  'Demo Site',
  'Kigali',
  'active',
  (current_date - 30),
  100000,
  25000,
  25.00,
  500
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  location = EXCLUDED.location,
  status = EXCLUDED.status,
  start_date = EXCLUDED.start_date,
  budget = EXCLUDED.budget,
  spent = EXCLUDED.spent,
  progress = EXCLUDED.progress,
  contract_rate_rwf = EXCLUDED.contract_rate_rwf;

-- 2) Vehicles (one truck, one machine; truck has mileage_km_per_litre, machine has hours_per_litre)
-- Disable vehicle sync trigger to avoid stack overflow (sync public.vehicles <-> umugwaneza.vehicles).
ALTER TABLE public.vehicles DISABLE TRIGGER tr_sync_vehicle_to_umugwaneza;
INSERT INTO public.vehicles (
  id, site_id, type, vehicle_number_or_id, mileage_km_per_litre, hours_per_litre, tank_capacity_litre, fuel_balance_litre, status
) VALUES
  ('demo-v1', 'demo-site-1', 'truck', 'RWA-D01', 5.0, NULL, 100, 50, 'active'),
  ('demo-v2', 'demo-site-1', 'machine', 'MCH-D01', NULL, 0.8, 50, 25, 'active')
ON CONFLICT (id) DO UPDATE SET
  site_id = EXCLUDED.site_id,
  type = EXCLUDED.type,
  vehicle_number_or_id = EXCLUDED.vehicle_number_or_id,
  mileage_km_per_litre = EXCLUDED.mileage_km_per_litre,
  hours_per_litre = EXCLUDED.hours_per_litre,
  tank_capacity_litre = EXCLUDED.tank_capacity_litre,
  fuel_balance_litre = EXCLUDED.fuel_balance_litre,
  status = EXCLUDED.status;
ALTER TABLE public.vehicles ENABLE TRIGGER tr_sync_vehicle_to_umugwaneza;

-- 3) Expenses (amounts ≤ 100000)
INSERT INTO public.expenses (
  id, site_id, amount_rwf, description, date, type, vehicle_id, created_at
) VALUES
  ('demo-exp-1', 'demo-site-1', 15000, 'Demo fuel refill', (current_date - 1), 'fuel', 'demo-v1', now()),
  ('demo-exp-2', 'demo-site-1', 25000, 'Demo supplies', (current_date - 2), 'general', NULL, now())
ON CONFLICT (id) DO UPDATE SET
  site_id = EXCLUDED.site_id,
  amount_rwf = EXCLUDED.amount_rwf,
  description = EXCLUDED.description,
  date = EXCLUDED.date,
  type = EXCLUDED.type,
  vehicle_id = EXCLUDED.vehicle_id;

-- 4) Trips (driver = first profile; distances small; completed trips need start/end GPS per trips_completed_gps_check)
-- Dummy Kigali coords: start (-1.9536, 30.0606), end (-1.9600, 30.0720) so distance_km > 0 and constraint is satisfied.
INSERT INTO public.trips (
  id, vehicle_id, driver_id, site_id, start_time, end_time,
  start_lat, start_lon, end_lat, end_lon, distance_km, status, created_at
)
SELECT
  'demo-trip-1',
  'demo-v1',
  p.id,
  'demo-site-1',
  (now() - interval '2 days'),
  (now() - interval '2 days' + interval '1 hour'),
  -1.9536, 30.0606, -1.9600, 30.0720,
  10.00,
  'completed',
  now()
FROM (SELECT id FROM public.profiles LIMIT 1) p
ON CONFLICT (id) DO UPDATE SET
  distance_km = 10.00, status = 'completed',
  start_lat = -1.9536, start_lon = 30.0606, end_lat = -1.9600, end_lon = 30.0720;

INSERT INTO public.trips (
  id, vehicle_id, driver_id, site_id, start_time, end_time,
  start_lat, start_lon, end_lat, end_lon, distance_km, status, created_at
)
SELECT
  'demo-trip-2',
  'demo-v1',
  p.id,
  'demo-site-1',
  (now() - interval '1 day'),
  (now() - interval '1 day' + interval '45 minutes'),
  -1.9536, 30.0606, -1.9650, 30.0680,
  20.00,
  'completed',
  now()
FROM (SELECT id FROM public.profiles LIMIT 1) p
ON CONFLICT (id) DO UPDATE SET
  distance_km = 20.00, status = 'completed',
  start_lat = -1.9536, start_lon = 30.0606, end_lat = -1.9650, end_lon = 30.0680;

-- 5) Machine session
INSERT INTO public.machine_sessions (
  id, vehicle_id, driver_id, site_id, start_time, end_time, duration_hours, status, created_at
)
SELECT
  'demo-ms-1',
  'demo-v2',
  p.id,
  'demo-site-1',
  (now() - interval '3 days'),
  (now() - interval '3 days' + interval '2 hours 30 minutes'),
  2.50,
  'completed',
  now()
FROM (SELECT id FROM public.profiles LIMIT 1) p
ON CONFLICT (id) DO UPDATE SET duration_hours = 2.50, status = 'completed';

-- 6) Survey
INSERT INTO public.surveys (
  id, type, site_id, site_name, surveyor_id, status, created_at
)
SELECT
  'demo-survey-1',
  'volume',
  'demo-site-1',
  'Demo Site',
  p.id,
  'submitted',
  now()
FROM (SELECT id FROM public.profiles LIMIT 1) p
ON CONFLICT (id) DO UPDATE SET status = 'submitted';

-- 7) Issue
INSERT INTO public.issues (
  id, site_id, site_name, raised_by_id, description, status, created_at
)
SELECT
  'demo-issue-1',
  'demo-site-1',
  'Demo Site',
  p.id,
  'Demo issue for testing',
  'open',
  now()
FROM (SELECT id FROM public.profiles LIMIT 1) p
ON CONFLICT (id) DO UPDATE SET description = EXCLUDED.description, status = 'open';

-- 8) Site assignment (link first user to demo site)
INSERT INTO public.site_assignments (site_id, user_id, role)
SELECT 'demo-site-1', p.id, COALESCE((SELECT role::text FROM public.profiles WHERE id = p.id), 'owner')
FROM (SELECT id FROM public.profiles LIMIT 1) p
ON CONFLICT (site_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- 9) Driver–vehicle assignment (first user drives both vehicles on this site)
INSERT INTO public.driver_vehicle_assignments (site_id, driver_id, vehicle_ids)
SELECT 'demo-site-1', p.id, ARRAY['demo-v1', 'demo-v2']
FROM (SELECT id FROM public.profiles LIMIT 1) p
ON CONFLICT (site_id, driver_id) DO UPDATE SET vehicle_ids = EXCLUDED.vehicle_ids;

-- 10) Task
INSERT INTO public.tasks (
  id, title, description, site_id, site_name, status, priority, due_date, progress, created_at, updated_at
) VALUES (
  'demo-task-1',
  'Demo task',
  'Demo task for testing',
  'demo-site-1',
  'Demo Site',
  'pending',
  'medium',
  (current_date + 7),
  0,
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description;

-- 11) Operation (budget/spent ≤ 100000)
INSERT INTO public.operations (
  id, name, site_id, site_name, type, status, budget, spent, start_date, end_date
) VALUES (
  'demo-op-1',
  'Demo operation',
  'demo-site-1',
  'Demo Site',
  'maintenance',
  'completed',
  50000,
  25000,
  (current_date - 14),
  (current_date - 1)
) ON CONFLICT (id) DO UPDATE SET budget = EXCLUDED.budget, spent = EXCLUDED.spent, status = EXCLUDED.status;

-- 12) Report
INSERT INTO public.reports (
  id, title, type, generated_date, period, data
) VALUES (
  'demo-report-1',
  'Demo Financial Report',
  'financial',
  current_date,
  'This month',
  '{}'::jsonb
) ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, generated_date = EXCLUDED.generated_date;

-- Notifications are real-time only (see docs/NOTIFICATION_SCENARIOS.md). No seeded notification rows.

-- Done. One site, two vehicles, expenses, trips, machine session, survey, issue, task, operation, report.
-- All amounts <= 100000 so you can verify the app works correctly.
