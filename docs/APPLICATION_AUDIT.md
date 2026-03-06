# Hapyjo Ltd – End-to-End Application Audit

**Purpose:** Single reference for what this Android app is, **why you are developing it**, **what each code file and screen does**, and how everything fits together. Use for onboarding, audits, and consistent development.

**Last updated:** 2025-03-07

---

## 1. What Is the Use of This Application (At the End)?

**At the end, this application is used to:**

- **Run field and fleet operations** for construction/earthworks: manage sites, vehicles, drivers, and machine operators from one mobile app.
- **Prove and approve work** with GPS evidence: drivers start/end trips with speedometer photos and location; supervisors approve distance, fuel, and notes so fuel and mileage are auditable.
- **Control costs and accountability**: track fuel, expenses, trip/session hours and distance; only **approved** trips/sessions count for fleet reports and financials.
- **Manage sites end-to-end**: budgets, tasks, surveys (excavation volume/cubature), issues, and work progress photos—all role-based so each user sees only what they need.

**In one sentence:** Hapyjo Ltd is a **field operations and fleet management** Android app (Expo/React Native, package `com.hapyjo.attendance`) that lets you manage construction sites, track trips and machine sessions with GPS proof, approve them via supervisors, and keep fleet and costs under control with full accountability.

---

## 2. Why You Are Developing It

You are developing this app to:

1. **Manage construction/earthworks sites** – budgets, progress, tasks, surveys, excavation volume.
2. **Track trips and machine sessions with GPS proof** – speedometer photos at start/end, pause/refuel, supervisor approval so data is trustworthy.
3. **Control fleet and costs** – vehicles, fuel, expenses; only approved trip/session data feeds reports.
4. **Support role-based workflows** – Admin, Owner, Head Supervisor, Accountant, Assistant Supervisor, Surveyor, Driver (truck), Operator (machine); each role has the right tabs and actions.
5. **Improve accountability** – GPS work photos, issue reporting, survey and trip approval so operations are auditable.

To develop without error: use **TRIP_LIFECYCLE_DB.md** and the migration for DB/RLS, **TRIP_APP_FLOWS.md** for trip flows, and **this audit** for screens and files.

---

## 3. End-to-End: What You Are Working On (High-Level Flow)

| Step | What happens | Where in the app |
|------|----------------|------------------|
| 1 | User opens app → Login or main app | `app/index.tsx` → `LoginScreen` or `AppNavigation` |
| 2 | After login, role decides tabs and dashboard | `lib/rbac.ts` → `AppNavigation` → `RoleBasedDashboard` → role-specific dashboard |
| 3 | **Driver:** Start trip (truck) with GPS photo (speedometer), optional load/fuel | **Trips** tab → `DriverTripsScreen` → start flow (GPS via `getCurrentPositionWithTimeout`, photo upload, `tripLifecycle`) |
| 4 | **Driver:** End trip with GPS photo (or without for machine); trip goes to “need approval” | **Trips** tab → end trip → `refetch(true)` so list updates |
| 5 | **Driver:** Pause & refuel (one tap: pause + refuel modal); Resume from list | **Trips** tab → pause/resume; effective duration = end − start − pause time |
| 6 | **Assistant Supervisor:** Sees “Trip need approval” → View details → Revise (distance, fuel, notes) → Submit → TRIP_COMPLETED | **Tasks** tab → `AssistantSupervisorDashboard` → approval flow |
| 7 | **Owner/Head Supervisor:** Fleet report uses only approved trips (fuel, distance, hours) | Dashboards / Reports; `VehiclesScreen` for vehicle → trip/session detail |
| 8 | Sites, surveys, issues, expenses, users, work photos | Respective tabs and screens (see Sections 4–5) |

Trip lifecycle details: **TRIP_APP_FLOWS.md**. DB/RLS: **TRIP_LIFECYCLE_DB.md** + migration `20250325000000_trip_lifecycle_rls_and_constraints.sql`.

---

## 4. Code Filenames – What Each Does

### 4.1 Entry and layout

