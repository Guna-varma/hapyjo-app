# System notifications – testing (Expo Go & prod APK)

The app shows **real Android/iOS system notifications** (status bar / notification shade) with **no latency** when something happens in real time.

## Real-time flow (demo and production)

1. **Something happens** (trip started, expense added, issue raised, survey submitted, etc.) → app or backend inserts row(s) into `public.notifications` (one per target role, using premade scenarios + real-time data).
2. **Supabase Realtime** pushes the INSERT to all subscribed clients.
3. **App (this device)** – if the new row’s `target_role` matches the current user’s role → **system notification is shown immediately** (title + body, with app icon in production).
4. **Database webhook** (if configured) calls **send-push-on-notification** Edge Function → **Expo Push** is sent to all devices whose users have that role → those users get a push notification even when the app is in background.

So: **all users** who are targeted by a scenario get the notification (in-app list + system notification when app is open, and push when app is in background). Notifications use **premade templates + real-time data** (e.g. site name, vehicle, amount).

## What you get

| Event | Who gets it | Notification |
|--------|-------------|---------------|
| **Log in** | Current user | One: *"Hapyjo – You are logged in."* |
| **While logged in (demo)** | Every role who is logged in | Every **1 min**: rotating real-time-style messages (Trip completed, New expense, Issue reported, Survey submitted, Trip started, etc.) – to impress client |
| **Sign out** | Current user | One: *"You are signed out."* |
| **Trip started** | owner, head_supervisor, assistant_supervisor | *"Trip started – track live"* + site/vehicle/driver (real-time system + push) |
| **Trip completed** | owner, head_supervisor, assistant_supervisor, accountant | *"Trip completed"* + site/vehicle/distance |
| **Expense added** | owner, head_supervisor, assistant_supervisor, accountant | *"New expense"* + site/amount/description |
| **Issue raised** | admin, owner, head_supervisor, assistant_supervisor | *"New issue reported"* + site/description |
| **Survey submitted** | admin, owner, head_supervisor, assistant_supervisor | *"Survey submitted"* + site |
| **Vehicle added** | owner, head_supervisor, assistant_supervisor | *"Vehicle added"* + vehicle/site |
| *(and other scenarios)* | per role | Premade title + real-time body |

All of these are **system notifications** (from the device), with **app icon in production** (from `app.json` → expo-notifications `icon` and `defaultChannel`).

## Android Expo Go vs real APK (for client demo)

- **Permission:** The app **asks for notification permission** in both **Android Expo Go** and **real APK**: on the login screen (after ~1.5s), when you tap **Login**, and again when you’re logged in. You should see the system “Allow notifications” dialog (with optional rationale: “Allow Hapyjo to show real-time notifications…”).
- **Real system notifications (not toasts):** In a **real APK or development build**, you get **real** system notifications in the notification tray every 1 minute (demo) and in real time when events happen. These are **not** toasts; they appear in the system notification shade with the app icon.
- **Expo Go limit:** In **Expo Go** the permission prompt works, but the native notification module is not available, so **system notifications every minute do not appear** there. For a **full demo** (permission + real notifications every minute), use a **development build** or **production APK**.

## Driver live location (Uber-style)

- When a **driver starts a trip** (`status: in_progress`), supervisors (owner, head_supervisor, assistant_supervisor) get a **real-time notification**: *"Trip started – track live"* so they can open the app and see the driver’s **live position** on the map (trips table `current_lat` / `current_lon` update every ~20s).
- No notification is sent on every location ping (to avoid spam); only trip start (and trip complete) trigger notifications.

## Webhook (required for push when app is in background)

For **Expo Push** to be sent on every new notification row:

1. **Deploy** the Edge Function:  
   `supabase functions deploy send-push-on-notification`
2. **Database Webhook:**  
   Dashboard → Database → Webhooks → Create  
   - Table: `public.notifications`  
   - Events: **Insert**  
   - Type: **Supabase Edge Functions**  
   - Function: `send-push-on-notification`  
   - Save  

Then every INSERT into `notifications` triggers the function, which sends Expo Push to all devices for users with that `target_role`. Notifications use the **default** channel so they show with the app icon on Android.

## How to test

### 1. Allow notification permission

- On first open (login screen), the app asks for **notification permission**. Tap **Allow**.
- If you previously denied, go to **Settings → Apps → Hapyjo → Notifications** and turn them on.

### 2. Real-time system notifications (app in foreground)

1. Log in as e.g. **owner** or **head_supervisor**.
2. From another device or account: start a trip (driver), add an expense, raise an issue, or submit a survey.
3. You should see a **system notification** (status bar) **immediately** with the right title and body for that event.
4. Open the notification list in the app – the new item appears (Realtime + refetch).

### 3. Expo Go (`expo start`)

- You still get login / 1-min rotating demo / sign-out notifications if the module loads.
- **Real-time** notifications from the DB work when Realtime is connected; if Expo Go doesn’t load `expo-notifications`, use a **dev/production build** for full behavior.

### 4. Production / dev build (APK)

1. Build: `eas build --platform android --profile production` (or your APK profile).
2. Install the APK. Notifications use the **app icon** (from `app.json`).
3. Allow notifications, log in. Trigger events (trip start, expense, etc.) – you get **real-time system notifications** with no latency.
4. With the **webhook** configured, you also get **push** when the app is in background.

---

## Summary

- **Real-time system notifications** – when a row is inserted into `notifications` and Realtime delivers it, the app shows a system notification **immediately** if the row targets the current user’s role (premade title + real-time body).
- **Demo (client impress)** – every **1 minute** while logged in, each user gets a rotating dummy real-time-style notification (Trip completed, New expense, Issue reported, Survey submitted, Trip started, etc.) so every role sees activity.
- **All users** targeted by a scenario receive the notification (in-app list + system/push).
- **Driver live** – trip start notifies supervisors so they can track live location in the app; no per-ping notifications.
- **Production** – notifications show with **app icon** (default channel, high importance).
- **Webhook** – set up the DB webhook so push is sent to all relevant users when a notification is inserted.
