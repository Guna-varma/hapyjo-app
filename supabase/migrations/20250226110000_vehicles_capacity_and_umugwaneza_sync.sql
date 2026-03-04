-- =============================================================================
-- Vehicles: add capacity_tons for trucks (rental/customer info).
-- Bidirectional sync with umugwaneza.vehicles (same DB):
--   - public.vehicles -> umugwaneza.vehicles (Android -> Website)
--   - umugwaneza.vehicles -> public.vehicles (Website -> Android) when hapyjo_vehicle_id is set
-- =============================================================================

-- 1) Add capacity_tons to public.vehicles (trucks: capacity in tons)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS capacity_tons numeric(10,2);

COMMENT ON COLUMN public.vehicles.capacity_tons IS 'Truck only: load capacity in tons. Used for rental/sync to Umugwaneza.';

-- 2) Sync config: default business_id for syncing Hapyjo vehicles into Umugwaneza (one row)
CREATE TABLE IF NOT EXISTS public.umugwaneza_sync_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.umugwaneza_sync_config (key, value)
VALUES ('default_business_id', 'default')
ON CONFLICT (key) DO NOTHING;

-- 3) Function: sync public.vehicles -> umugwaneza.vehicles (Hapyjo -> Website)
CREATE OR REPLACE FUNCTION public.sync_vehicle_to_umugwaneza()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, umugwaneza
AS $$
DECLARE
  v_business_id text;
  v_site_name text;
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

  IF EXISTS (SELECT 1 FROM umugwaneza.vehicles WHERE hapyjo_vehicle_id = NEW.id LIMIT 1) THEN
    SELECT name INTO v_site_name FROM public.sites WHERE id = NEW.site_id LIMIT 1;
    UPDATE umugwaneza.vehicles
    SET vehicle_name = NEW.vehicle_number_or_id,
        vehicle_type = CASE WHEN NEW.type = 'truck' THEN 'TRUCK' ELSE 'MACHINE' END,
        current_location = COALESCE(v_site_name, current_location),
        updated_at = now()
    WHERE hapyjo_vehicle_id = NEW.id;
  ELSE
    SELECT name INTO v_site_name FROM public.sites WHERE id = NEW.site_id LIMIT 1;
    INSERT INTO umugwaneza.vehicles (
      id, business_id, hapyjo_vehicle_id, vehicle_name, vehicle_type,
      rental_type, ownership_type, base_rate, current_status, current_location, notes,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_business_id,
      NEW.id,
      NEW.vehicle_number_or_id,
      CASE WHEN NEW.type = 'truck' THEN 'TRUCK' ELSE 'MACHINE' END,
      'DAY', 'OWN', 0, 'AVAILABLE', v_site_name, NULL,
      now(), now()
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: after insert/update on public.vehicles
DROP TRIGGER IF EXISTS tr_sync_vehicle_to_umugwaneza ON public.vehicles;
CREATE TRIGGER tr_sync_vehicle_to_umugwaneza
  AFTER INSERT OR UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.sync_vehicle_to_umugwaneza();

-- 4) Function: sync umugwaneza.vehicles -> public.vehicles (Website -> Android) when hapyjo_vehicle_id is set
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

  UPDATE public.vehicles
  SET vehicle_number_or_id = COALESCE(NEW.vehicle_name, public.vehicles.vehicle_number_or_id)
  WHERE id = NEW.hapyjo_vehicle_id;

  RETURN NEW;
END;
$$;

-- Trigger on umugwaneza.vehicles (only if schema and table exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'umugwaneza' AND table_name = 'vehicles') THEN
    DROP TRIGGER IF EXISTS tr_sync_vehicle_to_public ON umugwaneza.vehicles;
    EXECUTE 'CREATE TRIGGER tr_sync_vehicle_to_public AFTER INSERT OR UPDATE ON umugwaneza.vehicles FOR EACH ROW EXECUTE FUNCTION umugwaneza.sync_vehicle_to_public()';
  END IF;
END;
$$;
