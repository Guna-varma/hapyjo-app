# Production deployment – HapyJo Ltd

Use this checklist to push everything to your Supabase project and get a production-ready app with a working login.

---

## 1. Prerequisites

- **Supabase project** created and **Active** (Dashboard).
- **`.env`** in project root with **updated** keys:

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Use your **Project URL**, **anon (public) key**, and **service_role key** from **Project Settings → API**.  
**Important:** The service role key is used by Edge Functions and by the seed script. Never expose it in the app or commit it.

- **Supabase CLI** installed: `npm install -g supabase` (or `npx supabase`).
- **Linked project:** run once (use your project ref from the URL, e.g. `dobfzbdwyimicxzcssiw`):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

When prompted, enter your **database password** (set when creating the project).

---

## 2. Push database and migrations

If this is a **new** project and you have not run the full schema yet:

1. Open **Supabase Dashboard → SQL Editor**.
2. Copy the contents of **`supabase/schema.sql`** and run it.
3. Then run migrations via CLI (below).

If the base schema is already applied (or you use migrations only):

From the **project root**:

```bash
supabase db push
```

This applies all files in **`supabase/migrations/`** in order, including:

- `handle_new_user` trigger (role from metadata, `site_access`, `active`)
- Survey approval RBAC, trips live location
- **GPS photos** table and **gps-images** storage bucket + policies

If the **gps-images** bucket is missing after push, create it in **Dashboard → Storage → New bucket**: name `gps-images`, **Public** ON, allowed MIME types `image/jpeg`, `image/jpg`.

---

## 3. Edge Function secrets (no action needed for service role)

**create_user_by_owner** and **reset_user_password** use `SUPABASE_SERVICE_ROLE_KEY`. In **production**, Supabase injects this (and `SUPABASE_URL`, `SUPABASE_ANON_KEY`) automatically — you do **not** set it via the CLI.

**Do not run** `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...` — the CLI will skip it (env names cannot start with `SUPABASE_`), and in production the key is already available to your functions.

For **local** testing (`supabase functions serve`), put your keys in `supabase/functions/.env` or use `--env-file .env`.

---

## 4. Deploy Edge Functions

From the project root:

```bash
supabase functions deploy create_user_by_owner --no-verify-jwt
supabase functions deploy reset_user_password --no-verify-jwt
```

Or use the PowerShell script:

```powershell
.\scripts\supabase-deploy.ps1
```

(Ensure **Step 3** is done so the functions do not return "Server configuration error".)

---

## 5. Sync 8 Production RBAC users (Auth + profiles)

If you already created the 8 users in **Dashboard → Authentication → Users** (admin, owner, accountant, head supervisor, assistant supervisor, surveyor, driver truck, driver machine), sync their **passwords** and **profiles** (role, name) in one go:

```bash
node scripts/sync-production-users.js
```

This script:

- Sets each user’s **password** in Auth to the production values (e.g. admin@hapyjo.com → Admin@123, owner@hapyjo.com → HpY!Ow9#R4vT2K, etc.).
- Updates **public.profiles** for each: `role` and `name` (and `active = true`).
- If a user is missing in Auth, creates them and then updates the profile.

After running, log in to the app with each account to verify RBAC. To verify in the DB, run **Dashboard → SQL Editor** with the contents of **`supabase/scripts/verify_profiles_roles.sql`** (lists all profiles with email, role, name).

---

## 6. Create first login user (alternative: seed-auth-users.js)

Run the seed script once if you prefer to create/reset **admin@hapyjo.com** and **Owner@hapyjo.rw** with generated passwords:

```bash
node scripts/seed-auth-users.js
```

This script:

- Creates **admin@hapyjo.com** with a **fixed password** (or resets it if the user already exists).
- Optionally creates **Owner@hapyjo.rw** with a random password.
- Sets/resets passwords for other users and **prints all login credentials**.

**Use this to log in:**

| Email               | Password        | Role   |
|---------------------|-----------------|--------|
| **admin@hapyjo.com**| **HapyjoAdmin2025!** | owner |

Save the printed table; it includes any other users and their temporary passwords.

---

## 7. Analyze DB with Supabase CLI

From the project root (after `supabase link`):

```bash
# List remote migrations (what’s applied)
npx supabase migration list

# Dump public schema (tables, types, RLS) to a file
npx supabase db dump --schema public -f public_schema_dump.sql

# Optional: diff local migrations vs remote
npx supabase db diff
```

To inspect **profiles** and roles without dumping: use **Dashboard → SQL Editor** and run `supabase/scripts/verify_profiles_roles.sql`, or:

```sql
SELECT id, email, role, name, active FROM public.profiles ORDER BY email;
```

---

## 8. Final checklist

- [ ] `.env` has correct `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `supabase link --project-ref YOUR_REF` done.
- [ ] `supabase db push` completed (all migrations applied).
- [ ] **gps-images** bucket exists (create in Dashboard if needed).
- [ ] (Optional) No need to set `SUPABASE_SERVICE_ROLE_KEY` — it’s provided automatically in production.
- [ ] `supabase functions deploy create_user_by_owner` and `reset_user_password` deployed.
- [ ] **8 RBAC users:** Run `node scripts/sync-production-users.js` to set passwords and profile roles (admin, owner, accountant, head_supervisor, assistant_supervisor, surveyor, driver_truck, driver_machine). Then log in with each to verify.
- [ ] (Alternative) `node scripts/seed-auth-users.js` for admin@hapyjo.com / Owner@hapyjo.rw with printed credentials.

---

## 9. create_user_by_owner – fixes applied

- **Site validation:** If `site_id` is sent, the function checks that the site exists before assigning; invalid `site_id` returns 400 "Site not found".
- **Profile update retry:** Profile update is retried once after a short delay to avoid trigger timing issues.
- **Edge Function:** In production, `SUPABASE_SERVICE_ROLE_KEY` is provided automatically; you don’t set it via the CLI.

The function only allows **@hapyjo.com** internal emails. Use **admin@hapyjo.com** (created by the seed script) to log in and create more users from the app.

---

## 10. GPS Camera (no Google, production-ready)

The GPS Map Camera uses **OpenStreetMap + Nominatim** only (no API key, no billing). Flow: capture → GPS → OSM reverse geocode → address → OSM tile mini-map → merge → compress → upload to **gps-images** → save to **gps_photos**. Ensure the **gps-images** bucket and **gps_photos** table exist (from migrations). No extra env vars required.
