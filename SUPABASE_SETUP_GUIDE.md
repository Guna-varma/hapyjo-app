# Supabase setup guide – HapyJo Ltd (step-by-step)

This guide takes you from zero to a fully working Supabase project: **auth (login with email/password)**, **database tables**, and **first admin user**. Follow the steps in order.

**Before you begin:** You need a web browser, an email to sign up at Supabase, and this project open (with the folder `supabase` and the file `supabase/schema.sql`). No prior Supabase experience required.

---

## Part 1: Create your Supabase project

### Step 1.1 – Sign up or log in

1. Open a browser and go to: **https://supabase.com**
2. Click **“Start your project”** (or **“Sign in”** if you already have an account).
3. Sign in with **GitHub**, **Google**, or **Email**.
4. If you use email, check your inbox and confirm your email.

### Step 1.2 – Create a new project

1. After login, you should see the **Supabase Dashboard**.
2. Click **“New Project”**.
3. Choose or create an **Organization** (e.g. “My Org” or “HapyJo”).
4. Fill in:
   - **Name:** e.g. `hapyjo-app`
   - **Database Password:** Create a **strong password** and **save it somewhere safe** (you need it for direct DB access; the app will use the anon key, not this password).
   - **Region:** Pick the closest to your users (e.g. Frankfurt, North Virginia).
5. Click **“Create new project”**.
6. Wait 1–2 minutes until the project status is **Active** (green).

### Step 1.3 – Get your project URL and anon key

1. In the left sidebar, click **“Project Settings”** (gear icon at the bottom).
2. Click **“API”** in the left menu under Project Settings.
3. You will see:
   - **Project URL** – e.g. `https://xxxxxxxxxxxxx.supabase.co`
   - **Project API keys:**
     - **anon public** – safe to use in your app (this is what the React Native app will use).
4. Copy and save both somewhere safe (you will put them in your app in Part 4).

---

## Part 2: Turn on Email/Password auth

### Step 2.1 – Enable Email provider

1. In the left sidebar, click **“Authentication”**.
2. Click **“Providers”** (or “Auth” → “Providers”).
3. Find **“Email”** and make sure it is **Enabled** (it usually is by default).
4. Optional: under **“Confirm email”** you can turn **“Confirm email”** **OFF** for testing so new users can log in immediately without clicking a link. For production, leave it ON.

### Step 2.2 – (Optional) Disable other sign-in methods

If you only want email + password:

- Under **Providers**, leave **Email** ON and turn **OFF** any you don’t need (e.g. Google, GitHub, Magic Link) so users can only sign in with email/password.

---

## Part 3: Create all database tables and auth trigger

### Step 3.1 – Open the SQL Editor

1. In the left sidebar, click **“SQL Editor”**.
2. Click **“New query”** so you have an empty editor.

### Step 3.2 – Run the full schema

1. Open the file **`supabase/schema.sql`** from this project in a text editor.
2. Select **all** the SQL (Ctrl+A / Cmd+A) and **copy** it.
3. Paste it into the Supabase **SQL Editor**.
4. Click **“Run”** (or press Ctrl+Enter / Cmd+Enter).
5. You should see **“Success. No rows returned”** (or similar). That means:
   - All tables are created: `profiles`, `sites`, `vehicles`, `expenses`, `trips`, `machine_sessions`, `surveys`, `issues`, `site_assignments`, `driver_vehicle_assignments`, `tasks`, `operations`, `reports`.
   - The trigger that creates a **profile** when someone signs up is active.
   - Row Level Security (RLS) is enabled and policies are in place.

If you see any **red error**, read the message. Common fixes:

- **“relation already exists”** – You already ran the script once; either skip or drop tables and run again (only in dev).
- **“permission denied”** – Make sure you are in the correct project and ran the script in the SQL Editor (not in a different database).

---

## Part 4: Create your first admin user (email + password)

You have two options. Use **one** of them.

---

### Option A – Create admin via Supabase Dashboard (easiest)

1. In the left sidebar, click **“Authentication”** → **“Users”**.
2. Click **“Add user”** → **“Create new user”**.
3. Fill in:
   - **Email:** e.g. `admin@hapyjo.rw` (use a real email if you want to receive reset emails).
   - **Password:** Choose a strong password and **remember it** (this is the admin’s login password).
   - Optionally set **“Auto Confirm User”** to **ON** so the user can log in immediately.
4. Click **“Create user”**.
5. A row will appear in the **Users** list. Click that user to open the detail.
6. Copy the user’s **UUID** (e.g. `a1b2c3d4-e5f6-7890-abcd-ef1234567890`). You need it for the next step.
7. Open the **SQL Editor** again, **New query**, and run (replace `THE_USER_UUID_HERE` with the UUID you copied):

