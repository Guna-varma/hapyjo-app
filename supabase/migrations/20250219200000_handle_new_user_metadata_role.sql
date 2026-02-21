-- =============================================================================
-- Secure handle_new_user: role from metadata, active true, site_access default
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta_role text;
  assign_role public.app_role;
BEGIN
  meta_role := NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), '');
  IF meta_role IN ('admin', 'owner', 'head_supervisor', 'accountant', 'assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine') THEN
    assign_role := meta_role::public.app_role;
  ELSE
    assign_role := 'driver_truck'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, name, email, role, site_access, active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    assign_role,
    '{}',
    COALESCE((NEW.raw_user_meta_data->>'active')::boolean, true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- Trigger already exists; ensure it uses this function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
