-- Link trips to assigned_trips, backfill historical rows, and deduplicate.
-- Goal: exactly one trips row per assigned trip + one in-progress trip per driver.

-- 1) Schema: add assignment link (nullable for legacy / standalone rows).
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS assigned_trip_id text REFERENCES public.assigned_trips(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.trips.assigned_trip_id IS 'Optional link to assigned_trips.id. Used to enforce one trip row per assignment.';

-- 2) Backfill from existing data (closest started_at match for same driver/vehicle/site).
-- Use a correlated subquery (portable for UPDATE) instead of FROM LATERAL.
UPDATE public.trips t
SET assigned_trip_id = (
  SELECT a.id
  FROM public.assigned_trips a
  WHERE a.vehicle_type = 'truck'
    AND a.started_at IS NOT NULL
    AND a.driver_id = t.driver_id
    AND a.vehicle_id = t.vehicle_id
    AND a.site_id = t.site_id
    AND ABS(EXTRACT(EPOCH FROM (t.start_time - a.started_at))) <= 300
  ORDER BY
    ABS(EXTRACT(EPOCH FROM (t.start_time - a.started_at))) ASC,
    a.created_at DESC
  LIMIT 1
)
WHERE t.assigned_trip_id IS NULL;

-- 3) Dedupe rows that now share the same assignment link.
-- Keep the "latest completed" row; if not completed, keep latest by timestamp.
WITH ranked AS (
  SELECT
    id,
    assigned_trip_id,
    ROW_NUMBER() OVER (
      PARTITION BY assigned_trip_id
      ORDER BY
        CASE WHEN status = 'completed' THEN 1 ELSE 0 END DESC,
        COALESCE(end_time, created_at) DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.trips
  WHERE assigned_trip_id IS NOT NULL
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.trips t
USING to_delete d
WHERE t.id = d.id;

-- 4) Dedupe legacy duplicates not linked to assignment yet (exact same start_time key).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY driver_id, vehicle_id, site_id, start_time
      ORDER BY
        COALESCE(end_time, created_at) DESC,
        created_at DESC,
        id DESC
    ) AS rn
  FROM public.trips
  WHERE assigned_trip_id IS NULL
    AND status = 'completed'
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.trips t
USING to_delete d
WHERE t.id = d.id;

-- 5) Keep at most one active trip per driver (latest row wins).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY driver_id
      ORDER BY created_at DESC, id DESC
    ) AS rn
  FROM public.trips
  WHERE status = 'in_progress'
),
to_delete AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.trips t
USING to_delete d
WHERE t.id = d.id;

-- 6) Constraints/indexes to prevent regression.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trips_assigned_trip_id
  ON public.trips(assigned_trip_id)
  WHERE assigned_trip_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trips_one_in_progress_per_driver
  ON public.trips(driver_id)
  WHERE status = 'in_progress';
