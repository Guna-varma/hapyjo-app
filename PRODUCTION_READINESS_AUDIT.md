# HapyJo Ltd – Production Readiness Audit

**Application:** Expo + Supabase Android  
**Audit date:** 2025-02-21  
**Scope:** PRD-aligned functional logic and RBAC before APK release  

---

## Executive summary

| Module            | Result | Notes |
|-------------------|--------|--------|
| Authentication    | **PASS** | |
| RBAC              | **FAIL** | Assistant Supervisor not site-scoped at DB; Accountant can generate reports; Drivers/Accountant not restricted at RLS for some tables. |
| Expense           | **PASS** | |
| Trip              | **PASS** | |
| Machine Session   | **PASS** | |
| Survey            | **PASS** | |
| Revenue           | **PASS** | |
| Profit            | **PASS** | |
| Vehicle Summary   | **PASS** | |
| Budget            | **PASS** | |
| Reports           | **PASS** | Data and CSV export correct; Accountant read-only is app bug (see RBAC). |
| GPS               | **PASS** | distance_km > 0 not enforced when completed. |
| Realtime          | **PASS** | |
| Offline           | **FAIL** | No offline queue or sync on reconnect. |

---

## 1. AUTHENTICATION

**Requirement:** All users created by Owner exist in `auth.users` and a corresponding `profiles` row is created by `handle_new_user` trigger. No profile without a matching `auth.users` record.

**Findings:**

- **create_user_by_owner** (Supabase Edge Function) calls `auth.admin.createUser()`, which inserts into `auth.users`. The trigger `on_auth_user_created` (AFTER INSERT ON auth.users) runs `handle_new_user()`, which inserts into `public.profiles` with `id = NEW.id`, name, email, role (from `raw_user_meta_data->>'role'`), and default `site_access = '{}'`. The function then updates the new profile (name, phone, role, active) and optionally creates a `site_assignments` row. So every user created by Owner exists in `auth.users` and has a profile.
- **No orphan profiles:** `public.profiles.id` is `REFERENCES auth.users(id) ON DELETE CASCADE`, so a profile row cannot exist without a valid `auth.users` row. Deletion of a user in `auth.users` cascades to `profiles`.

**Result: PASS**

---

## 2. RBAC

**Requirements:**

- Assistant Supervisor may only access data where `site_id` is in `profiles.site_access` or `site_assignments`.
- Driver roles cannot access reports, vehicles, or other users.
- Accountant has read-only access to reports and cannot mutate trips, expenses, surveys, or issues.

**Findings:**

- **Assistant Supervisor site scoping:**  
  - **Surveys:** RLS policy “Surveys read by role” restricts Assistant Supervisor to `site_id IN (SELECT site_id FROM public.site_assignments WHERE user_id = auth.uid())`. **OK.**  
  - **Sites, vehicles, expenses:** Policies are “Authenticated read sites/vehicles/expenses” with `USING (true)`, so any authenticated user (including Assistant Supervisor) can read all rows. There is no RLS filter by `site_assignments` or `profiles.site_access` for these tables. **FAIL.**

- **Driver access:**  
  - **App:** `lib/rbac.ts` `TAB_ACCESS.reports` = `['admin','owner','head_supervisor','accountant']`; drivers do not have `reports`, `users`, `sites`, or `vehicles`. So in the app, drivers cannot open reports, vehicles, or users. **OK.**  
  - **DB:** Reports (and sites/vehicles) use “Authenticated read” with `USING (true)`, so a driver could read reports (and other data) if calling the API directly. **FAIL** for strict server-side enforcement.

- **Accountant:**  
  - **App:** `isReportsReadOnly('accountant') === true` and the Reports UI shows “Read-only access” and hides the Export CSV button when `readOnly` is true. However, `canGenerate` in `ReportsScreen` includes `'accountant'`, so the “Generate Report” block is still shown and the accountant can generate (insert) reports. The copy says they “cannot generate or export,” so this is inconsistent and allows mutation (insert) of reports. **FAIL.**  
  - **DB:** RLS allows accountant to INSERT/UPDATE reports (migration `20250220200000`). Trips and machine_sessions use “Authenticated write” with `USING (true)`, so an accountant could mutate trips and machine_sessions via the API. Expenses and surveys are correctly restricted to assistant_supervisor / surveyor+assistant_supervisor. **FAIL** for “Accountant cannot mutate trips…”.

**Result: FAIL**

**Recommendations:**

- Add RLS policies so Assistant Supervisor can only SELECT from `sites`, `vehicles`, and `expenses` where `site_id` is in their `site_assignments` (or `profiles.site_access` if used).
- Restrict reports SELECT to roles that should see reports (e.g. admin, owner, head_supervisor, accountant); restrict reports INSERT/UPDATE to roles that may generate (e.g. exclude accountant if read-only).
- Add RLS so that only drivers/supervisors (or similar) can INSERT/UPDATE trips and machine_sessions (exclude accountant).

