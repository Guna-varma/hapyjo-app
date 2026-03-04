# Demo data: one-flow seed and cleanup

## One-flow seed (for testing)

To load **one flow** of demo data (small numbers, max 100000) so you can verify the app works:

1. Ensure at least one user exists (sign up in the app or run `scripts/seed-auth-users.js`).
2. In Supabase Dashboard → **SQL Editor**, open and run **`supabase/scripts/seed_one_flow_demo.sql`**.

This inserts one site, two vehicles, expenses, trips, a machine session, survey, issue, task, and operation, and report—all with the `demo-` prefix. **No notifications are seeded**; notifications are real-time only and are created when users perform actions in the app (add issue, add trip, add expense, etc.). When you are done testing, run the cleanup below.

---

## Production DB cleanup (remove demo data)

If demo data was ever seeded (e.g. from `seed_one_flow_demo.sql` or entities with IDs prefixed with `demo-`), run the cleanup script **once** in the Supabase SQL Editor.

## How to run

1. Open your project in [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**.
2. Either:
   - **Option A:** Open the file `supabase/scripts/cleanup_demo_data.sql` in your repo, copy its contents, paste into the SQL Editor, and click **Run**.
   - **Option B:** Copy the SQL below and paste into the SQL Editor, then click **Run**.

## Script: remove only demo data (`demo-` prefix)

This removes every row whose `id` or relevant foreign key (e.g. `site_id`, `vehicle_id`) starts with `demo-`. Auth users and real data are left unchanged.

```sql
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
```

After this, the database contains only real data.

---

## Notifications: reset / no storage growth

Notifications older than **1 day** can be pruned so storage stays small and in-app lists stay short.

- **Run once manually:** In SQL Editor run `supabase/scripts/prune_notifications_1day.sql` (it calls `public.prune_notifications_older_than_1day()`).
- **Run daily automatically:** After enabling the `pg_cron` extension in Supabase, schedule the function, e.g. at 2:00 UTC every day:
  ```sql
  SELECT cron.schedule('0 2 * * *', $$SELECT public.prune_notifications_older_than_1day()$$);
  ```
  The function is created by migration `20250304120000_notifications_prune_older_than_1day.sql`.

---

## Optional: remove ALL app data (full reset)

If you want a completely empty app database (no sites, vehicles, trips, etc.) but **keep user auth** (users can still log in), run `supabase/scripts/cleanup_all_app_data.sql` in the SQL Editor. That script deletes every row from application tables; it does not delete `profiles` or `auth.users`.
