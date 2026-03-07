-- Supervisor-validated readings and unified fuel-ledger approval.
-- Idempotent approval: only NEED_APPROVAL statuses can transition to COMPLETED.

-- Compatibility: ensure legacy fuel-reading columns exist even if older migration
-- (20250322100000_assigned_trips_fuel_photos_gps.sql) was not applied.
ALTER TABLE public.assigned_trips
  ADD COLUMN IF NOT EXISTS start_reading numeric,
  ADD COLUMN IF NOT EXISTS end_reading numeric,
  ADD COLUMN IF NOT EXISTS distance_km numeric,
  ADD COLUMN IF NOT EXISTS hours_used numeric,
  ADD COLUMN IF NOT EXISTS fuel_used_l numeric,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS fuel_mode text CHECK (fuel_mode IS NULL OR fuel_mode IN ('km_per_l', 'l_per_hour')),
  ADD COLUMN IF NOT EXISTS fuel_rate numeric;

ALTER TABLE public.assigned_trips
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_notes text,
  ADD COLUMN IF NOT EXISTS manual_fuel_override_l numeric,
  ADD COLUMN IF NOT EXISTS override_reason text;

ALTER TABLE public.machine_sessions
  ADD COLUMN IF NOT EXISTS assigned_trip_id text REFERENCES public.assigned_trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validated_fuel_used_l numeric;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_sessions_assigned_trip_id
  ON public.machine_sessions(assigned_trip_id)
  WHERE assigned_trip_id IS NOT NULL;

ALTER TABLE public.assigned_trips
  DROP CONSTRAINT IF EXISTS assigned_trips_readings_non_negative_ck;
ALTER TABLE public.assigned_trips
  ADD CONSTRAINT assigned_trips_readings_non_negative_ck CHECK (
    (start_reading IS NULL OR start_reading >= 0)
    AND (end_reading IS NULL OR end_reading >= 0)
    AND (distance_km IS NULL OR distance_km >= 0)
    AND (hours_used IS NULL OR hours_used >= 0)
    AND (fuel_used_l IS NULL OR fuel_used_l >= 0)
  );

ALTER TABLE public.assigned_trips
  DROP CONSTRAINT IF EXISTS assigned_trips_reading_order_ck;
ALTER TABLE public.assigned_trips
  ADD CONSTRAINT assigned_trips_reading_order_ck CHECK (
    start_reading IS NULL OR end_reading IS NULL OR end_reading >= start_reading
  );

