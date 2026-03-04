-- =============================================================================
-- Separate Hapyjo app users from Umugwaneza (website) users so the app
-- only lists app users. Profiles created for the app have source = 'hapyjo';
-- profiles created for the Umugwaneza web app have source = 'umugwaneza'.
--
-- Umugwaneza website: when creating auth users, pass user_metadata.source = 'umugwaneza'
-- so the trigger sets source on the profile and they are excluded from the Hapyjo app list.
-- =============================================================================

-- 1) Add source column to public.profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'hapyjo'
  CHECK (source IN ('hapyjo', 'umugwaneza'));

COMMENT ON COLUMN public.profiles.source IS 'hapyjo = Hapyjo app user (shown in User Management); umugwaneza = website-only user (hidden from app).';

-- 2) Ensure existing rows are hapyjo (no-op if already default)
UPDATE public.profiles SET source = 'hapyjo' WHERE source IS NULL OR source NOT IN ('hapyjo', 'umugwaneza');

-- 3) Update handle_new_user to set source from metadata (default hapyjo)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta_role text;
  meta_source text;
  assign_role public.app_role;
  assign_source text;
BEGIN
  meta_role := NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), '');
  IF meta_role IN ('admin', 'owner', 'head_supervisor', 'accountant', 'assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine') THEN
    assign_role := meta_role::public.app_role;
  ELSE
    assign_role := 'driver_truck'::public.app_role;
  END IF;

  meta_source := NULLIF(TRIM(NEW.raw_user_meta_data->>'source'), '');
  IF meta_source IN ('hapyjo', 'umugwaneza') THEN
    assign_source := meta_source;
  ELSE
    assign_source := 'hapyjo';
  END IF;

  INSERT INTO public.profiles (id, name, email, role, site_access, active, source)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    assign_role,
    '{}',
    COALESCE((NEW.raw_user_meta_data->>'active')::boolean, true),
    assign_source
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
