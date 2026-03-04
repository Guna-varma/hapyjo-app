# Vehicles: sync and edit (no in-app add)

## Product behaviour

- **Vehicles are not added in Hapyjo.** They are created on the **Umugwaneza website** and then **synced** into the app. In Hapyjo, users:
  1. **Sync from website** – pull new vehicles from Umugwaneza into the app.
  2. **Edit** synced vehicles – add app-specific specs (mileage, tank capacity, fuel balance, health, ideal ranges, etc.) and **assign them to sites**.

## Sync status (app ↔ Umugwaneza)

- **App → Website:** When you **edit** a vehicle in the app (specs, site), the trigger `tr_sync_vehicle_to_umugwaneza` (migration `20250226110000_vehicles_capacity_and_umugwaneza_sync.sql`) writes to `umugwaneza.vehicles` if the `umugwaneza` schema exists. So vehicles are in sync for the **same Supabase project**.
- **Website → App:** New vehicles on the website (with `hapyjo_vehicle_id` NULL) are imported via **Sync from website** (calls `public.sync_website_vehicles_to_app()`). Existing linked vehicles are updated by the trigger `tr_sync_vehicle_to_public` when the website changes name/type.

## Edit vehicle: what the app sends

- **Free (no site):** `site_id = null`
- **With site:** `site_id = <site uuid>`
- **Editable fields:** `vehicle_number_or_id`, `site_id`, `tank_capacity_litre`, `fuel_balance_litre`, `status`; for truck: `mileage_km_per_litre`, `capacity_tons`, `ideal_consumption_range`, `health_inputs`; for machine: `hours_per_litre`, `ideal_working_range`.

The **live DB** must allow `vehicles.site_id` to be **NULL** (migration `20250226130000_vehicles_site_optional.sql`) for “Free (no site)” assignment.

## Check the DB with Supabase

### Option A: Supabase Dashboard (no CLI)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project (**dobfzbdwyimicxzcssiw**).
2. Go to **SQL Editor**.
3. **Verify schema:** run the contents of  
   `supabase/scripts/verify_vehicles_and_sync.sql`  
   to see:
   - `vehicles` columns and whether `site_id` is nullable
   - RLS policies on `vehicles`
   - Presence of `current_user_role()` and the sync trigger
4. **If `site_id` is still NOT NULL (or sync/edit fails):** run  
   `supabase/scripts/fix_vehicles_site_nullable_live.sql`  
   to make `site_id` nullable and ensure `capacity_tons` and `status` default exist. Safe to run more than once.

### Option B: Supabase CLI (live)

If Supabase CLI is installed and the project is linked:

```bash
cd c:\HAPYJO_BUILD\Hapyjo
supabase link --project-ref dobfzbdwyimicxzcssiw
supabase db remote commit
supabase migration list
```

Then run the same SQL (from the scripts above) via:

```bash
supabase db execute --file supabase/scripts/verify_vehicles_and_sync.sql
```

If migrations are out of sync, apply the fix script in the Dashboard as in Option A.

## After fixing the DB

- **Sync from website** and **Edit vehicle** should work for both “Free (no site)” and “With site”.
- If something still fails, the app shows the **exact Supabase error message** in the alert; use that to fix RLS, schema, or permissions.
