-- =============================================================================
-- Weighted site progress via predefined per-site tasks
--
-- Core concept:
-- 1) Each site has predefined tasks with weights (sum = 100)
-- 2) Assistant Supervisor updates task status + task progress (integer)
-- 3) Overall sites.progress is auto-calculated:
--      SUM(weight * progress / 100)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Table: site_tasks
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_tasks (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  site_id text NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  weight int NOT NULL CHECK (weight >= 1 AND weight <= 100),
  status text NOT NULL CHECK (status IN ('not_started', 'started', 'in_progress', 'completed')) DEFAULT 'not_started',
  progress int NOT NULL CHECK (progress >= 0 AND progress <= 100) DEFAULT 0,
  notes text,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_tasks_site_id_idx ON public.site_tasks(site_id);

-- Keep updated_at fresh (reuse existing function)
DROP TRIGGER IF EXISTS site_tasks_updated_at ON public.site_tasks;
CREATE TRIGGER site_tasks_updated_at
  BEFORE UPDATE ON public.site_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce progress rules + updated_by
CREATE OR REPLACE FUNCTION public.enforce_site_task_progress()
RETURNS trigger AS $$
BEGIN
  -- Auto-set progress from status (hard rules)
  IF NEW.status = 'completed' THEN
    NEW.progress := 100;
  ELSIF NEW.status = 'not_started' THEN
    NEW.progress := 0;
  END IF;

  -- Validate started / in_progress must be 1..100 (no 0)
  IF (NEW.status IN ('started', 'in_progress')) AND (NEW.progress < 1 OR NEW.progress > 100) THEN
    RAISE EXCEPTION 'Task progress must be between 1 and 100 for status %', NEW.status;
  END IF;

  -- Track who updated (when called via Supabase)
  NEW.updated_by := auth.uid();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_tasks_enforce_progress ON public.site_tasks;
CREATE TRIGGER site_tasks_enforce_progress
  BEFORE INSERT OR UPDATE ON public.site_tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_site_task_progress();

-- -----------------------------------------------------------------------------
-- Auto-calc sites.progress from weighted site_tasks
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_site_progress(p_site_id text)
RETURNS void AS $$
DECLARE
  pct int;
BEGIN
  SELECT COALESCE(ROUND(SUM(st.weight * st.progress / 100.0))::int, 0)
    INTO pct
  FROM public.site_tasks st
  WHERE st.site_id = p_site_id;

  pct := LEAST(100, GREATEST(0, pct));

  UPDATE public.sites
    SET progress = pct
  WHERE id = p_site_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.on_site_task_changed()
RETURNS trigger AS $$
DECLARE
  sid text;
BEGIN
  sid := COALESCE(NEW.site_id, OLD.site_id);
  PERFORM public.recalculate_site_progress(sid);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS site_tasks_recalc_site_progress ON public.site_tasks;
CREATE TRIGGER site_tasks_recalc_site_progress
  AFTER INSERT OR UPDATE OR DELETE ON public.site_tasks
  FOR EACH ROW EXECUTE FUNCTION public.on_site_task_changed();

-- -----------------------------------------------------------------------------
-- Task template: auto-create tasks when a site is created
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_site_tasks()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.site_tasks (site_id, task_name, weight)
  VALUES
    (NEW.id, 'Pre-cut survey', 5),
    (NEW.id, 'Land clearing', 10),
    (NEW.id, 'Excavation', 35),
    (NEW.id, 'Rock breaking', 10),
    (NEW.id, 'Soil transport', 10),
    (NEW.id, 'Leveling', 10),
    (NEW.id, 'Compaction', 10),
    (NEW.id, 'After-cut survey', 5),
    (NEW.id, 'Final finishing', 5);

  -- ensure site progress is 0 on create
  PERFORM public.recalculate_site_progress(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sites_create_default_tasks ON public.sites;
CREATE TRIGGER sites_create_default_tasks
  AFTER INSERT ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.create_default_site_tasks();

-- Backfill: create tasks for existing sites that don't have any
INSERT INTO public.site_tasks (site_id, task_name, weight)
SELECT s.id, tpl.task_name, tpl.weight
FROM public.sites s
CROSS JOIN (
  VALUES
    ('Pre-cut survey', 5),
    ('Land clearing', 10),
    ('Excavation', 35),
    ('Rock breaking', 10),
    ('Soil transport', 10),
    ('Leveling', 10),
    ('Compaction', 10),
    ('After-cut survey', 5),
    ('Final finishing', 5)
) AS tpl(task_name, weight)
WHERE NOT EXISTS (
  SELECT 1 FROM public.site_tasks st WHERE st.site_id = s.id
);

-- Recalc progress for all sites
DO $$
DECLARE
  s record;
BEGIN
  FOR s IN (SELECT id FROM public.sites) LOOP
    PERFORM public.recalculate_site_progress(s.id);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- RLS: strict permissions
-- - Owner/Head Supervisor/Admin/Accountant: read only
-- - Assistant Supervisor: can read + update tasks only for assigned sites
-- -----------------------------------------------------------------------------
ALTER TABLE public.site_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers read all site_tasks" ON public.site_tasks;
CREATE POLICY "Managers read all site_tasks"
  ON public.site_tasks FOR SELECT
  TO authenticated
  USING ((public.current_user_role()) IN ('admin', 'owner', 'head_supervisor', 'accountant'));

DROP POLICY IF EXISTS "Assistant supervisor read assigned site_tasks" ON public.site_tasks;
CREATE POLICY "Assistant supervisor read assigned site_tasks"
  ON public.site_tasks FOR SELECT
  TO authenticated
  USING (
    (public.current_user_role()) = 'assistant_supervisor'
    AND site_id IN (SELECT id FROM public.sites WHERE assistant_supervisor_id = auth.uid())
  );

DROP POLICY IF EXISTS "Assistant supervisor update assigned site_tasks" ON public.site_tasks;
CREATE POLICY "Assistant supervisor update assigned site_tasks"
  ON public.site_tasks FOR UPDATE
  TO authenticated
  USING (
    (public.current_user_role()) = 'assistant_supervisor'
    AND site_id IN (SELECT id FROM public.sites WHERE assistant_supervisor_id = auth.uid())
  )
  WITH CHECK (
    (public.current_user_role()) = 'assistant_supervisor'
    AND site_id IN (SELECT id FROM public.sites WHERE assistant_supervisor_id = auth.uid())
  );

