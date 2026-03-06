# Trip & fleet app – full flows (lightweight, real-time)

This doc describes how the app works end-to-end so you can use it correctly and extend it without gaps.

---

## 1. Driver: start trip (truck)

- Driver opens **Trips** tab, taps **Start trip**.
- **Vehicle**: picks one of their assigned trucks.
- **GPS photo (required for truck)**:
  - Tap **Take GPS photo to start** → camera opens.
  - Photo must include **speedometer (odometer)** in frame (hint shown).
  - App gets **lat/long** (GPS + optional EXIF), then **compresses** the image (30–50 KB) and **uploads** to work_photos; same photo is linked to the trip as start proof.
- Optional: load quantity, fuel filled at start.
- Tap **Start** → trip is created with `status: in_progress`, `start_lat`, `start_lon`, and assigned trip moves to **TRIP_STARTED**. List refreshes (real-time via refetch).

**No GPS errors:** App uses `getCurrentPositionWithTimeout` (12s timeout + retry with lower accuracy). If location fails, a clear message is shown and the user can retry.

---

## 2. Driver: end trip (truck)

- With an active trip, driver taps **End trip**.
- **End trip modal**:
  - **Option A:** Tap **Take GPS photo & end trip** → camera → photo with **speedometer** → then **End trip with this photo**. App compresses and uploads the photo with **lat/long**, then ends the trip (writes `end_time`, `end_lat`, `end_lon`, `distance_km`, `status: completed`, `photo_uri`). If upload fails, trip still ends and a toast says “Trip ended. Photo could not be uploaded.”
  - **Option B:** **End without photo** (machine only; for truck, photo is required in the UI flow).
- Trip row is updated; assigned trip moves to **TRIP_NEED_APPROVAL**. UI refreshes immediately (`refetch(true)`).

**Time:** Trip time is **start → end minus pause time** (see below). Duration is computed with `getEffectiveDurationHours(startTime, endTime, pauseSegments)` everywhere it’s shown.

---

## 3. Driver: pause & mid-shift refuel (same button)

- With an active trip (TRIP_STARTED / TRIP_IN_PROGRESS / TRIP_RESUMED), driver taps **Pause & refuel**:
  1. Assigned trip status is set to **TRIP_PAUSED** (pause segment is recorded).
  2. **Refuel modal** opens in the same tap: driver enters litres and optional cost/litre; submit adds an expense and updates vehicle fuel balance.
- Driver can **Resume** from the trip list (e.g. “Resume” button when status is TRIP_PAUSED) → status becomes **TRIP_RESUMED** (and system can move it to TRIP_IN_PROGRESS after a short delay).
- **Effective duration** = end time − start time − sum of (pause segment lengths). So pause time is excluded from “trip time” everywhere (history, AS detail, reports).

---

## 4. Assistant Supervisor: after driver ends trip

- **Trips / Assignments** section shows trips and tasks with status **Trip need approval** (or Task need approval).
- AS taps **View details** on a need-approval row:
  - **Detail modal** opens with:
    - Vehicle, driver, start/end time, **effective duration** (excluding pause), distance, fuel.
    - Notes (editable in Revise).
- **Revise:** AS taps **Revise** → can edit notes, **distance (km)**, **fuel (L)**. Preview stays in sync.
- **Submit:** AS taps **Submit** → app updates the trip (or machine session) with the revised distance/fuel/notes, then sets assigned trip to **TRIP_COMPLETED** (or TASK_COMPLETED). That trip is now “approved by AS”.

All of this is available from the **same assignment cards**; no separate vehicle screen is required for approval. The vehicle card (Vehicles tab) is for viewing history per vehicle.

---

## 5. Vehicle card (full details)

- **Vehicles** tab: user taps a vehicle card → **vehicle detail modal** with that vehicle’s trips and machine sessions.
- Tapping a **trip/session row** opens a **second modal** with full read-only trip/session details (start, end, duration, distance, fuel, approved state, etc.). So owner/HS/AS can open vehicle → open a trip → see everything that was approved.

---

## 6. Owner & Head Supervisor: fuel, mileage, approved data

- **Fleet & trips (approved)** section uses only **TRIP_COMPLETED** and **TASK_COMPLETED** assigned trips and their linked trips/sessions.
- It shows:
  - **Total fuel** (sum of fuel consumed on completed trips/sessions in range).
  - **Total distance** and **total hours** (effective duration).
  - Copy like “Approved by supervisor” so it’s clear the numbers are post-AS approval.

All calculations use the same `getEffectiveDurationHours` and the same trip/session rows that AS approved.

---

## 7. Driver: fuel and trip info

- Driver sees **fuel balance** (e.g. on vehicle or trip card) where the app displays it.
- **Trip history** shows per-trip distance, fuel consumed, duration (effective), and “photo attached” when a GPS photo was uploaded.

---

## Real-time and performance (lightweight, no lag)

- **Refetch throttle:** 30 seconds so the app doesn’t hammer the backend. After **end trip**, the app calls `refetch(true)` once so the list updates immediately without waiting for the throttle.
- **Live position:** During an active trip, driver position is pushed every 30s (configurable) with a short timeout so GPS doesn’t block the UI. Failures are ignored for that tick.
- **Global loader:** Long actions (start trip, end trip with photo, end without photo) use the global `withLoading()` so the user sees a single centered spinner and no duplicate loading states.
- **GPS:** All location calls go through `getCurrentPositionWithTimeout` (timeout + retry with lower accuracy) to avoid “Could not get current position” where possible. Errors show a clear message instead of a generic one.

---

## Summary table

| Who            | Action                    | What happens |
|----------------|---------------------------|--------------|
| Driver         | Start trip (truck)         | GPS photo (speedometer) required; compress + upload with lat/long; trip created, TRIP_STARTED. |
| Driver         | End trip                  | GPS photo (speedometer) optional for truck in UI; compress + upload; trip completed, TRIP_NEED_APPROVAL. |
| Driver         | Pause & refuel            | One tap: TRIP_PAUSED + refuel modal opens. |
| Driver         | Resume                    | TRIP_RESUMED from trip list. |
| Driver         | See fuel / history        | Fuel balance and trip history with effective duration and fuel. |
| AS             | After driver ends         | Sees “Trip need approval”; View details → full vehicle/driver/trip; Revise (notes, distance, fuel) → Submit → TRIP_COMPLETED. |
| Owner / HS     | Fleet report              | Total fuel, distance, hours from approved trips/sessions. |
| Any (vehicle) | Click vehicle             | Vehicle modal → click trip/session row → full trip/session detail. |

Your app already implements this. Use this doc as the single source of truth for flows and for any new feature (e.g. extra validations or reports) so everything stays consistent and without gaps.

---

## See also

- **APPLICATION_AUDIT.md** – Full application audit: why the app exists, all code files, every screen and what it does, tab access by role, end-to-end consistency checklist.
