# Supabase – HapyJo Ltd

This folder contains Supabase CLI config, migrations, and SQL used for the HapyJo app.

## Layout

| Path | Purpose |
|------|--------|
| `config.toml` | Local Supabase config (from `supabase init`). Migrations are enabled. |
| `migrations/` | Migration SQL files. Use timestamped names: `YYYYMMDDHHMMSS_description.sql`. |
| `schema.sql` | Full schema (tables, RLS, triggers). Run once in Supabase SQL Editor for new projects. |
| `fix_create_user.sql` | Run in SQL Editor if "Database error creating new user" when adding users in Dashboard. |

## CLI: link to remote project

1. Get your **project ref** from the Supabase URL (e.g. `dobfzbdwyimicxzcssiw` from `https://dobfzbdwyimicxzcssiw.supabase.co`).
2. Create an **access token** at [Account → Access Tokens](https://supabase.com/dashboard/account/tokens).
3. From the **project root** (parent of `supabase/`):

   **PowerShell:**
   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "your_token"
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   Enter the database password when prompted.

See **Part 9** in [SUPABASE_SETUP_GUIDE.md](../SUPABASE_SETUP_GUIDE.md) for full steps.
