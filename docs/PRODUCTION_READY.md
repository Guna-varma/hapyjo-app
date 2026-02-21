# HapyJo Ltd – Production readiness

This app is **production-ready** per the PRD: no dummy users, no mock data, real Supabase auth and data, real-time driver geo tracking, and UUID-based IDs for all entities.

## What is production-ready

- **Auth:** Real Supabase Auth (email/password). Users created via Edge Function `create_user_by_owner` (Owner/Admin/Head Supervisor); temporary password for immediate sign-in.
- **Data:** All entities (trips, expenses, surveys, issues, vehicles, sites, machine sessions) use `generateId()` (UUID-based) from `lib/id.ts` – no timestamp-only or dummy IDs.
- **GPS & real-time driver tracking:**
  - **Start trip:** Requests location permission, records start lat/lon.
  - **During trip:** `watchPositionAsync` updates `trips.current_lat`, `trips.current_lon`, `trips.location_updated_at` every 20s (and on significant movement).
  - **End trip:** Records end lat/lon, Haversine distance, fuel consumed; clears live position.
  - **Supervisors:** "Live driver tracking" on Driver Trips screen shows all in-progress trips with driver name, vehicle, site, and last position (lat/lon + updated time). Realtime subscription keeps the list and positions up to date.
- **No mock data:** No hardcoded user lists (e.g. site assignments use real `users` from store). Placeholders in inputs (e.g. "you@example.com") are UI hints only.
- **Context name:** `MockAppStoreContext` / `useMockAppStore` is the **real** Supabase-backed store; the name is legacy.

## Database

- Run all migrations (see `supabase/migrations/`) including:
  - `20250219200000_handle_new_user_metadata_role.sql`
  - `20250219210000_survey_approval_rbac.sql`
  - `20250219220000_trips_live_location.sql` (adds `current_lat`, `current_lon`, `location_updated_at` on `trips`)

## Deploy

1. **Supabase:** Link project, run `supabase db push`, deploy Edge Function `create_user_by_owner`.
2. **App:** Set `.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Create first admin user (Dashboard + SQL to set `profiles.role = 'admin'`).

## PRD alignment

- Site-location model, roles, user management, vehicle master, budget flow, expense management, fuel tracking, driver/site allocation, driver trip (with GPS and optional photo), machine sessions, survey approval RBAC, issue raising, management dashboards, revenue/profit, and real-time geo tracking are implemented and wired to Supabase with no mock or dummy data.
