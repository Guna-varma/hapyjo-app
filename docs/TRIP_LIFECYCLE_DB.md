# Trip lifecycle – DB requirements

If you see **"Failed to end trip"** or **GPS/store errors** when ending a trip, check the following.

**Quick fix:** Run the migration `supabase/migrations/20250325000000_trip_lifecycle_rls_and_constraints.sql` in the Supabase SQL Editor. It sets RLS and policies for `trips` and `assigned_trips` so drivers can end trips and set `TRIP_NEED_APPROVAL`. Your tables already have the right columns; this only fixes permissions and the completed-trip check.

## Required Supabase tables and columns

### 1. `trips` table

Used when the driver **starts** and **ends** a trip. Must include at least:

| Column                | Type         | Purpose                          |
|-----------------------|--------------|-----------------------------------|
| `id`                  | text         | Primary key                      |
| `vehicle_id`          | text         | FK to vehicles                    |
| `driver_id`           | uuid         | FK to profiles                    |
| `site_id`             | text         | FK to sites                       |
| `start_time`          | timestamptz  | When trip started                 |
| `end_time`            | timestamptz  | When trip ended (set on end trip) |
| `start_lat`, `start_lon` | numeric   | Start GPS (set on start)          |
| `end_lat`, `end_lon`  | numeric      | End GPS (set on end trip)         |
| `current_lat`, `current_lon` | numeric | Live position (optional)     |
| `location_updated_at` | timestamptz  | Last position update (optional)   |
| `distance_km`         | numeric      | Computed distance (set on end)    |
| `status`              | text         | `in_progress` or `completed`      |
| `start_photo_uri`     | text         | Start trip proof photo URL (lightweight: set on start, never overwritten) |
| `photo_uri`           | text         | End trip proof photo URL (set on end) |
| `created_at`          | timestamptz  |                                  |

- **RLS**: Drivers must be able to **INSERT** (start trip) and **UPDATE** (end trip, update live position) their own rows.
- Migrations that add these columns: e.g. `20250219220000_trips_live_location.sql` (adds `current_lat`, `current_lon`, `location_updated_at`). Ensure the base `trips` table has `end_time`, `end_lat`, `end_lon`, `distance_km`, `status`, `photo_uri`.

### 2. `assigned_trips` table

Used for the approval workflow (driver ends → status `TRIP_NEED_APPROVAL` → supervisor approves → `TRIP_COMPLETED`).

| Column           | Type        | Purpose                    |
|------------------|-------------|----------------------------|
| `id`             | text        | Primary key                |
| `site_id`        | text        | FK to sites                |
| `vehicle_id`     | text        | FK to vehicles             |
| `driver_id`      | uuid        | FK to profiles             |
| `vehicle_type`   | text        | `truck` or `machine`       |
| `status`         | text        | TRIP_* / TASK_* statuses   |
| `started_at`     | timestamptz | When driver started        |
| `pause_segments` | jsonb       | Pause/resume intervals      |
| `completed_at`   | timestamptz | When supervisor completed   |
| `completed_by`   | uuid        | FK to profiles             |

- **RLS**: Drivers must be able to **SELECT** and **UPDATE** their own rows (to set `TRIP_NEED_APPROVAL` when they end the trip).
- Migration: `20250314150000_assigned_trips.sql`.

### 3. `profiles` (or auth users)

- Drivers and supervisors must exist in `profiles` with correct `role` so RLS and app logic work.

## What to do if end trip still fails

1. **Run migrations**  
   Apply all Supabase migrations so `trips` and `assigned_trips` have the columns above (and any others your app uses).

2. **Check RLS**  
   - For `trips`: driver can UPDATE rows where `driver_id = auth.uid()`.  
   - For `assigned_trips`: driver can UPDATE rows where `driver_id = auth.uid()`.

3. **Check errors**  
   - "Could not get current position" → location permission or GPS timeout (app now uses a timeout and retry).  
   - "Failed to end trip" / Supabase error → usually missing column or RLS blocking UPDATE. Check the exact message and the Supabase logs.

4. **Refresh after end trip**  
   The app calls `refetch(true)` after a successful end trip so the list updates; refresh throttle is 30s for other refetches.

### 5. Trip proof photos (start/end speedometer) not saving

If the trip ends but the photo does **not** save to the `work-photos` bucket or `work_photos` table:

1. **Run the driver work_photos migration**  
   Apply `supabase/migrations/20250326000000_work_photos_driver_insert.sql` in the Supabase SQL Editor. It allows drivers (`driver_truck`, `driver_machine`) to INSERT and SELECT their own rows in `work_photos`. Without it, RLS blocks the insert and the app will show "Photo upload failed" with a permission error.

2. **Storage**  
   The `work-photos` bucket already allows any authenticated user to upload (path prefix `work/`). If upload still fails, check Storage > work-photos > Policies in the Supabase dashboard.