| File | What it does |
|------|----------------|
| `app/_layout.tsx` | Root layout: theme, SafeArea, Stack, ErrorBoundary, splash screen. |
| `app/index.tsx` | Auth gate: shows `LoginScreen` or `AppNavigation`; wraps app in Auth, Loading, MockAppStore, Toast, Locale, NotificationNavigation; requests location and notification permission. |

### 4.2 Navigation and role

| File | What it does |
|------|----------------|
| `components/navigation/AppNavigation.tsx` | Top bar (Refresh, Notifications, Logout, Language); bottom tabs by role; renders active tab content (dashboard, reports, tasks, users, sites, vehicles, expenses, surveys, issues, gps_camera, settings). |
| `components/RoleBasedDashboard.tsx` | Picks and renders the correct dashboard component for current user role (Admin, Owner, HeadSupervisor, Accountant, AssistantSupervisor, Driver, Surveyor). |
| `lib/rbac.ts` | Single source of truth for roles and tab access; `canAccessTab`, `getTabsForRole`, `canCreateUser`, `getAssignableRoles`, `isReportsReadOnly`, `canSeeFinancialSummary`. |

### 4.3 Context

| File | What it does |
|------|----------------|
| `context/AuthContext.tsx` | Auth state (user, session, login, logout, auth loading). |
| `context/MockAppStoreContext.tsx` | Main data store: sites, users, vehicles, trips, assigned_trips, expenses, surveys, issues, work photos, notifications; refetch (with throttle); loading. |
| `context/LoadingContext.tsx` | Global loading overlay; `withLoading()` for long actions (e.g. start/end trip). |
| `context/ToastContext.tsx` | Toast messages. |
| `context/LocaleContext.tsx` | Locale and `t()` for i18n. |
| `context/NotificationNavigationContext.tsx` | Register `setActiveTab` so notification deep links can switch tabs. |

### 4.4 Auth UI

| File | What it does |
|------|----------------|
| `components/auth/LoginScreen.tsx` | Email/password login; notification permission; language switcher. Shown when not authenticated. |

### 4.5 Dashboards (one per role)

| File | What it does |
|------|----------------|
| `components/dashboards/AdminDashboard.tsx` | Active sites; budget/spent/remaining/revenue/profit; quick links Reports, Sites, Users; site cards. |
| `components/dashboards/OwnerDashboard.tsx` | Date range; budget/spent/revenue/profit; daily excavation chart; contract rates; site tasks; quick actions. |
| `components/dashboards/HeadSupervisorDashboard.tsx` | Active sites; investment, spent, profit; daily production; links Vehicles, Sites, Reports, Issues; site cards; open SiteTasksScreen read-only. |
| `components/dashboards/AccountantDashboard.tsx` | Read-only financial metrics and per-site breakdown; link to Reports. |
| `components/dashboards/AssistantSupervisorDashboard.tsx` | Assigned sites; daily production; site tasks; need-approval list with Revise/Submit (distance, fuel, notes); assign trip/task; edit driver phone. |
| `components/dashboards/DriverDashboard.tsx` | My assigned trips (truck) or tasks (machine); vehicle allocations; manager contact; link to Trips; report location when not on active trip. |
| `components/dashboards/SurveyorDashboard.tsx` | Pending/approved/rejected counts; my surveys; “New survey” opens Surveys tab. |

### 4.6 Screens (tab or modal content)