CREATE OR REPLACE FUNCTION public.approve_assigned_trip_readings(
  p_assigned_trip_id text,
  p_start_reading numeric,
  p_end_reading numeric,
  p_validation_notes text DEFAULT NULL,
  p_manual_fuel_override_l numeric DEFAULT NULL,
  p_override_reason text DEFAULT NULL
)
RETURNS TABLE(
  assigned_trip_id text,
  status text,
  computed_usage numeric,
  fuel_used_l numeric,
  projected_fuel_balance_litre numeric,
  already_approved boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_trip public.assigned_trips%ROWTYPE;
  v_vehicle public.vehicles%ROWTYPE;
  v_now timestamptz := now();
  v_usage numeric;
  v_calculated_fuel numeric;
  v_final_fuel numeric;
  v_trip_id text;
  v_prev_trip_fuel numeric;
  v_session_id text;
  v_prev_session_fuel numeric;
  v_prev_fuel numeric;
  v_delta numeric;
  v_projected_balance numeric;
BEGIN
  IF p_assigned_trip_id IS NULL OR btrim(p_assigned_trip_id) = '' THEN
    RAISE EXCEPTION 'assigned_trip_id is required';
  END IF;
  IF p_start_reading IS NULL OR p_end_reading IS NULL THEN
    RAISE EXCEPTION 'start and end readings are required';
  END IF;
  IF p_start_reading < 0 OR p_end_reading < 0 THEN
    RAISE EXCEPTION 'readings must be non-negative';
  END IF;
  IF p_end_reading < p_start_reading THEN
    RAISE EXCEPTION 'end reading must be greater than or equal to start reading';
  END IF;

  SELECT * INTO v_trip
  FROM public.assigned_trips
  WHERE id = p_assigned_trip_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'assigned trip not found';
  END IF;

  IF v_trip.status IN ('TRIP_COMPLETED', 'TASK_COMPLETED') THEN
    RETURN QUERY
    SELECT v_trip.id, v_trip.status, COALESCE(v_trip.distance_km, v_trip.hours_used), v_trip.fuel_used_l, NULL::numeric, true;
    RETURN;
  END IF;

  IF v_trip.status NOT IN ('TRIP_NEED_APPROVAL', 'TASK_NEED_APPROVAL') THEN
    RAISE EXCEPTION 'trip/task is not pending approval';
  END IF;

  SELECT * INTO v_vehicle
  FROM public.vehicles
  WHERE id = v_trip.vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle not found';
  END IF;

  v_usage := round((p_end_reading - p_start_reading)::numeric, 2);

  IF v_trip.vehicle_type = 'truck' THEN
    IF COALESCE(v_vehicle.fuel_mode, 'km_per_l') <> 'km_per_l' THEN
      RAISE EXCEPTION 'truck requires fuel_mode=km_per_l';
    END IF;
    IF v_vehicle.fuel_rate IS NULL OR v_vehicle.fuel_rate <= 0 THEN
      RAISE EXCEPTION 'vehicle fuel_rate must be > 0 for truck';
    END IF;
    v_calculated_fuel := round((v_usage / v_vehicle.fuel_rate)::numeric, 2);
  ELSE
    IF COALESCE(v_vehicle.fuel_mode, 'l_per_hour') <> 'l_per_hour' THEN
      RAISE EXCEPTION 'machine requires fuel_mode=l_per_hour';
    END IF;
    IF v_vehicle.fuel_rate IS NULL OR v_vehicle.fuel_rate <= 0 THEN
      RAISE EXCEPTION 'vehicle fuel_rate must be > 0 for machine';
    END IF;
    v_calculated_fuel := round((v_usage * v_vehicle.fuel_rate)::numeric, 2);
  END IF;

  IF p_manual_fuel_override_l IS NOT NULL AND p_manual_fuel_override_l >= 0 THEN
    v_final_fuel := round(p_manual_fuel_override_l::numeric, 2);
  ELSE
    v_final_fuel := v_calculated_fuel;
  END IF;

  SELECT t.id, COALESCE(t.fuel_consumed, 0)
  INTO v_trip_id, v_prev_trip_fuel
  FROM public.trips t
  WHERE t.assigned_trip_id = v_trip.id
  ORDER BY COALESCE(t.end_time, t.created_at) DESC, t.id DESC
  LIMIT 1;

  SELECT m.id, COALESCE(m.fuel_consumed, 0)
  INTO v_session_id, v_prev_session_fuel
  FROM public.machine_sessions m
  WHERE m.assigned_trip_id = v_trip.id
  ORDER BY COALESCE(m.end_time, m.created_at) DESC, m.id DESC
  LIMIT 1;

  v_prev_fuel := COALESCE(v_prev_trip_fuel, v_prev_session_fuel, 0);
  v_delta := v_final_fuel - v_prev_fuel;
  v_projected_balance := round((COALESCE(v_vehicle.fuel_balance_litre, 0) - v_delta)::numeric, 2);

  IF v_projected_balance < 0 THEN
    RAISE EXCEPTION 'insufficient fuel balance for approval';
  END IF;

  UPDATE public.assigned_trips
  SET
    start_reading = p_start_reading,
    end_reading = p_end_reading,
    distance_km = CASE WHEN v_trip.vehicle_type = 'truck' THEN v_usage ELSE NULL END,
    hours_used = CASE WHEN v_trip.vehicle_type = 'machine' THEN v_usage ELSE NULL END,
    fuel_used_l = v_final_fuel,
    validation_notes = p_validation_notes,
    manual_fuel_override_l = CASE WHEN p_manual_fuel_override_l IS NOT NULL AND p_manual_fuel_override_l >= 0 THEN p_manual_fuel_override_l ELSE NULL END,
    override_reason = CASE WHEN p_manual_fuel_override_l IS NOT NULL AND p_manual_fuel_override_l >= 0 THEN p_override_reason ELSE NULL END,
    validated_by = auth.uid(),
    validated_at = v_now,
    status = CASE WHEN v_trip.vehicle_type = 'truck' THEN 'TRIP_COMPLETED' ELSE 'TASK_COMPLETED' END,
    completed_at = v_now,
    completed_by = auth.uid()
  WHERE id = v_trip.id
    AND status IN ('TRIP_NEED_APPROVAL', 'TASK_NEED_APPROVAL');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'approval rejected due to concurrent status update';
  END IF;

  IF v_trip_id IS NOT NULL THEN
    UPDATE public.trips
    SET
      distance_km = CASE WHEN v_trip.vehicle_type = 'truck' THEN v_usage ELSE distance_km END,
      fuel_consumed = v_final_fuel
    WHERE id = v_trip_id;
  END IF;

  IF v_session_id IS NOT NULL THEN
    UPDATE public.machine_sessions
    SET
      duration_hours = CASE WHEN v_trip.vehicle_type = 'machine' THEN v_usage ELSE duration_hours END,
      fuel_consumed = v_final_fuel,
      validated_fuel_used_l = v_final_fuel
    WHERE id = v_session_id;
  END IF;

  UPDATE public.vehicles
  SET fuel_balance_litre = v_projected_balance
  WHERE id = v_vehicle.id;

  RETURN QUERY
  SELECT
    v_trip.id,
    CASE WHEN v_trip.vehicle_type = 'truck' THEN 'TRIP_COMPLETED' ELSE 'TASK_COMPLETED' END,
    v_usage,
    v_final_fuel,
    v_projected_balance,
    false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_assigned_trip_readings(text, numeric, numeric, text, numeric, text) TO authenticated;
