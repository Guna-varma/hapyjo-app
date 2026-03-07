# Trip start / end logic and calculations

This document describes the **start trip** and **end trip** flows (trucks) and the **formulas** used for distance, duration, and related values.

---

## 1. Start trip logic

**When:** Driver taps “Start” on an assigned trip (or standalone start when no assignment).

### Preconditions

- **One trip at a time:** No other trip for this driver with `status = 'in_progress'`.
- **Truck:** Start photo is required (captured before or at start).
- **Vehicle & site:** Selected vehicle exists; site = vehicle’s site or first of driver’s sites.

### Steps (in order)

1. **Guard:** If `startTripInProgressRef` or already active trip → abort (alert: “one trip at a time”).
2. **Truck + photo:** If truck and start photo exists:
   - Validate/compress photo (e.g. max 120KB) and get URI.
   - Request location permission; if not granted → show permission modal and abort.
   - Get GPS with `getCoordsWithTimeout` (no cache, high accuracy, e.g. 10s timeout) → `startLat`, `startLon`.
   - Upload photo to storage; create `work_photos` row (photo URL, thumbnail, lat, lon, site, uploader).
3. **No photo (e.g. machine):** Request location; get GPS → `startLat`, `startLon`.
4. **Fuel at start (optional):** If “fuel filled at start” value > 0, update vehicle’s `fuelBalanceLitre += filled`.
5. **Trip row:** Insert into `trips`:
   - `id`, `vehicle_id`, `driver_id`, `site_id`, `start_time` = now, `distance_km` = 0,
   - `status` = `'in_progress'`, `start_lat`, `start_lon`, optional `start_photo_uri`, `load_quantity`, `fuel_filled_at_start`, `created_at`.
6. **Assignment sync:** If there is an `assigned_trip` for this driver + vehicle with status `TRIP_ASSIGNED` or `TRIP_PENDING`, call `updateAssignedTripStatus(id, 'TRIP_STARTED')` (sets `started_at`). Best-effort: if it fails, trip is still created.
7. **UI:** Close start modal, clear form/photo, `refetch(true)`.

### DB after start

- **`trips`:** One row with `status = 'in_progress'`, `start_time`, `start_lat`, `start_lon`, `distance_km = 0`, optional `start_photo_uri`.
- **`assigned_trips`:** Matching row (if any) → `status = 'TRIP_STARTED'`, `started_at` = now.

---

## 2. End trip logic

**When:** Driver taps “End trip” and confirms (with mandatory end photo for trucks).

### Preconditions

- **Trip:** There is an active trip for the driver (`trips.status = 'in_progress'`).
- **Can end:** `canEndTrip(trip, assignment, userId)` is true:
  - Trip is in progress and owned by user.
  - If there is an assignment: its phase is one of STARTED, PAUSED, RESUMED, IN_PROGRESS (not ASSIGNED/PENDING and not already NEED_APPROVAL/COMPLETED).

### Steps (in order)

1. **End coordinates:** If not provided (e.g. from photo EXIF):
   - Get GPS via `getCoordsForTripEnd` (optional `startCoords`, timeout e.g. 10s) → `endLat`, `endLon`.
2. **Distance (haversine):**
   - `startLat` / `startLon` = trip’s start or fallback to end coords.
   - `distanceKm = haversineKm(startLat, startLon, endLat, endLon)` rounded to 2 decimals; if ≤ 0 set to `0.01` (DB constraint).
3. **Timestamps:** `endTime` = now (ISO).
4. **Update `trips`:** Patch with:
   - `start_lat`, `start_lon` (for completed check),
   - `end_time`, `end_lat`, `end_lon`, `distance_km`, `status` = `'completed'`,
   - optional `photo_uri` (end photo), `current_lat`/`current_lon` = null.
5. **Assignment:** If matching `assigned_trip` exists (driver + vehicle, status in TRIP_STARTED / TRIP_IN_PROGRESS / TRIP_RESUMED), call `updateAssignedTripStatus(id, 'TRIP_NEED_APPROVAL')`. Best-effort.
6. **Optimistic UI:** Context merges patch into local trip so “in progress” card disappears immediately.
7. **Refetch:** `refetch(true)` to sync list and assignments.

### Pause / resume times stored in DB (for calculations)

**Table: `assigned_trips`**

- **`started_at`** (timestamptz) – when the driver started the trip.
- **`paused_at`** (timestamptz) – when the trip was last paused.
- **`resumed_at`** (timestamptz) – when the trip was last resumed.
- **`pause_segments`** (jsonb) – array of `{ started_at, ended_at }` for **each** pause interval. This is the source of truth for duration: each segment’s length is `ended_at - started_at`; the sum of all segments is the total pause time to subtract from (end_time − start_time).

