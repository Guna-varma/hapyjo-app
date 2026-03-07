# Trip flow: Driver (photo start/end) → Assistant Supervisor approval

No GPS for now. Driver completes the trip with start and end speedometer photos. Assistant Supervisor approves using readings and vehicle mileage for approximate fuel.

---

## 1. Driver: Start trip with image

1. Driver opens **My trips** and sees assigned trip (e.g. **Trip assigned**).
2. Driver taps **Start trip**.
3. App opens **camera** → Driver captures **speedometer photo** (start).
4. Photo is uploaded (e.g. compressed ~50KB).
5. Trip **starts**:
   - `assigned_trips`: `status = TRIP_STARTED`, `started_at = now`, `start_photo_url = <uploaded URL>`.
6. **Timer** runs locally (elapsed time on screen). Driver can **Pause** / **Resume** as needed.

**No GPS** in this step.

---

## 2. Driver: End trip with screenshot / photo

1. Driver taps **Complete** (End trip).
2. App opens **camera** again → Driver captures **speedometer photo** (end).
3. Photo is uploaded.
4. Trip is **ended by driver**:
   - `assigned_trips`: `status = TRIP_NEED_APPROVAL`, `ended_at = now`, `end_photo_url = <uploaded URL>`.
5. Driver sees e.g. **“Trip need approval”** (trip completed from driver side).

**No GPS** in this step.

---

## 3. Assistant Supervisor: Notification

- When status becomes **TRIP_NEED_APPROVAL**, system sends a **notification** to the Assistant Supervisor:
  - e.g. *“Trip ended. Can you approve?”* (or similar).
- AS opens the app and sees trips waiting for approval.

---

## 4. Assistant Supervisor: Validate and approve

1. AS opens the **trip** (e.g. from notifications or dashboard).
2. AS sees:
   - **Start photo** (speedometer)
   - **End photo** (speedometer)
3. AS enters:
   - **Start reading** (odometer km at start)
   - **End reading** (odometer km at end)
4. System calculates:
   - `distance_km = end_reading - start_reading`
   - Vehicle has **mileage** (e.g. km/L).
   - **Approximate fuel used** = `distance_km / vehicle_mileage_km_per_L` (e.g. 50 km, 5 km/L → 10 L).
5. AS taps **Approve** → `status = TRIP_COMPLETED`, and `start_reading`, `end_reading`, `distance_km`, `fuel_used_l` are stored.

From these readings and mileage we can assume **approximately how much fuel was used** for that truck/vehicle.

---

## Summary table

| Step | Who        | Action                          | Result / DB |
|------|------------|----------------------------------|-------------|
| 1    | Driver     | Start trip + speedometer photo   | TRIP_STARTED, start_photo_url, started_at |
| 2    | Driver     | Complete + speedometer photo     | TRIP_NEED_APPROVAL, end_photo_url, ended_at |
| 3    | System     | On TRIP_NEED_APPROVAL            | Notify AS: “Trip ended, please approve” |
| 4    | AS         | View start/end photos, enter start/end readings, Approve | TRIP_COMPLETED, distance_km, fuel_used_l (from mileage) |

**No GPS** in driver steps; only start/end speedometer photos and AS readings for validation and approximate fuel.
