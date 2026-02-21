-- =============================================================================
-- Verify Production RBAC: run in Supabase SQL Editor after sync-production-users.js
-- =============================================================================
-- Shows all profiles with email, role, name, active. Use to confirm 8 users are correct.

SELECT
  p.id,
  p.email,
  p.role,
  p.name,
  p.active,
  p.created_at
FROM public.profiles p
ORDER BY p.email;