On **Pause**, the app adds a new segment with `started_at = now`, `ended_at = now` (updated on Resume). On **Resume**, it sets `resumed_at = now` and closes the last segment with `ended_at = now`. All of this is persisted via `updateAssignedTripStatus`, so effective duration and reports use server-stored times, not frontend timers.

---

### DB constraint (completed trips)

For `trips.status = 'completed'` the DB requires:

- `start_lat`, `start_lon`, `end_lat`, `end_lon`, `distance_km` all NOT NULL.
- `distance_km > 0` (app sends minimum 0.01 if haversine ≤ 0).

---

## 3. Calculations

### 3.1 Distance (haversine, km)

Used for **trip distance** at end (start → end).

```
R = 6371  // Earth radius in km
dLat = (lat2 - lat1) * π / 180
dLon = (lon2 - lon1) * π / 180
a = sin²(dLat/2) + cos(lat1) * cos(lat2) * sin²(dLon/2)
c = 2 * atan2(√a, √(1−a))
distance_km = R * c
```

- **Rounding:** Stored as rounded to 2 decimals; if ≤ 0 then use **0.01** (to satisfy `distance_km > 0`).
- **Source:** `DriverTripsScreen` → `haversineKm(startLat, startLon, endLat, endLon)`.

### 3.2 Effective duration (hours, excluding pause)

Used for **trip duration** in reports and trip list (duration “excl. pause”).

- **Formula:**  
  `effective_duration_hours = (endTime - startTime) - total_pause_time`  
  where `total_pause_time` is the sum of all `pause_segments` lengths (`endedAt - startedAt`).
- **Implementation:** `getEffectiveDurationHours(startTime, endTime, pauseSegments)` in `lib/tripLifecycle.ts`.
- **Usage:** Trip list (driver), Assistant Supervisor dashboard, approval modal. Always use this for “duration” when pause segments exist.

### 3.3 Elapsed time while running (seconds, excluding pause)

Used for the **live “Elapsed”** on an in-progress or paused assigned trip.

- **Formula:**  
  `elapsed_seconds = (now - startedAt) - total_pause_ms` (then convert to seconds, floor).
- **Pause segments:** For each segment, if `endedAt` is set use it; else use `now` (segment still open).
- **Implementation:** `getAssignedTripElapsedSeconds(a)` in `DriverTripsScreen` (uses `a.startedAt`, `a.pauseSegments`).

### 3.4 Speed (km/h)

- **Formula:** `km_per_hour = distance_km / effective_duration_hours` when trip is completed and `effective_duration_hours > 0`.
- **Usage:** Shown on completed trip cards (e.g. “X h · Y km/h”).

### 3.5 Aggregates (driver stats)

- **Total distance (trips):** Sum of `trips.distance_km` for completed trips (`status = 'completed'`) for that driver.
- **Total duration (trips):** Sum of `getEffectiveDurationHours(startTime, endTime, pauseSegments)` per trip (or equivalent).
- **Total fuel (trips):** Sum of `trips.fuel_consumed` for completed trips.
- **Today / month / all-time:** Filter completed trips by `start_time` (day key, month key, or all); then sum distance / count / fuel as needed.

### 3.6 Machine sessions (for comparison)

- **Duration:** `duration_hours = (end_time - start_time) / (1000 * 60 * 60)` (no pause segments in current machine flow).
- **Stored:** `machine_sessions.duration_hours` set on end.

---

## 4. Summary table

| What                | Source / formula |
|---------------------|------------------|
| Trip distance       | `haversineKm(start_lat, start_lon, end_lat, end_lon)`, min 0.01 km |
| Trip duration (h)   | `getEffectiveDurationHours(startTime, endTime, pauseSegments)` |
| Elapsed (running)   | `(now - startedAt) - pause_total_ms` → seconds |
| Speed (km/h)        | `distance_km / effective_duration_hours` |
| Total distance      | Sum of `distance_km` over completed trips |
| Total fuel          | Sum of `fuel_consumed` over completed trips |

---

## 5. Key files

- **Start/end flow:** `components/screens/DriverTripsScreen.tsx` (start modal submit, `handleEndTrip`, `endTripWithGpsPhoto`).
- **Lifecycle & duration:** `lib/tripLifecycle.ts` (`canEndTrip`, `canStartTrip`, `getEffectiveDurationHours`).
- **DB writes:** `context/MockAppStoreContext.tsx` (`addTrip`, `updateTrip`, `updateAssignedTripStatus`).
- **Constraint:** `supabase/migrations/20250325000000_trip_lifecycle_rls_and_constraints.sql` (`trips_completed_gps_check`).
