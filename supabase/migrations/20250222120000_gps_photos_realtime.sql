-- Enable Supabase Realtime for gps_photos so clients get live INSERT/UPDATE/DELETE.
-- Required for real-time UI when GPS photos are saved or listed elsewhere.
ALTER PUBLICATION supabase_realtime ADD TABLE public.gps_photos;
