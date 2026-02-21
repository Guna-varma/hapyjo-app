-- Run this in Supabase Dashboard → SQL Editor if you don't use Supabase CLI migrations.
-- Fixes 500 on GET /rest/v1/profiles?select=*&id=eq.<uuid> by using an RPC instead.

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO service_role;
