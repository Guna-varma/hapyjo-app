# Notification scenarios (end-to-end)

**Notifications are real-time system notifications for every useful interaction.** All scenarios in the table below are wired in the app: each action inserts one notification row per target role into `public.notifications` → Supabase Realtime delivers the INSERT → the app shows a **system notification** for the current user when their role matches `target_role`. Push (Expo) can be sent via the send-push-on-notification Edge Function. No demo or seeded notification rows.

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
| **task_assigned** | `updateTask` (assigned_to set or status → in_progress) | owner, head_supervisor, assistant_supervisor, driver_truck, driver_machine | task |
| **vehicle_added** | `addVehicle` | owner, head_supervisor, assistant_supervisor | vehicle |
| **vehicle_updated** | `updateVehicle` | owner, head_supervisor, assistant_supervisor, driver_truck, driver_machine | vehicle |
| **site_added** | `addSite` | admin, owner, head_supervisor, assistant_supervisor | site |
| **machine_session_started** | `addMachineSession` (status in_progress) | owner, head_supervisor, assistant_supervisor | machine_session |

*`password_reset` has no target roles (reserved for email or in-app only).*

---

## Implementation

The application follows all scenarios above. Each row in the table is implemented in **`context/MockAppStoreContext.tsx`** as follows:

| Scenario | Wired in |
|----------|----------|
| issue_raised | `addIssue` — inserts notifications with `siteName` after issue insert |
| issue_resolved | `updateIssue` — when `status` → resolved or acknowledged |
| trip_started | `addTrip` (status in_progress), `updateTrip` (status → in_progress) |
| trip_completed | `addTrip` (status completed), `updateTrip` (status → completed) |
| expense_added | `addExpense` |
| survey_submitted | `addSurvey` |
| survey_approved | `updateSurvey` — when status → approved |
| report_generated | `addReport` |
| user_created | `createUserByOwner` (after Edge Function success) |
| site_assignment | `setSiteAssignment` |
| driver_vehicle_assignment | `setDriverVehicleAssignment` |
| machine_session_started | `addMachineSession` (status in_progress) |
| machine_session_completed | `addMachineSession` (status completed), `updateMachineSession` (status → completed) |
| task_completed | `updateTask` — when status → completed |
| task_assigned | `updateTask` — when status → in_progress or `assigned_to` set (non-empty) |
| vehicle_added | `addVehicle` |
| vehicle_updated | `updateVehicle` |
| site_added | `addSite` |

Scenarios are defined in **`lib/notificationScenarios.ts`** (target roles, title/body builders). The same Realtime subscription in `MockAppStoreContext` shows a system notification for the current user whenever a notification row is inserted and `target_role` matches their role.

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

The script does not insert any data. Notifications are created when users perform actions in the app (raise issue, add trip, add expense, etc.).

---

## Adding a new scenario

1. In `lib/notificationScenarios.ts`: add a new `NotificationScenarioId`, then add an entry in `scenarios` with `targetRoles`, `linkType`, `getTitle`, `getBody`, and optional `linkIdKey`.
2. In `context/MockAppStoreContext.tsx`: after the mutation that should trigger it, build rows with `buildNotificationRows('your_scenario_id', payload, () => generateId('n'))` and insert each row into `notifications`.

Payload should include any fields your `getTitle` / `getBody` use (e.g. `siteName`, `vehicleNumberOrId`). Enrich from `state` (sites, vehicles, users) when the entity doesn’t have names.