| File | What it does |
|------|----------------|
| `components/screens/ReportsScreen.tsx` | Date range; financial summary (if role allowed); operations summary; CSV export; accountant read-only. |
| `components/screens/SettingsScreen.tsx` | Profile; edit profile (DriverProfileScreen); change password; language; notifications; logout. |
| `components/screens/UsersScreen.tsx` | List users; create user (internal email, role, site); edit role/name/phone/active; filter by role/site. |
| `components/screens/SitesScreen.tsx` | Site cards; create site; budget allocation; tap site → SiteDetailScreen. |
| `components/screens/SiteDetailScreen.tsx` | Edit site dates (admin/HS); site assignments; Driver allocation (DriverAllocationScreen); budget. |
| `components/screens/DriverAllocationScreen.tsx` | Select site; assign/unassign vehicles to drivers at site. |
| `components/screens/VehiclesScreen.tsx` | Filter type/status/allocation; add/edit vehicle; sync from website; vehicle detail modal and trip/session detail modal. |
| `components/screens/ExpensesScreen.tsx` | General and fuel expenses; list and delete. |
| `components/screens/DriverTripsScreen.tsx` | Driver: start/end trip (GPS photo), pause and refuel, resume; trip history. AS/HS: switch driver, approval flow. |
| `components/screens/SiteTasksScreen.tsx` | Weighted site tasks; progress and status; AS editable; HS/Owner read-only. |
| `components/screens/SurveysScreen.tsx` | Create survey (files, volume/cubature); list my/pending/approved; revise; AS approve/reject. |
| `components/screens/IssuesScreen.tsx` | Raise issue (site, description, images); list by site; Owner/HS update status. |
| `components/screens/DriverProfileScreen.tsx` | Edit name (owner) and phone; save. Opened from Settings. |
| `features/gpsCamera/GpsCameraScreen.tsx` | Take photo with GPS; select site; upload work photo; open gallery. Used by AS/surveyor (and others with gps_camera tab). |

### 4.7 Tasks and work progress

| File | What it does |
|------|----------------|
| `components/tasks/TaskCard.tsx` | Card for a single task (site task or trip/task assignment). |
| `components/tasks/TaskDetailScreen.tsx` | Task detail; start, update progress, complete. |
| `components/workProgress/WorkProgressGalleryScreen.tsx` | Paginated work photos; tap → WorkPhotoDetailModal. |
| `components/workProgress/WorkPhotoDetailModal.tsx` | Full-screen photo, map preview, EXIF, uploader, site. |
| `components/workProgress/MapPreview.tsx` | Map preview for photo location. |

### 4.8 UI components

| File | What it does |
|------|----------------|
| `components/ui/Header.tsx` | Screen header. |
| `components/ui/Card.tsx` | Card container. |
| `components/ui/Button.tsx` | Button. |
| `components/ui/Input.tsx` | Text input. |
| `components/ui/DatePickerField.tsx` | Date picker. |
| `components/ui/Select.tsx` | Select/dropdown. |
| `components/ui/FilterChips.tsx` | Filter chips. |
| `components/ui/Badge.tsx` | Badge. |
| `components/ui/EmptyState.tsx` | Empty state. |
| `components/ui/FormModal.tsx` | Form in modal. |
| `components/ui/ModalWithKeyboard.tsx` | Modal that plays well with keyboard. |
| `components/ui/NotificationsModal.tsx` | List notifications; mark read; deep-link to tab. |
| `components/ui/DashboardLayout.tsx` | Layout for dashboard screens. |
| `components/ui/ScreenContainer.tsx` | Screen wrapper. |
| `components/ui/SkeletonLoader.tsx` | Skeleton loading. |
| `components/ui/ProgressBar.tsx` | Progress bar. |
| `components/ui/LanguageSwitcher.tsx` | Language switcher. |
| `components/ui/Loader.tsx` | Loader/spinner. |
| `components/sites/SiteCard.tsx` | Card for a site. |

### 4.9 Lib (logic, API, helpers)

| File | What it does |
|------|----------------|
| `lib/rbac.ts` | Role and tab permissions (see 4.2). |
| `lib/tripLifecycle.ts` | Start trip, end trip, pause, resume, approval; effective duration; trip/session updates. |
| `lib/supabase.ts` | Supabase client. |
| `lib/supabaseMappers.ts` | Map DB rows to app types. |
| `lib/currency.ts` | Currency formatting. |
| `lib/id.ts` | ID generation. |
| `lib/dateValidation.ts` | Date validation. |
| `lib/getCurrentPositionWithTimeout.ts` | GPS with timeout and retry (used for start/end trip and work photos). |
| `lib/workPhotoUpload.ts` | Upload work photo (compress, upload to storage, link to trip/record). |
| `lib/workPhotoExif.ts` | EXIF from photo. |
| `lib/compressIssueImage.ts` | Compress issue image. |
| `lib/staticMapUri.ts` | Static map URL for photo location. |
| `lib/surveyParser.ts` | Parse survey file. |
| `lib/readSurveyFile.ts` | Read survey file. |
| `lib/notificationScenarios.ts` | When to create which notifications. |
| `lib/notificationDeepLink.ts` | Map notification to tab/params. |
| `lib/registerPushToken.ts` | Register push token. |
| `lib/i18n.ts` | i18n helpers. |

