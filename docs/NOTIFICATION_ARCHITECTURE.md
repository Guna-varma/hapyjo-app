# Hapyjo Notification Architecture

This document describes the end-to-end notification system: database, realtime, push, deep linking, and app handling for **app closed**, **background**, and **foreground**.

---

## 1. Database Schema

### `public.notifications`

| Column        | Type      | Description |
|---------------|-----------|-------------|
| `id`          | text      | Primary key (UUID or nanoid). |
| `target_role` | text      | Role that receives this notification (e.g. `owner`, `head_supervisor`, `driver_truck`). |
| `title`       | text      | Notification title. |
| `body`        | text      | Notification body. |
| `created_at`  | timestamptz | Default `now()`. |
| `read`        | boolean   | Default `false`. |
| `link_id`     | text      | Optional entity id for deep link (e.g. issue id, trip id). |
| `link_type`   | text      | Type of linked entity: `issue`, `trip`, `machine_session`, `expense`, `survey`, `report`, `user`, `site`, `vehicle`, `task`, `settings`. |

**RLS:** Users can SELECT only rows where `target_role = current_user_role()`. Insert allowed for admin, owner, head_supervisor, assistant_supervisor, driver_truck, driver_machine. Users can UPDATE (e.g. mark read) their own role’s rows.

**Realtime:** Table is in `supabase_realtime` publication so the app can subscribe to `postgres_changes` (INSERT).

### `public.push_tokens`

Stores Expo push tokens per user for sending push when the app is closed or in background. Columns include `user_id`, `expo_push_token`, and any metadata. RLS restricts access by authenticated user.

---

## 2. Realtime Flow (Foreground / Background)

- **MockAppStoreContext** subscribes to `postgres_changes` on `notifications` with event `INSERT`.
- On each INSERT, it checks `payload.new.target_role === currentUserRoleRef.current`. If it matches:
  - It calls **`showSystemNotificationWithData(record.title, record.body, { linkId, linkType, notificationId })`** from `lib/localNotifications.ts`.
- That schedules a **local** Expo notification with `content.data` set, so when the user taps the notification the same **notification response listener** runs (see Deep linking below).
- Realtime only delivers while the app process is connected; when the app is **closed**, push is used instead (Database Webhook → Edge Function).

---

## 3. Push Flow (App Closed / Background)

- A **Database Webhook** fires on `INSERT` into `public.notifications`.
- It calls the **Edge Function** `send-push-on-notification`.
- The function:
  - Reads `target_role`, `title`, `body`, `link_id`, `link_type` from the inserted record.
  - Resolves user IDs with that role from `profiles` (active only).
  - Loads Expo push tokens from `push_tokens` for those users.
  - Sends one Expo push message per token with:
    - `title`, `body`, `sound`, `channelId: "default"`
    - `data: { linkId, linkType, notificationId }`
- When the user taps the push notification, the app opens and the **same** `addNotificationResponseReceivedListener` in **PushTokenRegistration** runs with `content.data` (linkType/linkId), and the app switches to the correct tab.

---

## 4. Notification Scenarios (Real Workflows)

All scenarios are defined in **`lib/notificationScenarios.ts`** with:

- **targetRoles** – who receives the notification
- **linkType** – for deep link mapping
- **getTitle / getBody** – use payload (site name, vehicle, driver, amounts, etc.)

| Scenario ID                 | Target roles (examples)                    | linkType          |
|----------------------------|---------------------------------------------|-------------------|
| issue_raised               | admin, owner, head_supervisor, assistant_supervisor | issue    |
| issue_resolved             | admin, owner, head_supervisor, assistant_supervisor | issue    |
| trip_started               | owner, head_supervisor, assistant_supervisor| trip     |
| trip_completed             | owner, head_supervisor, assistant_supervisor, accountant | trip |
| expense_added              | owner, head_supervisor, assistant_supervisor, accountant | expense |
| survey_submitted           | admin, owner, head_supervisor, assistant_supervisor | survey |
| survey_approved            | surveyor, owner, head_supervisor, accountant | survey  |
| report_generated           | admin, owner, head_supervisor, accountant   | report   |
| user_created               | admin, owner                                | user     |
| password_reset             | (targetRoles empty; can be sent to specific user later) | settings |
| site_assignment            | owner, head_supervisor, assistant_supervisor| site     |
| site_added                 | admin, owner, head_supervisor, assistant_supervisor | site |
| driver_vehicle_assignment  | owner, head_supervisor, assistant_supervisor, drivers | site (sites tab) |
| machine_session_started    | owner, head_supervisor, assistant_supervisor| machine_session |
| machine_session_completed  | owner, head_supervisor, assistant_supervisor, accountant | machine_session |
| task_assigned              | owner, head_supervisor, assistant_supervisor, drivers | task |
| task_completed             | owner, head_supervisor, assistant_supervisor| task     |
| vehicle_added              | owner, head_supervisor, assistant_supervisor| vehicle  |
| vehicle_updated            | owner, head_supervisor, assistant_supervisor, drivers | vehicle |