---

## 3. EXPENSE LOGIC

**Requirement:** On insert into `public.expenses`, `sites.spent` is incremented by `amount_rwf` for general and by `fuel_cost` for fuel; fuel expenses also increment `vehicles.fuel_balance_litre` by `litres`.

**Findings:**

- Trigger `after_expense_insert` (function `on_expense_insert`) in `20250220200000_expense_trip_machine_triggers_and_views.sql`:
  - `type = 'general'`: `add_spent := COALESCE(NEW.amount_rwf, 0)`, then `sites.spent += add_spent`. **OK.**
  - `type = 'fuel'`: `add_spent := COALESCE(NEW.fuel_cost, 0)`, `add_litres := COALESCE(NEW.litres, 0)`; `sites.spent += add_spent`; if `vehicle_id` and `add_litres > 0`, `vehicles.fuel_balance_litre += add_litres`. **OK.**
- App sends general expense with `amountRwf`; fuel expense with `amountRwf`, `fuelCost`, `litres`; `expenseToRow` maps to `amount_rwf`, `fuel_cost`, `litres`. **OK.**

**Result: PASS**

---

## 4. TRIP LOGIC

**Requirement:** When `public.trips.status` becomes `completed`, `fuel_consumed` = `distance_km / vehicles.mileage_km_per_litre`, and `vehicles.fuel_balance_litre` is reduced accordingly.

**Findings:**

- Trigger `on_trip_status_completed` (BEFORE UPDATE, when status changes to `completed`) in the same migration:
  - Reads `mileage_km_per_litre` from `vehicles` for `NEW.vehicle_id`.
  - Sets `consumed := ROUND((NEW.distance_km / mileage)::numeric, 2)` and `NEW.fuel_consumed := consumed`.
  - Updates vehicle: `fuel_balance_litre = GREATEST(0, fuel_balance_litre - consumed)`.
- App completes trips with `distanceKm` (haversine) and `updateTrip(..., { status: 'completed', ... })`. **OK.**

**Result: PASS**

---

## 5. MACHINE SESSION

**Requirement:** When `public.machine_sessions.status` becomes `completed`, `duration_hours` is computed; `fuel_consumed` = `duration_hours / vehicles.hours_per_litre`; `vehicles.fuel_balance_litre` is reduced.

**Findings:**

- Trigger `on_machine_session_status_completed` (BEFORE UPDATE when status becomes `completed`):
  - `duration_hrs := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2)`; `NEW.duration_hours := duration_hrs`.
  - Reads `hours_per_litre` from `vehicles`; `consumed := ROUND((duration_hrs / hrs_per_litre)::numeric, 2)`; `NEW.fuel_consumed := consumed`.
  - Updates vehicle: `fuel_balance_litre = GREATEST(0, fuel_balance_litre - consumed)`.
- App sets `endTime` and `status: 'completed'` on end session. **OK.**

**Result: PASS**

---

## 6. SURVEY

**Requirement:** Surveys with `status != 'approved'` are not visible to Owner or Head Supervisor. Assistant Supervisor of the same site can approve; approval sets `approved_by_id` and `approved_at`.

**Findings:**

- RLS “Surveys read by role”: Owner, Head Supervisor, Admin see only rows with `status = 'approved'`. **OK.**
- Assistant Supervisor sees rows where `site_id IN (SELECT site_id FROM site_assignments WHERE user_id = auth.uid())` (all statuses for their sites). **OK.**
- `SurveysScreen` approval: `updateSurvey(s.id, { status: 'approved', approvedById: user.id, approvedAt: new Date().toISOString() })`. **OK.**
- `surveyToRow` and types include `approved_by_id` and `approved_at`. **OK.**

**Result: PASS**

---

## 7. REVENUE

**Requirement:** Revenue per site = `surveys.work_volume × sites.contract_rate_rwf`.

**Findings:**

- View `site_financials`:  
  `revenue = SUM(sur.work_volume * COALESCE(sit.contract_rate_rwf, 0))` over approved surveys with non-null `work_volume`, grouped by site. **OK.**
- Dashboards (Owner, Accountant, etc.) use `workVolume * contractRateRwf` (global rate in mock store); DB view uses per-site `contract_rate_rwf`. **OK.**

**Result: PASS**

---

## 8. PROFIT

**Requirement:** Profit per site = Revenue − SUM(expenses.amount_rwf).

**Findings:**