### 4.10 Features / GPS camera

| File | What it does |
|------|----------------|
| `features/gpsCamera/GpsCameraScreen.tsx` | See 4.6. |
| `features/gpsCamera/useGpsLocation.ts` | Hook for current GPS. |
| `features/gpsCamera/uploadToSupabase.ts` | Upload to Supabase storage. |
| `features/gpsCamera/saveGpsRecord.ts` | Save GPS record. |
| `features/gpsCamera/reverseGeocodeOSM.ts` | Reverse geocode (OSM). |
| `features/gpsCamera/generateOSMStaticMap.ts` | OSM static map. |
| `features/gpsCamera/generateStaticMap.ts` | Static map generation. |
| `features/gpsCamera/GpsOverlay.tsx` | GPS overlay on camera. |

### 4.11 Types, theme, locales, backend, config

| File | What it does |
|------|----------------|
| `types/index.ts` | Shared TypeScript types (UserRole, etc.). |
| `theme/tokens.ts` | Colors, dimensions. |
| `theme/responsive.ts` | Responsive theme hook. |
| `locales/en.ts` | English strings. |
| `locales/rn.ts` | React Native / app strings. |
| `supabase/migrations/20250325000000_trip_lifecycle_rls_and_constraints.sql` | RLS and constraints for trips and assigned_trips so drivers can end trips and set TRIP_NEED_APPROVAL. |
| `supabase/functions/send-push-on-notification` | Send push when notification is created. |
| `supabase/functions/create_user_by_owner` | Create user (e.g. by owner). |
| `app.json` | Expo/app config. |

---

## 5. Screens – What Each Does (Quick Reference)

| Screen | What it does |
|--------|----------------|
| **LoginScreen** | Email/password login; notification permission; language switcher. Shown when not authenticated. |
| **AppNavigation** | Top bar (Refresh, Notifications, Logout, Language); tab content; bottom tab bar by role. |
| **AdminDashboard** | Active sites; budget/spent/remaining/revenue/profit; quick links Reports, Sites, Users; site cards. |
| **OwnerDashboard** | Date range; budget/spent/revenue/profit; daily excavation chart; contract rates; site tasks; quick actions. |
| **HeadSupervisorDashboard** | Active sites; investment, spent, profit; daily production; links Vehicles, Sites, Reports, Issues; site cards; open SiteTasksScreen read-only. |
| **AccountantDashboard** | Read-only financial metrics and per-site breakdown; link to Reports. |
| **AssistantSupervisorDashboard** | Assigned sites; daily production; site tasks; need-approval list with Revise/Submit (distance, fuel, notes); assign trip/task; edit driver phone. |
| **DriverDashboard** | My assigned trips (truck) or tasks (machine); vehicle allocations; manager contact; link to Trips; report location when not on active trip. |
| **SurveyorDashboard** | Pending/approved/rejected counts; my surveys; New survey opens Surveys tab. |
| **ReportsScreen** | Date range; financial summary (if role allowed); operations summary; CSV export; accountant read-only. |
| **SettingsScreen** | Profile; edit profile (DriverProfileScreen); change password; language; notifications; logout. |
| **UsersScreen** | List users; create user (internal email, role, site); edit role/name/phone/active; filter by role/site. |
| **SitesScreen** | Site cards; create site; budget allocation; tap site to SiteDetailScreen. |
| **SiteDetailScreen** | Edit site dates (admin/HS); site assignments; Driver allocation (DriverAllocationScreen); budget. |
| **DriverAllocationScreen** | Select site; assign/unassign vehicles to drivers at site. |
| **VehiclesScreen** | Filter type/status/allocation; add/edit vehicle; sync from website; vehicle detail and trip/session detail modals. |
| **ExpensesScreen** | General and fuel expenses; list and delete. |
| **DriverTripsScreen** | Driver: start/end trip (GPS photo), pause and refuel, resume; trip history. AS/HS: switch driver, approval flow. |
| **SiteTasksScreen** | Weighted site tasks; progress and status; AS editable; HS/Owner read-only. |
| **SurveysScreen** | Create survey (files, volume/cubature); list my/pending/approved; revise; AS approve/reject. |
| **IssuesScreen** | Raise issue (site, description, images); list by site; Owner/HS update status. |
| **GpsCameraScreen** | Take photo with GPS; select site; upload work photo; open gallery. |
| **DriverProfileScreen** | Edit name (owner) and phone; save. From Settings. |
| **WorkProgressGalleryScreen** | Paginated work photos; tap to WorkPhotoDetailModal. |
| **WorkPhotoDetailModal** | Full-screen photo, map preview, EXIF, uploader, site. |
| **TaskDetailScreen** | Task detail; start, update progress, complete. |
| **NotificationsModal** | List notifications; mark read; deep-link to tab. |

