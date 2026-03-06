# System Audit & Fix Plan — Fleet & Site Operations

## Phase 1 — Audit Findings

### GPS failure points
- **Trip end**: `getCoordsWithTimeout` could throw when no cache → driver sees "GPS Error" / "Failed to end trip" even when DB failed.
- **No fallback to start coords**: Spec requires "if GPS fails → fallback to start coords" for trip end; not implemented.
- **Single utility**: `getCurrentPositionWithTimeout.ts` exists; add trip-end-specific helper that never throws (fallback chain).

### Race conditions & double-submit
- **Start trip**: `startTripInProgressRef` guards; duplicate trip prevented by "already active" check. OK.
- **End trip**: `endTripInProgressRef` guards. OK.
- **Assigned trip card**: Opens modal only; single create path in `handleStartTrip`. OK.
- **updateTrip/updateAssignedTripStatus**: No idempotency key; retry could double-apply. Mitigation: safeDbWrite retry only on network, not on success.

### Trip lifecycle state mismatches
- **Context** uses `canTransition()` before updating assigned_trips. Good.
- **DriverTripsScreen** does not verify trip exists or status before end; no guard that assignment is in progress before update.
- **Missing**: Explicit "can end trip" check (trip in_progress, assignment STARTED/PAUSED/RESUMED/IN_PROGRESS, user owns both).

### Supabase update failure risks
- Direct `supabase.from().insert/update` throughout MockAppStoreContext; errors thrown as-is; no retry; no structured error type.
- **addTrip**: On error, falls back to offline queue and optimistic state; does not throw. **updateTrip** throws.
- **updateAssignedTripStatus** throws. **addWorkPhoto** throws.
- RLS: **work_photos** INSERT allows only surveyor + assistant_supervisor → **drivers cannot insert work_photos** (trip proof upload will fail).

### Missing error handling
- **handleEndTrip** catch uses `alert_gps_error` for all errors (including DB/network) → misleading.
- Silent promise failures: notification inserts in context are fire-and-forget (no catch); acceptable for non-critical path.
- **uploadWorkPhoto**: No retry on network failure.

### Refetch
- **refetch(true)** after start/end; throttle 30s otherwise. No refetch loop identified.
- **addTrip** and **updateTrip** call **refetch()** (no force) after write → can cause double refetch when DriverTripsScreen also calls refetch(true). Standardized: refetch only at lifecycle boundaries from screen; context refetch after write can stay for realtime sync.

### UI freeze risks
- GPS runs inside withLoading; no synchronous blocking. OK.
- No continuous GPS or polling. OK.

### Async ordering
- End flow: upload photo → addWorkPhoto → handleEndTrip(photoUrl, lat, lon). If addWorkPhoto fails, we still call handleEndTrip with lat/lon and photoUrl undefined. OK. Upload-before-DB is desired; currently we upload then insert work_photo then update trip — correct.

### RLS-blocked writes
- **trips**: Policy "Trips write by drivers and management" allows driver_truck, driver_machine. OK.
- **assigned_trips**: "Driver update own assigned_trips" (driver_id = auth.uid()). OK.
- **work_photos**: INSERT only surveyor + assistant_supervisor → **drivers blocked**. Fix: add policy for driver_truck/driver_machine to INSERT own row.

### Inconsistent status transitions
- Lifecycle in tripLifecycle.ts is correct (ASSIGNED→STARTED→…→NEED_APPROVAL→COMPLETED). RESUMED→IN_PROGRESS is system. Context uses canTransition. No UI path for invalid transition except if data is stale.

### Missing optimistic UI
- Pause/Resume: single update to assigned_trips; no optimistic toggle. Spec says "optimistic UI only for pause/resume" — optional improvement; not required for stability.

---

## Fix Plan Summary

| Phase | Action |
|-------|--------|
| 2 | GPS: Add `getCoordsForTripEnd(photoCoords?, startCoords?)` — never throw; chain photo → high-accuracy → cached → start. Use in handleEndTrip. |
| 3 | Lifecycle: Add `canEndTrip(trip, assignment, userId)`, `assertValidTransition`; call before end and in context. |
| 4 | Add `lib/safeDbWrite.ts`: wrap execute with try/catch, retry once on network, classify RLS/permission/schema/network, return `{ ok, error?: DbError }`. Use for trips.insert/update, assigned_trips.update, work_photos.insert (trip flow). |
| 5 | RLS: Migration to allow drivers to INSERT work_photos (uploaded_by = auth.uid(), role driver_truck/driver_machine). |
| 6 | workPhotoUpload: Retry upload once on failure; keep compression ≤120KB; upload before DB (already so). |
| 7 | No new polling/timers; refetch only at boundaries; already compliant. |
| 8 | Error categories: Add `lib/errorCategories.ts` and locale keys (Location, Network, Permission, Server, Validation). In DriverTripsScreen and context, map errors to category and show correct title. |
| 9 | Before updateTrip/updateAssignedTripStatus: confirm trip/assignment exists, user owns, status valid (via tripLifecycle guards). |
| 10 | Refactor DriverTripsScreen: use getCoordsForTripEnd, categorized alerts, lifecycle guards; context: use safeDbWrite for trip/assignment/work_photo writes. |

---

## Files to Create/Modify

- **Create**: `docs/FIX_PLAN.md`, `lib/safeDbWrite.ts`, `lib/errorCategories.ts`, `supabase/migrations/YYYYMMDD_work_photos_driver_insert.sql`
- **Modify**: `lib/getCurrentPositionWithTimeout.ts`, `lib/tripLifecycle.ts`, `lib/workPhotoUpload.ts`, `locales/en.ts`, `locales/rn.ts`, `components/screens/DriverTripsScreen.tsx`, `context/MockAppStoreContext.tsx`
