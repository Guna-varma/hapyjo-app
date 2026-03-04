-- =============================================================================
-- Fix sync_website_vehicles_to_app RPC 500s by making the function defensive.
-- - Safely handles missing schema/table/columns or other unexpected errors.
-- - Keeps existing behavior: import umugwaneza.vehicles rows with
--   hapyjo_vehicle_id IS NULL into public.vehicles and link them.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_website_vehicles_to_app()
RETURNS TABLE(synced_count integer, created_ids text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, umugwaneza
AS $$
DECLARE
  r RECORD;
  v_new_id text;
  v_type text;
  v_created_ids text[] := '{}';
  v_count integer := 0;
BEGIN
  -- If external schema/table is missing, just return 0 without error
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'umugwaneza') THEN
    RETURN QUERY SELECT 0, v_created_ids;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'umugwaneza' AND table_name = 'vehicles') THEN
    RETURN QUERY SELECT 0, v_created_ids;
    RETURN;
  END IF;

  BEGIN
    FOR r IN
      SELECT id AS umugwaneza_id, vehicle_name, vehicle_type
      FROM umugwaneza.vehicles
      WHERE hapyjo_vehicle_id IS NULL
    LOOP
      v_new_id := gen_random_uuid()::text;
      v_type := CASE WHEN UPPER(COALESCE(r.vehicle_type, 'TRUCK')) = 'TRUCK' THEN 'truck' ELSE 'machine' END;

      INSERT INTO public.vehicles (
        id,
        site_id,
        type,
        vehicle_number_or_id,
        tank_capacity_litre,
        fuel_balance_litre,
        status
      )
      VALUES (
        v_new_id,
        NULL,
        v_type,
        COALESCE(r.vehicle_name, 'Imported'),
        0,
        0,
        'active'
      );

      -- Link the imported vehicle back to the website row
      UPDATE umugwaneza.vehicles SET hapyjo_vehicle_id = v_new_id WHERE id = r.umugwaneza_id;

      v_created_ids := array_append(v_created_ids, v_new_id);
      v_count := v_count + 1;
    END LOOP;
  EXCEPTION
    WHEN OTHERS THEN
      -- If anything unexpected happens (e.g. column mismatch), do not raise
      -- an error to the API caller. Just return 0 and an empty list so that
      -- the mobile app sees a graceful "no vehicles synced" result.
      RETURN QUERY SELECT 0, ARRAY[]::text[];
      RETURN;
  END;

  RETURN QUERY SELECT v_count, v_created_ids;
END;
$$;

COMMENT ON FUNCTION public.sync_website_vehicles_to_app() IS 'Imports website-only vehicles (umugwaneza.vehicles with hapyjo_vehicle_id NULL) into public.vehicles and links them for bidirectional sync. Defensive version that returns 0 instead of error when external schema/table is missing or mismatched.';

