-- Allow surveyor and accountant to insert notifications so all scenario senders can write.
-- Surveyors insert when submitting surveys; accountants when generating reports (if needed).
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;
CREATE POLICY "Insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK ((public.current_user_role())::text IN (
    'admin', 'owner', 'head_supervisor', 'assistant_supervisor',
    'driver_truck', 'driver_machine', 'surveyor', 'accountant'
  ));
