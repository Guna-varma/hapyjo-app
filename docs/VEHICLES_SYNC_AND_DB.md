# Vehicles: sync and add-vehicle DB check

## Sync status (app ↔ Umugwaneza)

- **App → Website:** When you add or update a vehicle in this app, the trigger `tr_sync_vehicle_to_umugwaneza` (migration `20250226110000_vehicles_capacity_and_umugwaneza_sync.sql`) writes to `umugwaneza.vehicles` if the `umugwaneza` schema exists. So vehicles are in sync for the **same Supabase project**.
- **Website → App:** When the Umugwaneza website updates a vehicle that has `hapyjo_vehicle_id` set, the trigger `tr_sync_vehicle_to_public` updates `public.vehicles`. Site location is managed on the website; you only change it there as needed.

## Add vehicle: what the app sends

- **Free (no site):** `site_id = null`
- **With site:** `site_id = <site uuid>`
- **Required:** `id`, `type`, `vehicle_number_or_id`, `tank_capacity_litre`, `fuel_balance_litre` (and for truck: `mileage_km_per_litre`; for machine: `hours_per_litre`)

So the **live DB** must allow `vehicles.site_id` to be **NULL** (migration `20250226130000_vehicles_site_optional.sql`). If that migration has not been applied on the remote DB, inserts for “Free (no site)” will fail.

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
4. **If `site_id` is still NOT NULL (or add vehicle fails):** run  
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

- **Add vehicle** should work for both “Free (no site)” and “With site”.
- If it still fails, the app shows the **exact Supabase error message** in the alert; use that to fix RLS, schema, or permissions.