```sql
UPDATE public.profiles
SET role = 'admin', name = 'Admin User'
WHERE id = 'THE_USER_UUID_HERE';
```

8. Click **Run**. Now that user is an **admin** and can log in with the email and password you set.  
   (The SQL Editor runs with full database rights, so this UPDATE always works even before any admin exists.)

---

### Option B – Create admin entirely with SQL (advanced)

1. In **SQL Editor**, run the following. Replace the email and password with your own (password must be strong).

```sql
-- Insert into auth.users (Supabase stores hashed password; this is a simplified example).
-- In practice, the easiest way is to create the user in Dashboard (Option A) then run the UPDATE above.
-- If you prefer to create user via SQL, use the Supabase Auth Admin API from a backend or run:
-- SELECT extensions.create_user(
--   'admin@hapyjo.rw',
--   'YourSecurePassword123!',
--   '{"name": "Admin User"}'
-- );
-- Then run: UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@hapyjo.rw';
```

Supabase does not expose a simple “insert user with password” in raw SQL; the standard way is **Option A** (Dashboard + one SQL `UPDATE`). So we recommend **Option A** for creating the first admin.

---

## Part 5: Put Supabase keys in your app

### Step 5.1 – Create or edit `.env`

1. In your project root (same folder as `package.json`), create a file named **`.env`** if it doesn’t exist.
2. Add these two lines (use **your** Project URL and anon key from Step 1.3):

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Save the file.
4. **Important:** Add `.env` to `.gitignore` so you never commit keys to Git. If `.gitignore` already has `.env`, you’re good.

### Step 5.2 – Install Supabase client in the app

In the project root, run:

```bash
npm install @supabase/supabase-js
```

(or `npx expo install @supabase/supabase-js` if you use Expo).

---

## Part 5b: Production migrations and Edge Function (optional)

After the base schema is in place, you can apply **migrations** and deploy the **create_user_by_owner** Edge Function so Owners can create real users from the app.

### Run migrations in SQL Editor

1. Open **SQL Editor** in the Supabase Dashboard.
2. Run each file in `supabase/migrations/` in order (by filename timestamp), e.g.:
   - `20250219200000_handle_new_user_metadata_role.sql` – secure trigger for new users (role from metadata, `site_access = '{}'`, `active = true`).
   - `20250219210000_survey_approval_rbac.sql` – survey read policy so Owner/Head/Admin see only approved surveys; Assistant Supervisor sees site surveys and can approve.

### Deploy Edge Function create_user_by_owner

