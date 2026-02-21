-- =============================================================================
-- HapyJo Ltd – Supabase schema (run this in SQL Editor after creating project)
-- =============================================================================

-- Roles enum (matches types/index.ts UserRole)
CREATE TYPE app_role AS ENUM (
  'admin', 'owner', 'head_supervisor', 'accountant', 'assistant_supervisor',
  'surveyor', 'driver_truck', 'driver_machine'
);

-- Profiles: one row per auth user (id = auth.users.id)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role app_role NOT NULL DEFAULT 'driver_truck',
  site_access text[] DEFAULT '{}',
  phone text,
  profile_image text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sites
CREATE TABLE public.sites (
  id text PRIMARY KEY,
  name text NOT NULL,
  location text NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'inactive', 'completed')),
  start_date date NOT NULL,
  budget bigint NOT NULL DEFAULT 0,
  spent bigint NOT NULL DEFAULT 0,
  progress numeric(5,2) NOT NULL DEFAULT 0,
  manager text,
  assistant_supervisor_id uuid REFERENCES public.profiles(id),
  surveyor_id uuid REFERENCES public.profiles(id),
  driver_ids uuid[] DEFAULT '{}',
  vehicle_ids text[] DEFAULT '{}',
  contract_rate_rwf bigint
);

-- Vehicles
CREATE TABLE public.vehicles (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('truck', 'machine')),
  vehicle_number_or_id text NOT NULL,
  mileage_km_per_litre numeric(10,2),
  hours_per_litre numeric(10,2),
  tank_capacity_litre numeric(12,2) NOT NULL,
  fuel_balance_litre numeric(12,2) NOT NULL DEFAULT 0,
  ideal_consumption_range text,
  health_inputs text,
  ideal_working_range text
);

-- Expenses
CREATE TABLE public.expenses (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  amount_rwf bigint NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('general', 'fuel')),
  vehicle_id text REFERENCES public.vehicles(id),
  litres numeric(12,2),
  cost_per_litre numeric(12,2),
  fuel_cost numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Trips
CREATE TABLE public.trips (
  id text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  start_lat numeric(10,6),
  start_lon numeric(10,6),
  end_lat numeric(10,6),
  end_lon numeric(10,6),
  current_lat numeric(10,6),
  current_lon numeric(10,6),
  location_updated_at timestamptz,
  distance_km numeric(12,2) NOT NULL DEFAULT 0,
  load_quantity text,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  fuel_filled_at_start numeric(12,2),
  fuel_consumed numeric(12,2),
  photo_uri text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Machine sessions
CREATE TABLE public.machine_sessions (
  id text PRIMARY KEY,
  vehicle_id text NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  duration_hours numeric(10,2),
  fuel_consumed numeric(12,2),
  status text NOT NULL CHECK (status IN ('in_progress', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Surveys
CREATE TABLE public.surveys (
  id text PRIMARY KEY,
  type text NOT NULL,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  site_name text,
  surveyor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  measurements jsonb DEFAULT '{}',
  location jsonb,
  photos text[] DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('draft', 'submitted', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  before_file_content text,
  after_file_content text,
  work_volume numeric(12,2),
  approved_by_id uuid REFERENCES public.profiles(id),
  approved_at timestamptz
);

-- Issues
CREATE TABLE public.issues (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  site_name text,
  raised_by_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  description text NOT NULL,
  image_uris text[] DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Site assignments (site_id + user_id unique)
CREATE TABLE public.site_assignments (
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL,
  vehicle_ids text[] DEFAULT '{}',
  PRIMARY KEY (site_id, user_id)
);

-- Driver–vehicle assignments per site (Assistant Supervisor)
CREATE TABLE public.driver_vehicle_assignments (
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_ids text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (site_id, driver_id)
);

-- Tasks
CREATE TABLE public.tasks (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  site_name text,
  assigned_to uuid[] DEFAULT '{}',
  status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
  due_date date NOT NULL,
  progress numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  photos text[] DEFAULT '{}'
);

-- Operations
CREATE TABLE public.operations (
  id text PRIMARY KEY,
  name text NOT NULL,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  site_name text,
  type text NOT NULL,
  status text NOT NULL CHECK (status IN ('planned', 'ongoing', 'completed')),
  budget bigint NOT NULL DEFAULT 0,
  spent bigint NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date,
  crew text[] DEFAULT '{}'
);

-- Reports
CREATE TABLE public.reports (
  id text PRIMARY KEY,
  title text NOT NULL,
  type text NOT NULL CHECK (type IN ('financial', 'operations', 'site_performance')),
  generated_date date NOT NULL,
  period text NOT NULL,
  data jsonb DEFAULT '{}'
);

-- =============================================================================
-- Trigger: create profile when a new user signs up (auth.users)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'driver_truck'::public.app_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role from profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: users can read own; admin/owner/head_supervisor can read/write all
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile (name, phone)"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor'));

-- Allow profile insert: trigger/Dashboard (service_role), backend (uid null), or self-signup (uid = id)
CREATE POLICY "Allow profile creation on signup"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor'));

-- Sites: authenticated can read; admin/head_supervisor can write
CREATE POLICY "Authenticated read sites"
  ON public.sites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin head_supervisor write sites"
  ON public.sites FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'head_supervisor'));

-- Vehicles: authenticated read; admin/owner/head_supervisor write
CREATE POLICY "Authenticated read vehicles"
  ON public.vehicles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin owner head_supervisor write vehicles"
  ON public.vehicles FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor'));

-- Expenses: authenticated read; assistant_supervisor write
CREATE POLICY "Authenticated read expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Assistant supervisor write expenses"
  ON public.expenses FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor');

-- Trips: authenticated read; drivers and supervisors write (simplified: any authenticated can insert/update trips)
CREATE POLICY "Authenticated read trips"
  ON public.trips FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated write trips"
  ON public.trips FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Machine sessions: same as trips
CREATE POLICY "Authenticated read machine_sessions"
  ON public.machine_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated write machine_sessions"
  ON public.machine_sessions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Surveys: authenticated read; assistant_supervisor surveyor write
CREATE POLICY "Authenticated read surveys"
  ON public.surveys FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Surveyor assistant_supervisor write surveys"
  ON public.surveys FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('assistant_supervisor', 'surveyor'));

-- Issues: authenticated read; drivers/assistant_supervisor can insert; head_supervisor/owner can update
CREATE POLICY "Authenticated read issues"
  ON public.issues FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Raise issue"
  ON public.issues FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = raised_by_id);

CREATE POLICY "Head supervisor owner update issues"
  ON public.issues FOR UPDATE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('head_supervisor', 'owner'));

-- Site assignments
CREATE POLICY "Authenticated read site_assignments"
  ON public.site_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin write site_assignments"
  ON public.site_assignments FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'head_supervisor'));

-- Driver vehicle assignments
CREATE POLICY "Authenticated read driver_vehicle_assignments"
  ON public.driver_vehicle_assignments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Assistant supervisor write driver_vehicle_assignments"
  ON public.driver_vehicle_assignments FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'assistant_supervisor');

-- Tasks
CREATE POLICY "Authenticated read tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated write tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Operations
CREATE POLICY "Authenticated read operations"
  ON public.operations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated write operations"
  ON public.operations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Reports
CREATE POLICY "Authenticated read reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin owner head_supervisor write reports"
  ON public.reports FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor'));

-- =============================================================================
-- Optional: updated_at trigger for profiles
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
