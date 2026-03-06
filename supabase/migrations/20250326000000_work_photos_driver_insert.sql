-- Allow drivers to INSERT work_photos for trip proof (speedometer) uploads.
-- Existing policy only allows surveyor and assistant_supervisor.
-- Drivers must be able to insert their own row (uploaded_by = auth.uid()).

DROP POLICY IF EXISTS "work_photos_insert_driver" ON public.work_photos;
CREATE POLICY "work_photos_insert_driver"
  ON public.work_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('driver_truck', 'driver_machine')
  );

-- Drivers can read their own work_photos (for trip evidence display).
DROP POLICY IF EXISTS "work_photos_select_driver_own" ON public.work_photos;
CREATE POLICY "work_photos_select_driver_own"
  ON public.work_photos FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('driver_truck', 'driver_machine')
    AND uploaded_by = auth.uid()
  );