Callers (e.g. after creating an issue, completing a trip) use **`buildNotificationRows(scenarioId, payload, generateId)`** and insert the returned rows into `notifications`. Realtime and the webhook then drive system notifications and push.

---

## 5. linkType → Tab Mapping (Deep Link)

**`lib/notificationDeepLink.ts`** maps `link_type` to the app tab:

| link_type                | Tab       |
|--------------------------|-----------|
| issue                    | issues    |
| trip, machine_session, task | tasks |
| expense                  | expenses  |
| survey                   | surveys   |
| report                   | reports   |
| user                     | users     |
| site, driver_vehicle_assignment | sites |
| vehicle                  | vehicles  |
| settings                 | settings  |
| (default)                | dashboard |

When the user taps a notification (local or push), **PushTokenRegistration** reads `content.data.linkType`, calls **`getTabForLinkType(linkType)`**, then **`getSetActiveTab()(tab)`** so **AppNavigation** switches to that tab. Optional future: use `linkId` to open a specific detail screen (e.g. issue by id).

---

## 6. App State Handling

| State      | How notification is shown                         | Tap handling |
|------------|----------------------------------------------------|--------------|
| **Foreground** | Realtime INSERT → `showSystemNotificationWithData` → local notification in tray | Response listener → switch tab by linkType. |
| **Background** | Same as foreground if process still connected; otherwise push from webhook. | Same: response listener → switch tab. |
| **Closed** | Push only (Database Webhook → Edge Function → Expo Push). | App opens → response listener runs → switch tab. |

Expo’s `addNotificationResponseReceivedListener` runs when the user taps a notification whether it was delivered by realtime (local) or push.

---

## 7. Implementation Pieces

- **Supabase**
  - `notifications` table + RLS + Realtime publication.
  - `push_tokens` table for Expo tokens.
  - Database Webhook on `notifications` INSERT → `send-push-on-notification`.
- **Edge Function:** `supabase/functions/send-push-on-notification/index.ts` – builds messages with `data.linkId`, `data.linkType`, `data.notificationId`.
- **App**
  - **Push token registration:** `PushTokenRegistration` registers the device token for the logged-in user (no-op in Expo Go).
  - **Realtime listener:** `MockAppStoreProvider` subscribes to notification INSERTs and calls `showSystemNotificationWithData` when `target_role` matches.
  - **Local notifications:** `lib/localNotifications.ts` – `showSystemNotificationWithData(title, body, data)` so tap includes `data`.
  - **Deep link on tap:** `PushTokenRegistration` uses `NotificationNavigationContext.getSetActiveTab()` and `getTabForLinkType(linkType)` to switch tab.
  - **Tab registration:** `AppNavigation` registers `setActiveTab` with `NotificationNavigationProvider` so the notification handler can switch tabs.
- **Notification center:** `NotificationsModal` lists in-app notifications from the store; opening a notification can use the same linkType/linkId for future “open detail” behavior.

---

## 8. Role-Based Targeting

Notifications are **role-based**: each row has a single `target_role`. Only users with that role (and active in `profiles`) see the notification in the app (RLS) and receive push (Edge Function queries by role). Scenarios in `notificationScenarios.ts` define per-event `targetRoles`; `buildNotificationRows` creates one row per target role so everyone who should be notified gets a row.

---

## 9. Scalability

- **Realtime:** One subscription per logged-in user; filter by `target_role` in app so only relevant rows trigger a system notification.
- **Push:** One webhook per INSERT; Edge Function batches all tokens for the target role in one request to Expo.
- **Adding scenarios:** Add a new scenario in `notificationScenarios.ts` with `targetRoles`, `linkType`, and `getTitle`/`getBody`; use `buildNotificationRows` where the event happens; ensure `link_type` is mapped in `notificationDeepLink.ts` if needed.

This architecture uses real database data and existing app workflows (sites, vehicles, drivers, expenses, surveys, issues, tasks, GPS/reports) and is production-ready for Hapyjo.
