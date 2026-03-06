-- Assigned trips (trucks) and tasks (machines): lifecycle TRIP_* / TASK_* statuses.
-- Assistant Supervisor assigns; driver/operator start, pause, resume, complete (→ NEED_APPROVAL); AS confirms → COMPLETED.

CREATE TABLE public.assigned_trips (
  id text PRIMARY KEY,
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  vehicle_id text NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('truck', 'machine')),
  task_type text,
  status text NOT NULL CHECK (status IN (
    'TRIP_ASSIGNED', 'TRIP_PENDING', 'TRIP_STARTED', 'TRIP_PAUSED', 'TRIP_RESUMED', 'TRIP_IN_PROGRESS', 'TRIP_NEED_APPROVAL', 'TRIP_COMPLETED',
    'TASK_ASSIGNED', 'TASK_PENDING', 'TASK_STARTED', 'TASK_PAUSED', 'TASK_RESUMED', 'TASK_IN_PROGRESS', 'TASK_NEED_APPROVAL', 'TASK_COMPLETED'
  )),
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  paused_at timestamptz,
  resumed_at timestamptz,
  pause_segments jsonb DEFAULT '[]'::jsonb,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_assigned_trips_site_id ON public.assigned_trips(site_id);
CREATE INDEX idx_assigned_trips_driver_id ON public.assigned_trips(driver_id);
CREATE INDEX idx_assigned_trips_vehicle_id ON public.assigned_trips(vehicle_id);
CREATE INDEX idx_assigned_trips_status ON public.assigned_trips(status);

ALTER TABLE public.assigned_trips ENABLE ROW LEVEL SECURITY;

-- Assistant Supervisor: insert/update for their sites only
CREATE POLICY "AS insert assigned_trips for own sites"
  ON public.assigned_trips FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.current_user_role())::text = 'assistant_supervisor'
    AND EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.assistant_supervisor_id = auth.uid()
    )
  );

CREATE POLICY "AS update assigned_trips for own sites"
  ON public.assigned_trips FOR UPDATE
  TO authenticated
  USING (
    (public.current_user_role())::text = 'assistant_supervisor'
    AND EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.assistant_supervisor_id = auth.uid()
    )
  )
  WITH CHECK (true);

-- Driver/operator: select and update own assigned trips (start, pause, resume, complete)
CREATE POLICY "Driver select own assigned_trips"
  ON public.assigned_trips FOR SELECT
  TO authenticated
  USING (
    driver_id = auth.uid()
    OR (public.current_user_role())::text IN ('assistant_supervisor', 'head_supervisor', 'owner', 'admin')
    OR EXISTS (
      SELECT 1 FROM public.sites s
      WHERE s.id = site_id AND s.assistant_supervisor_id = auth.uid()
    )
  );

CREATE POLICY "Driver update own assigned_trips"
  ON public.assigned_trips FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.assigned_trips;