- View `site_financials`: `site_total_cost` = SUM of `amount_rwf` for general and `fuel_cost` for fuel per site; `profit = revenue - site_total_cost`. **OK.**
- Dashboards use `totalSpent` (sites.spent) and `revenue - totalCost`. **OK.**

**Result: PASS**

---

## 9. VEHICLE SUMMARY

**Requirement:** Dashboard aggregates Fuel Filled, Fuel Used, Remaining Fuel from expenses, trips, machine_sessions.

**Findings:**

- View `vehicle_fuel_summary`: `fuel_filled_litres` from SUM(expenses.litres) where type = 'fuel'; `fuel_used_litres` from SUM(fuel_consumed) from completed trips and machine_sessions; `remaining_litres` = `vehicles.fuel_balance_litre`. **OK.**
- ReportsScreen vehicle fuel summary uses expenses (fuel), trips (completed), machine_sessions (completed), and vehicle balance. **OK.**

**Result: PASS**

---

## 10. BUDGET

**Requirement:** Remaining Budget = `sites.budget − sites.spent`.

**Findings:**

- View `site_financials`: `remaining_budget = (s.budget - s.spent)`. **OK.**
- Dashboards use `totalBudget - totalSpent` / `remaining`. **OK.**

**Result: PASS**

---

## 11. REPORT EXPORT

**Requirement:** `public.reports.data` includes trips, machine_hours, fuel_cost, expenses, revenue, profit. CSV export produces the correct file via Expo FileSystem.

**Findings:**

- `handleGenerateReport` builds `reportData` with: `trips` (completed count), `machine_hours`, `fuel_cost`, `expenses` (totalSpentAll), `revenue`, `profit`, plus totalBudget, totalSpent, remainingBudget, generatedAt. **OK.**
- CSV: `reportDataToCSV` flattens the report object; file written with `expo-file-system/legacy` `writeAsStringAsync` to `documentDirectory`/`cacheDirectory`. **OK.**

**Result: PASS**

---

## 12. GPS

**Requirement:** Trips store `start_lat`, `start_lon`, `end_lat`, `end_lon`. `distance_km > 0` when completed.

**Findings:**

- Schema: `trips` has `start_lat`, `start_lon`, `end_lat`, `end_lon`, `distance_km`.
- `DriverTripsScreen`: on start, current position → `startLat`, `startLon`; on end, position → `endLat`, `endLon`; `distanceKm = haversineKm(...)`. Mappers map to/from DB columns. **OK.**
- No server or client check that `distance_km > 0` when status is completed; haversine can be 0 if start and end are the same. **Minor gap** (no strict enforcement of distance_km > 0).

**Result: PASS** (with note: distance_km > 0 not enforced)

---

## 13. REALTIME

**Requirement:** Postgres changes subscription updates dashboards for expenses, trips, machine_sessions, vehicles, surveys.

**Findings:**

- `MockAppStoreContext` subscribes with `postgres_changes` on `sites`, `vehicles`, `expenses`, `trips`, `machine_sessions`, `surveys`, plus issues, site_assignments, driver_vehicle_assignments, tasks, operations, reports, profiles. On any event it calls `refetch()`, which reloads all store data and updates UI. **OK.**

**Result: PASS**

---

## 14. OFFLINE

**Requirement:** Trip creation and expense entry work offline and sync on reconnect.

**Findings:**

- `addTrip` and `addExpense` call `supabase.from(...).insert(...)` directly. There is no offline queue, no local persistence of pending mutations, and no sync-on-reconnect logic. If the device is offline, inserts fail. **FAIL.**

**Result: FAIL**

**Recommendation:** Implement an offline queue (e.g. local SQLite or AsyncStorage) for trip and expense inserts and a sync job that runs when the app regains connectivity.

---

## Summary table (PASS / FAIL)

| #  | Module           | Result |
|----|------------------|--------|
| 1  | Authentication   | **PASS** |
| 2  | RBAC             | **FAIL** |
| 3  | Expense          | **PASS** |
| 4  | Trip             | **PASS** |
| 5  | Machine Session  | **PASS** |
| 6  | Survey           | **PASS** |
| 7  | Revenue          | **PASS** |
| 8  | Profit           | **PASS** |
| 9  | Vehicle Summary  | **PASS** |
| 10 | Budget           | **PASS** |
| 11 | Reports          | **PASS** |
| 12 | GPS              | **PASS** |
| 13 | Realtime         | **PASS** |
| 14 | Offline          | **FAIL** |

**Total: 12 PASS, 2 FAIL.**

Before APK release, address **RBAC** (Assistant Supervisor site scoping, Driver/Accountant restrictions at RLS; align Report screen with Accountant read-only) and **Offline** (offline-capable trip/expense entry with sync on reconnect).
