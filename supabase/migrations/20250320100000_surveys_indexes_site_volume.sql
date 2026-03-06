-- =============================================================================
-- Targeted select + indexed queries + running total per site.
-- Reduces dashboard load time as surveys/trips/notifications grow.
-- No business logic or UI change; only DB performance and optional site volume.
-- =============================================================================

-- 1) Survey indexes (site_id, survey_date, status)
CREATE INDEX IF NOT EXISTS idx_surveys_site_date
  ON public.surveys (site_id, survey_date DESC);

CREATE INDEX IF NOT EXISTS idx_surveys_status
  ON public.surveys (status);

-- Partial index for approved-only queries (dashboards)
CREATE INDEX IF NOT EXISTS idx_surveys_approved
  ON public.surveys (site_id, survey_date)
  WHERE status = 'approved';

-- 2) Site running total (total excavated volume, maintained by trigger)
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS total_excavated_m3 numeric(14,2) DEFAULT 0 NOT NULL;

-- Backfill from existing approved surveys
UPDATE public.sites s
SET total_excavated_m3 = COALESCE(
  (SELECT SUM(sur.volume_m3) FROM public.surveys sur WHERE sur.site_id = s.id AND sur.status = 'approved' AND sur.volume_m3 IS NOT NULL),
  0
);

-- 3) Trigger: when a survey becomes APPROVED, add its volume to site total
CREATE OR REPLACE FUNCTION public.update_site_volume_on_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.sites
    SET total_excavated_m3 = total_excavated_m3 + COALESCE(NEW.volume_m3, 0)
    WHERE id = NEW.site_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS survey_volume_update ON public.surveys;
CREATE TRIGGER survey_volume_update
  AFTER INSERT OR UPDATE ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.update_site_volume_on_approval();

-- 4) Trigger: when an approved survey is deleted, subtract its volume
CREATE OR REPLACE FUNCTION public.adjust_site_volume_on_survey_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved' AND OLD.volume_m3 IS NOT NULL AND OLD.volume_m3 <> 0 THEN
    UPDATE public.sites
    SET total_excavated_m3 = GREATEST(0, total_excavated_m3 - OLD.volume_m3)
    WHERE id = OLD.site_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS survey_volume_adjust ON public.surveys;
CREATE TRIGGER survey_volume_adjust
  AFTER DELETE ON public.surveys
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_site_volume_on_survey_delete();

-- 5) Notifications index (target_role + created_at for dashboard query)
CREATE INDEX IF NOT EXISTS idx_notifications_target_role_created_at
  ON public.notifications (target_role, created_at DESC);