---

## 6. Tab Access by Role (lib/rbac.ts)

| Tab | Roles with access |
|-----|-------------------|
| dashboard | All 8 roles |
| reports | admin, owner, head_supervisor, accountant |
| tasks | assistant_supervisor, driver_truck, driver_machine |
| users | admin, owner, head_supervisor |
| sites | admin, head_supervisor |
| vehicles | admin, owner, head_supervisor, assistant_supervisor |
| expenses | assistant_supervisor |
| surveys | admin, owner, head_supervisor, assistant_supervisor, surveyor |
| issues | owner, head_supervisor, assistant_supervisor, driver_truck, driver_machine |
| gps_camera | owner, head_supervisor, assistant_supervisor, surveyor |
| settings | All 8 roles |

---

## 7. End-to-End Consistency Checklist

1. **Trip lifecycle** – Follow TRIP_APP_FLOWS.md (start with GPS photo for truck, end, pause and refuel, resume, AS approval).
2. **DB and RLS** – Apply migration `20250325000000_trip_lifecycle_rls_and_constraints.sql`; match TRIP_LIFECYCLE_DB.md.
3. **Roles and tabs** – Use lib/rbac.ts for all tab and permission checks.
4. **GPS** – Use getCurrentPositionWithTimeout for start/end trip and work photos.
5. **Refetch** – After end trip use refetch(true); other refetches respect throttle.
6. **Loading** – Long actions use global withLoading().
7. **i18n** – All user-facing strings use t(key) from locales.

---

## 8. Lightweight Architecture Compliance (Trip / Machine)

The app follows a **lightweight, event-based** design: no continuous GPS, no heavy uploads, no background polling. Below is how the codebase aligns with that spec.

### 8.1 Core principle

| Spec | Status | Notes |
|------|--------|--------|
| Only 3 events: START, PAUSE/RESUME, END | Yes | Driver start → TRIP_STARTED; pause/resume → TRIP_PAUSED / TRIP_RESUMED; end → TRIP_NEED_APPROVAL. |
| GPS only at start and end | Yes | Start: `start_lat`/`start_lon` on trip create; end: `end_lat`/`end_lon` on end (or `getCoordsForTripEnd` fallback). No continuous tracking. |
| No continuous tracking | Yes | `current_lat`/`current_lon` exist for optional live display only; app does not stream or poll. |

### 8.2 Truck trip flow (km/L)

