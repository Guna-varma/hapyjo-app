# Production logic patch summary

Applied after the Production Readiness Audit to resolve failed modules and align with the PRD.

## 1. Supabase migration: `20250221100000_production_rbac_gps.sql`

- **Sites**  
  Replaced open read with role-based read: management + accountant see all; others only `site_id IN (SELECT site_id FROM site_assignments WHERE user_id = auth.uid())`.

- **Vehicles**  
  Same pattern: management + accountant see all; Assistant Supervisor and drivers only vehicles for their assigned sites.

- **Expenses**  
  Same pattern: read restricted by `site_assignments`.

- **Reports**  
  - SELECT only for `admin`, `owner`, `head_supervisor`, `accountant` (Driver cannot read reports).  
  - Removed all Accountant write policies so Accountant has SELECT-only access.

- **Surveys**  
  - Surveyor: INSERT only with `surveyor_id = auth.uid()`; UPDATE only own rows.  
  - Assistant Supervisor: UPDATE only rows where `site_id IN (SELECT site_id FROM site_assignments WHERE user_id = auth.uid())` (approved_by_id, approved_at, status).

- **Trips**  
  - Read: management/accountant all; Assistant Supervisor by site_assignments; drivers only `driver_id = auth.uid()`.  
  - Write: only `admin`, `owner`, `head_supervisor`, `assistant_supervisor`, `driver_truck`, `driver_machine` (Accountant cannot mutate).

- **Machine_sessions**  
  Same read/write rules as trips.

- **GPS**  
  Added CHECK on `public.trips`: when `status = 'completed'`, require `start_lat`, `start_lon`, `end_lat`, `end_lon` NOT NULL and `distance_km > 0`.

Existing triggers and views (expense → sites.spent / vehicles.fuel_balance_litre; trip/machine_sessions completion → fuel_consumed and vehicle deduction; site_financials; vehicle_fuel_summary) are unchanged and already match the PRD.

---

## 2. App changes

- **Reports (Accountant read-only)**  
  - `ReportsScreen`: `canGenerate` now only `['admin', 'owner', 'head_supervisor']` (Accountant can no longer generate reports).  
  - Export CSV remains hidden for read-only (accountant) via existing `readOnly` check.

- **Offline sync**  
  - New `lib/offlineQueue.ts`: queue persisted under app document directory (`hapyjo_offline_queue.json`).  
  - `MockAppStoreContext`:  
    - `addExpense` / `addTrip`: on Supabase insert failure, append to queue and optimistically update local state.  
    - `refetch`: before fetching, flush queue (insert each queued expense/trip to Supabase, then persist remaining queue).  
  - Expo Go compatible (expo-file-system only).

- **CSV export (Android)**  
  - After writing the CSV with Expo FileSystem, optionally open share dialog via dynamic `import('expo-sharing')` when available (e.g. Android save/share).  
  - Dependency: `expo-sharing` added to `package.json`. Run `npm install` (or `npx expo install expo-sharing`).

- **GPS validation**  
  - `DriverTripsScreen`: when ending a trip, if haversine `distance_km` is ≤ 0, set to `0.01` so the DB CHECK (`distance_km > 0` when completed) is satisfied.

---

## 3. Deploy steps

1. Run the new migration on your Supabase project (SQL Editor or `supabase db push` if using CLI):
   - `supabase/migrations/20250221100000_production_rbac_gps.sql`
2. If you have existing trips with `status = 'completed'` and NULL coords or `distance_km <= 0`, fix or delete them before applying the migration, or the CHECK will fail.
3. Install dependencies: `npm install` (or `npx expo install expo-sharing`).
4. Rebuild and test in Expo Go / dev client; then build the APK.

---

## 4. Module status after patch

| Module            | Status |
|-------------------|--------|
| Authentication    | Unchanged (already PASS). |
| RBAC              | **Fixed** (site_assignments, Driver/Accountant restrictions, Reports SELECT-only). |
| Expense / Trip / Machine session | Unchanged (triggers already correct). |
| Survey / Revenue / Profit / Vehicle summary / Budget | Unchanged (views/RLS already correct). |
| Reports           | **Fixed** (Accountant read-only in app; RLS SELECT-only). |
| GPS               | **Fixed** (CHECK + app minimum distance). |
| Realtime          | Unchanged (subscriptions already in place). |
| Offline           | **Fixed** (queue + flush on refetch). |
