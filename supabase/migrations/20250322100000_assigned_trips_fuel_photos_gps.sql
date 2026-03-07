-- Trip/task fuel monitoring: start/end photos, GPS (start+end only), readings, fuel calculation.
-- Lightweight: no continuous tracking; photos compressed to ~50KB client-side before upload.

-- assigned_trips: start/end capture and supervisor verification
ALTER TABLE public.assigned_trips
  ADD COLUMN IF NOT EXISTS start_photo_url text,
  ADD COLUMN IF NOT EXISTS end_photo_url text,
  ADD COLUMN IF NOT EXISTS start_gps_lat double precision,
  ADD COLUMN IF NOT EXISTS start_gps_lng double precision,
  ADD COLUMN IF NOT EXISTS end_gps_lat double precision,
  ADD COLUMN IF NOT EXISTS end_gps_lng double precision,
  ADD COLUMN IF NOT EXISTS start_reading numeric,
  ADD COLUMN IF NOT EXISTS end_reading numeric,
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS hours_used numeric,
  ADD COLUMN IF NOT EXISTS fuel_used_l numeric,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

COMMENT ON COLUMN public.assigned_trips.start_photo_url IS 'URL of compressed start photo (speedometer/hour meter + fuel gauge).';
COMMENT ON COLUMN public.assigned_trips.end_photo_url IS 'URL of compressed end photo.';
COMMENT ON COLUMN public.assigned_trips.start_reading IS 'Truck: start odometer km. Machine: start hour meter. Entered by supervisor.';
COMMENT ON COLUMN public.assigned_trips.end_reading IS 'Truck: end odometer km. Machine: end hour meter.';
COMMENT ON COLUMN public.assigned_trips.distance_km IS 'Truck: end_reading - start_reading (supervisor).';
COMMENT ON COLUMN public.assigned_trips.hours_used IS 'Machine: end_reading - start_reading (supervisor).';
COMMENT ON COLUMN public.assigned_trips.fuel_used_l IS 'Truck: distance_km / vehicle fuel_rate. Machine: hours_used * vehicle fuel_rate.';
COMMENT ON COLUMN public.assigned_trips.ended_at IS 'When driver ended trip (before supervisor approval).';

-- vehicles: fuel model for trip/task fuel calculation
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fuel_mode text CHECK (fuel_mode IS NULL OR fuel_mode IN ('km_per_l', 'l_per_hour')),
  ADD COLUMN IF NOT EXISTS fuel_rate numeric;

COMMENT ON COLUMN public.vehicles.fuel_mode IS 'km_per_l = truck (distance-based). l_per_hour = machine (hours-based).';
COMMENT ON COLUMN public.vehicles.fuel_rate IS 'Truck: km per litre. Machine: litres per hour.';