| Spec | Status | Notes |
|------|--------|--------|
| Start: camera (speedometer) before timer | Yes | Driver takes GPS photo → compress 50KB → upload to work_photos → trip created with `start_photo_uri`, `start_lat`, `start_lon`, timer starts. |
| Start: 2 photos (speedometer + fuel gauge) | Partial | One photo (speedometer) required; fuel gauge can be added as second photo later if needed. |
| Compress to 50KB | Yes | `lib/workPhotoUpload.ts` MAX_PHOTO_BYTES = 50*1024 for trip proof. |
| Store start_photo, gps, timestamp | Yes | Trip has `start_photo_uri`, `start_lat`, `start_lon`, `start_time`; end has `photo_uri`, `end_lat`, `end_lon`, `end_time`. Start photo no longer overwritten by end (migration `20250327000000_trips_start_photo_uri.sql`). |
| Pause/Resume → pause_segments | Yes | `assigned_trips.pause_segments` (jsonb); effective duration = end − start − pause time. |
| End: take photo → NEED_APPROVAL | Yes | End trip modal: optional end photo (camera-only, GPS on confirm); then `updateTrip` + `updateAssignedTripStatus(TRIP_NEED_APPROVAL)`. |
| Supervisor: see start/end photo, GPS, duration | Yes | Trip has `startPhotoUri` and `photoUri`; AS detail can show both; distance/fuel editable in Revise. |
| Supervisor enters Start KM, End KM | Partial | AS can **edit distance (km)** and fuel in Revise; distance is not yet “start_km / end_km” fields (same outcome: supervisor-approved distance). |
| Fuel = distance / mileage (km/L) | Yes | DB trigger `on_trip_completed`: `fuel_consumed = distance_km / mileage_km_per_litre`; vehicle has `mileage_km_per_litre`. |

### 8.3 Machine flow (hours/L)

| Spec | Status | Notes |
|------|--------|--------|
| Start: hour meter + fuel photo; timer starts | Partial | Machine session start exists; “hour meter photo” and start_reading not yet separate fields (session has start_time). |
| End: hour meter + fuel photo; supervisor start/end hours | Partial | Machine end uses duration from start_time/end_time; supervisor can revise; no separate start_hours/end_hours fields yet. |
| fuel_used = hours_used × consumption (L/hour) | Yes | Trigger: `duration_hours = end_time − start_time`, `fuel_consumed = duration_hrs / hours_per_litre` (vehicle has `hours_per_litre`). |

### 8.4 Database (lightweight)

| Spec | Status | Notes |
|------|--------|--------|
| assigned_trips: status, started_at, ended_at, pause_segments | Yes | All present. |
| start_photo, end_photo, start_gps, end_gps | Yes | On **trips**: `start_photo_uri`, `photo_uri` (end), `start_lat/lon`, `end_lat/lon`. |
| distance_km, fuel_used_l | Yes | `trips.distance_km`, `trips.fuel_consumed` (and trigger). |
| ~5 writes per trip | Yes | Start (insert trip + update assigned); pause; resume; end (update trip + update assigned); approve (update trip + assigned). |

### 8.5 Performance

| Spec | Status | Notes |
|------|--------|--------|
| Images compress to 50KB | Yes | `workPhotoUpload.ts`. |
| GPS only start & end | Yes | No live tracking. |
| Local timer, no server polling | Yes | Timer is local; refetch on start/end/pause/resume. |

### 8.6 Role visibility

| Role | Access | Implemented |
|------|--------|------------|
| Driver | Own trips | Yes (driver_id filter). |
| Assistant Supervisor | Site trips | Yes (site_assignments). |
| Head Supervisor / Owner | All / global | Yes (RBAC). |

**Summary:** The codebase is **largely aligned** with the lightweight spec: event-based trips, GPS only at start/end, 50KB photos, pause_segments, fuel from distance/mileage or hours/hours_per_litre. Gaps: (1) Start/end could support a second “fuel gauge” photo if required; (2) Supervisor distance is “edit distance” rather than separate Start KM / End KM fields; (3) Machine flow could add explicit start_reading/end_reading and supervisor-entered hours for parity with spec.

---

## 9. Summary

- **What:** Hapyjo Ltd – field and fleet app for sites, trips, machine sessions, surveys, expenses, issues, work photos; role-based dashboards and tabs.
- **Why:** Manage sites and fleet, track trips/sessions with GPS proof and approval, control costs, keep operations auditable.
- **Use at the end:** Run field and fleet operations, prove and approve work with GPS, control costs and accountability, manage sites end-to-end.
- **How to keep correct:** This audit for screens and files; TRIP_APP_FLOWS.md for trip flows; TRIP_LIFECYCLE_DB.md and migrations for DB/RLS; lib/rbac.ts for role/tab logic. Section 8 documents lightweight architecture compliance.