1. Install Supabase CLI: `npm install -g supabase` (or see [Supabase CLI](https://supabase.com/docs/guides/cli)).
2. Log in: `supabase login`.
3. Link the project: `supabase link --project-ref YOUR_PROJECT_REF` (find the ref in Project Settings → General).
4. Deploy the function: `supabase functions deploy create_user_by_owner --no-verify-jwt`.
5. Deploy the password-reset function: `supabase functions deploy reset_user_password --no-verify-jwt`.
6. The app’s **User Management** screen will call `create_user_by_owner` when an Owner/Admin/Head Supervisor creates a user (internal email `name@hapyjo.com`, name, phone, role, optional site). The function returns a **temporary password** to share (Copy or WhatsApp). **Reset password** uses `reset_user_password` so the owner can generate a new temporary password and share it again.

### Run migrations and deploy (Supabase CLI)

From the project root (run in a normal terminal, not as Administrator):

```bash
supabase link --project-ref dobfzbdwyimicxzcssiw
supabase db push
supabase functions deploy create_user_by_owner --no-verify-jwt
supabase functions deploy reset_user_password --no-verify-jwt
```

Or on Windows PowerShell: `.\scripts\supabase-deploy.ps1`

If the **gps-images** bucket is not created by the migration, create it in Dashboard: Storage → New bucket → name `gps-images`, public, allow image/jpeg.

### Edge Function secrets

In **production**, Supabase automatically provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions. You do **not** set these via the CLI (the CLI will skip any secret whose name starts with `SUPABASE_`). For **local** testing, use `supabase/functions/.env` or `--env-file .env`.

### Seed auth users (first login)

1. In Dashboard → Project Settings → API, copy the **service_role** key and add to `.env`: `SUPABASE_SERVICE_ROLE_KEY=...`
2. Run: `node scripts/seed-auth-users.js`
3. The script creates **admin@hapyjo.com** with password **HapyjoAdmin2025!** (or resets it), optionally **Owner@hapyjo.rw**, and prints all **email** and **password** for login.

**First login:** **admin@hapyjo.com** / **HapyjoAdmin2025!**

### GPS Camera (no API key)

The GPS Map Camera uses OpenStreetMap + Nominatim only (no Google, no API key). No extra env vars needed. Drivers use the GPS Camera tab to capture and upload to the **gps-images** bucket.

---

## Part 6: What you have so far (checklist)

- [ ] Supabase project created and **Active**
- [ ] **Project URL** and **anon key** saved and added to `.env`
- [ ] **Email** auth provider enabled
- [ ] **All tables and RLS** created by running `supabase/schema.sql`
- [ ] **First admin user** created (Dashboard + SQL `UPDATE` to set `role = 'admin'`)
- [ ] **`@supabase/supabase-js`** installed in the app

---

## Part 7: Tables created (reference)

| Table | Purpose |
|-------|--------|
| `profiles` | One row per user (id = auth user id). Stores name, email, role, site_access, phone, active. |
| `sites` | Site locations (name, location, budget, spent, status, driver_ids, vehicle_ids, etc.). |
| `vehicles` | Trucks and machines (site_id, type, fuel, mileage, health_inputs, ideal_working_range, etc.). |
| `expenses` | Expenses (site, amount, type: general/fuel, vehicle_id, litres, date). |
| `trips` | Truck trips (vehicle, driver, site, start/end time, distance, fuel, photo_uri). |
| `machine_sessions` | Machine work sessions (vehicle, driver, site, duration, fuel). |
| `surveys` | Survey records (surveyor, site, measurements, status). |
| `issues` | Issues (site, raised_by, description, image_uris, status). |
| `site_assignments` | Which user is assigned to which site (site_id, user_id, role). |
| `driver_vehicle_assignments` | Per site: which driver can use which vehicles (site_id, driver_id, vehicle_ids). |
| `tasks` | Tasks (title, site, assigned_to, status, priority, due_date). |
| `operations` | Operations (name, site, type, status, budget, crew). |
| `reports` | Generated reports (title, type, period, data json). |

All tables have **Row Level Security (RLS)** so that only allowed roles can read/write (e.g. admin/owner/head_supervisor for users and sites; drivers for trips; etc.).

---

## Part 8: Next steps (connect the app to Supabase)

After you finish Parts 1–6, you will:

1. **Create a Supabase client** in the app (e.g. `lib/supabase.ts`) using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. **Replace mock login** in `AuthContext` with `supabase.auth.signInWithPassword({ email, password })`.
3. **After login**, fetch the current user’s profile from `public.profiles` where `id = auth.uid()` and use that (name, role, etc.) in the app.
4. **Replace MockAppStore** with real Supabase calls: read/write `sites`, `vehicles`, `trips`, `issues`, etc., using the same table and column names as in `supabase/schema.sql`.

This guide gets you to **backend auth + DB fully set up with no gaps**. The actual wiring of each screen to Supabase (replacing mock data) can be done screen-by-screen in a follow-up.

---

## Part 9: Supabase CLI (local config and linking)

The project is set up for the **Supabase CLI**: local config and a **migrations** folder are in place.

### What’s already done

- **Local config:** `supabase/config.toml` (created by `supabase init`).
- **Migrations folder:** `supabase/migrations/` – migrations are enabled in config (`[db.migrations] enabled = true`). Add new migrations as timestamped SQL files, e.g. `20250219120000_add_feature.sql`.

### Link to your remote project (access token)

1. **Get your project reference**  
   From your project URL (e.g. `https://dobfzbdwyimicxzcssiw.supabase.co`) the **project ref** is: `dobfzbdwyimicxzcssiw`.

2. **Create an access token**  
   - Go to [Supabase Dashboard → Account → Access Tokens](https://supabase.com/dashboard/account/tokens).  
   - Create a token and copy it.

3. **Link from the project root** (PowerShell):

   ```powershell
   $env:SUPABASE_ACCESS_TOKEN = "your_access_token_here"
   npx supabase link --project-ref dobfzbdwyimicxzcssiw
   ```

   When prompted, enter your **database password** (the one you set when creating the project).  
   After a successful link, the CLI will use this project for `supabase db push`, `supabase functions deploy`, etc.

4. **Optional: login instead of token**  
   You can run `npx supabase login` and sign in in the browser; the CLI will store the token. Then run `npx supabase link --project-ref dobfzbdwyimicxzcssiw` without setting `SUPABASE_ACCESS_TOKEN`.

---

## Quick reference: Create first admin (copy-paste)

1. **Authentication** → **Users** → **Add user** → **Create new user**  
   - Email: `admin@hapyjo.rw`  
   - Password: (your choice)  
   - Auto Confirm User: **ON**

2. Copy the new user’s **UUID** from the user detail page.

3. **SQL Editor** → New query → run (replace UUID):

```sql
UPDATE public.profiles
SET role = 'admin', name = 'Admin User'
WHERE id = 'PASTE_UUID_HERE';
```

4. Log in in your app with that email and password once the app is connected to Supabase.
