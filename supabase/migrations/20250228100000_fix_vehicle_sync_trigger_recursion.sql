-- =============================================================================
-- Fix "stack depth limit exceeded": prevent trigger recursion between
-- public.vehicles <-> umugwaneza.vehicles by only UPDATE when value actually changes.
-- =============================================================================

-- 1) public -> umugwaneza: only UPDATE umugwaneza.vehicles when name/type differ
CREATE OR REPLACE FUNCTION public.sync_vehicle_to_umugwaneza()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, umugwaneza
AS $$
DECLARE
  v_business_id text;
  v_name text;
  v_type text;
BEGIN
  SELECT value INTO v_business_id FROM public.umugwaneza_sync_config WHERE key = 'default_business_id' LIMIT 1;
  IF v_business_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'umugwaneza') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    UPDATE umugwaneza.vehicles SET hapyjo_vehicle_id = NULL WHERE hapyjo_vehicle_id = OLD.id;
    RETURN OLD;
  END IF;

  v_name := NEW.vehicle_number_or_id;
  v_type := CASE WHEN NEW.type = 'truck' THEN 'TRUCK' ELSE 'MACHINE' END;

  IF EXISTS (SELECT 1 FROM umugwaneza.vehicles WHERE hapyjo_vehicle_id = NEW.id LIMIT 1) THEN
    -- Only UPDATE when something actually changed to avoid re-triggering sync_vehicle_to_public
    UPDATE umugwaneza.vehicles
    SET vehicle_name = v_name,
        vehicle_type = v_type,
        updated_at = now()
    WHERE hapyjo_vehicle_id = NEW.id
      AND (vehicle_name IS DISTINCT FROM v_name OR vehicle_type IS DISTINCT FROM v_type);
  ELSE
    INSERT INTO umugwaneza.vehicles (
      id, business_id, hapyjo_vehicle_id, vehicle_name, vehicle_type,
      rental_type, ownership_type, base_rate, current_status, current_location, notes,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_business_id,
      NEW.id,
      v_name,
      v_type,
      'DAY', 'OWN', 0, 'AVAILABLE', NULL, NULL,
      now(), now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2) umugwaneza -> public: only UPDATE public.vehicles when vehicle_number_or_id would change
CREATE OR REPLACE FUNCTION umugwaneza.sync_vehicle_to_public()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, umugwaneza
AS $$
BEGIN
  IF NEW.hapyjo_vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only update when the new value is different to avoid re-triggering sync_vehicle_to_umugwaneza
  UPDATE public.vehicles
  SET vehicle_number_or_id = COALESCE(NEW.vehicle_name, public.vehicles.vehicle_number_or_id)
  WHERE id = NEW.hapyjo_vehicle_id
    AND public.vehicles.vehicle_number_or_id IS DISTINCT FROM COALESCE(NEW.vehicle_name, public.vehicles.vehicle_number_or_id);

  RETURN NEW;
END;
$$;

-- Confirm migration applied (returns one row when run in SQL runner)
SELECT 1 AS migration_applied;
