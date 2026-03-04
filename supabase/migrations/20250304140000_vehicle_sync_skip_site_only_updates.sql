-- =============================================================================
-- Fix "unable to save vehicle" when changing only site (or other specs).
-- Only sync to umugwaneza when vehicle_number_or_id or type actually change.
-- When only site_id, status, tank, fuel, etc. change, skip sync entirely so
-- no trigger chain runs and the update succeeds.
-- =============================================================================

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
  -- On UPDATE: skip sync when only non-synced columns changed (site, status, tank, etc.)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.vehicle_number_or_id IS NOT DISTINCT FROM NEW.vehicle_number_or_id
       AND OLD.type IS NOT DISTINCT FROM NEW.type THEN
      RETURN NEW;
    END IF;
  END IF;

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

COMMENT ON FUNCTION public.sync_vehicle_to_umugwaneza() IS 'Syncs public.vehicles to umugwaneza.vehicles only when vehicle_number_or_id or type change; site/spec-only updates are skipped to avoid trigger errors.';
