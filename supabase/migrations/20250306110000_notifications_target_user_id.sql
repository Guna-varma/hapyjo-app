-- Optional: target a specific user (e.g. "You are allocated to truck X at site Y").
-- When NULL, all users with target_role see the notification; when set, only that user sees it.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.notifications.target_user_id IS 'When set, only this user sees the notification (within target_role).';

-- RLS: users see notifications where target_role matches AND (target_user_id IS NULL OR target_user_id = auth.uid())
DROP POLICY IF EXISTS "Users read own role notifications" ON public.notifications;
CREATE POLICY "Users read own role notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (
    target_role = (public.current_user_role())::text
    AND (target_user_id IS NULL OR target_user_id = auth.uid())
    OR (public.current_user_role()) IN ('admin', 'owner')
  );
