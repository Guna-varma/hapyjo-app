# Notification scenarios (end-to-end)

All in-app and push notifications are driven by **pre-made scenarios** in `lib/notificationScenarios.ts`. Each scenario defines:

- **When** it fires (which mutation or event)
- **Who** receives it (target roles from `profiles.role`)
- **Title and body** (built from the event payload)

Permissions are taken from users: only users whose `profiles.role` matches a scenario’s `targetRoles` see that notification (RLS on `notifications` and push targeting use the same role).

---

## Scenarios

Target roles are chosen so everyone who needs to know gets the notification with minimal back-and-forth. Real-time payload data (site name, amounts, etc.) is attached in title/body.

| Scenario ID | Trigger | Target roles | Link type |
|-------------|--------|--------------|-----------|
| **issue_raised** | `addIssue` | admin, owner, head_supervisor, assistant_supervisor | issue |
| **issue_resolved** | `updateIssue` (status → resolved or acknowledged) | admin, owner, head_supervisor, assistant_supervisor | issue |
| **trip_started** | `addTrip` (status in_progress) or `updateTrip` (status → in_progress) | owner, head_supervisor, assistant_supervisor | trip |
| **trip_completed** | `addTrip` (status completed) or `updateTrip` (status → completed) | owner, head_supervisor, assistant_supervisor, accountant | trip |
| **expense_added** | `addExpense` | owner, head_supervisor, assistant_supervisor, accountant | expense |
| **survey_submitted** | `addSurvey` | admin, owner, head_supervisor, assistant_supervisor | survey |
| **survey_approved** | `updateSurvey` (patch status → approved) | surveyor, owner, head_supervisor, accountant | survey |
| **report_generated** | `addReport` | admin, owner, head_supervisor, accountant | report |
| **user_created** | `createUserByOwner` | admin, owner | user |
| **password_reset** | (reserved; no role broadcast) | — | settings |
| **site_assignment** | `setSiteAssignment` | owner, head_supervisor, assistant_supervisor | site |
| **driver_vehicle_assignment** | `setDriverVehicleAssignment` | owner, head_supervisor, assistant_supervisor, driver_truck, driver_machine | site |
| **machine_session_completed** | `addMachineSession` or `updateMachineSession` (status → completed) | owner, head_supervisor, assistant_supervisor, accountant | machine_session |
| **task_completed** | `updateTask` (patch status → completed) | owner, head_supervisor, assistant_supervisor | task |
| **vehicle_added** | `addVehicle` | owner, head_supervisor, assistant_supervisor | vehicle |

---

## Flow

1. **App** (e.g. Issues screen) calls a store method (`addIssue`, `addTrip`, …).
2. **MockAppStoreContext** writes to the DB (issues, trips, …) then calls `buildNotificationRows(scenarioId, payload, generateId)`.
3. One **notification row per target role** is inserted into `public.notifications` (same title/body/link for all; only `target_role` differs).
4. **Supabase Realtime** pushes the INSERT to subscribed clients. The app shows a **system notification** immediately for the current user when `target_role` matches (no latency; premade title + real-time body, app icon in production).
5. **Database webhook** (if configured) calls **send-push-on-notification** Edge Function → **Expo Push** is sent to all devices whose users have that role. All targeted users receive the notification (in-app list + system/push).

---

## Verifying real-time setup

Use **`supabase/scripts/verify_realtime_notifications.sql`** to check that:

- `public.notifications` is in the `supabase_realtime` publication
- `public.push_tokens` exists
- `public.current_user_role()` exists for RLS

The script does not insert demo data. For **demo notifications** that appear as "just now" in the app, run **`supabase/scripts/seed_demo_notifications_now.sql`** in the SQL Editor; you can run it from time to time to add fresh samples. Real notifications are also created when users perform actions in the app (raise issue, add trip, add expense, etc.).

---

## Adding a new scenario

1. In `lib/notificationScenarios.ts`: add a new `NotificationScenarioId`, then add an entry in `scenarios` with `targetRoles`, `linkType`, `getTitle`, `getBody`, and optional `linkIdKey`.
2. In `context/MockAppStoreContext.tsx`: after the mutation that should trigger it, build rows with `buildNotificationRows('your_scenario_id', payload, () => generateId('n'))` and insert each row into `notifications`.

Payload should include any fields your `getTitle` / `getBody` use (e.g. `siteName`, `vehicleNumberOrId`). Enrich from `state` (sites, vehicles, users) when the entity doesn’t have names.
