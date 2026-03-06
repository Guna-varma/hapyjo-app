-- Allow INSERT without "type": use default so app (lightweight flow) does not need to send it.
-- Safe if column was already dropped by 20250316100000_surveys_lightweight (ALTER COLUMN does nothing).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'surveys' AND column_name = 'type'
  ) THEN
    ALTER TABLE public.surveys ALTER COLUMN type SET DEFAULT 'before_after';
    UPDATE public.surveys SET type = 'before_after' WHERE type IS NULL;
  END IF;
END $$;
