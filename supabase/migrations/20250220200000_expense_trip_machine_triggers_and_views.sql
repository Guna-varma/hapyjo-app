-- =============================================================================
-- Production logic: expenses → sites.spent + vehicles.fuel; trips/machine_sessions → fuel deduction
-- Views: site_financials, vehicle_fuel_summary. RLS: accountant can write reports.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Expense insert: update sites.spent and (if fuel) vehicles.fuel_balance_litre
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_expense_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  add_spent bigint;
  add_litres numeric(12,2);
BEGIN
  IF NEW.type = 'general' THEN
    add_spent := COALESCE(NEW.amount_rwf, 0);
    UPDATE public.sites SET spent = spent + add_spent WHERE id = NEW.site_id;
  ELSIF NEW.type = 'fuel' THEN
    add_spent := COALESCE(NEW.fuel_cost, 0);
    add_litres := COALESCE(NEW.litres, 0);
    UPDATE public.sites SET spent = spent + add_spent WHERE id = NEW.site_id;
    IF NEW.vehicle_id IS NOT NULL AND add_litres > 0 THEN
      UPDATE public.vehicles SET fuel_balance_litre = fuel_balance_litre + add_litres WHERE id = NEW.vehicle_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS after_expense_insert ON public.expenses;
CREATE TRIGGER after_expense_insert
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.on_expense_insert();

-- -----------------------------------------------------------------------------
-- 2) Trip update to completed: compute fuel_consumed (BEFORE UPDATE), deduct vehicle
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_trip_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  mileage numeric(10,2);
  consumed numeric(12,2);
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  SELECT v.mileage_km_per_litre INTO mileage FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
  IF mileage IS NULL OR mileage <= 0 THEN
    RETURN NEW;
  END IF;
  consumed := ROUND((NEW.distance_km / mileage)::numeric, 2);
  NEW.fuel_consumed := consumed;
  UPDATE public.vehicles SET fuel_balance_litre = GREATEST(0, fuel_balance_litre - consumed) WHERE id = NEW.vehicle_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_trip_status_completed
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed')
  EXECUTE FUNCTION public.on_trip_completed();

-- -----------------------------------------------------------------------------
-- 3) Machine session update to completed: duration_hours, fuel_consumed, deduct vehicle
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_machine_session_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  hrs_per_litre numeric(10,2);
  duration_hrs numeric(10,2);
  consumed numeric(12,2);
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.end_time IS NULL THEN
    RETURN NEW;
  END IF;
  duration_hrs := ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2);
  NEW.duration_hours := duration_hrs;
  SELECT v.hours_per_litre INTO hrs_per_litre FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
  IF hrs_per_litre IS NULL OR hrs_per_litre <= 0 THEN
    RETURN NEW;
  END IF;
  consumed := ROUND((duration_hrs / hrs_per_litre)::numeric, 2);
  NEW.fuel_consumed := consumed;
  UPDATE public.vehicles SET fuel_balance_litre = GREATEST(0, fuel_balance_litre - consumed) WHERE id = NEW.vehicle_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_machine_session_status_completed ON public.machine_sessions;
CREATE TRIGGER on_machine_session_status_completed
  BEFORE UPDATE ON public.machine_sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'completed' AND NEW.status = 'completed')
  EXECUTE FUNCTION public.on_machine_session_completed();

-- -----------------------------------------------------------------------------
-- 4) View: site_financials (revenue from approved surveys, total cost, profit, remaining budget)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.site_financials AS
SELECT
  s.id AS site_id,
  s.name AS site_name,
  s.budget,
  s.spent,
  (s.budget - s.spent) AS remaining_budget,
  COALESCE(rev.revenue, 0)::bigint AS revenue,
  COALESCE(cost.total_cost, 0)::bigint AS site_total_cost,
  (COALESCE(rev.revenue, 0) - COALESCE(cost.total_cost, 0))::bigint AS profit
FROM public.sites s
LEFT JOIN (
  SELECT
    sur.site_id,
    SUM(sur.work_volume * COALESCE(sit.contract_rate_rwf, 0)) AS revenue
  FROM public.surveys sur
  JOIN public.sites sit ON sit.id = sur.site_id
  WHERE sur.status = 'approved' AND sur.work_volume IS NOT NULL
  GROUP BY sur.site_id
) rev ON rev.site_id = s.id
LEFT JOIN (
  SELECT
    site_id,
    SUM(
      CASE WHEN type = 'general' THEN COALESCE(amount_rwf, 0)
           WHEN type = 'fuel' THEN COALESCE(fuel_cost, 0)
           ELSE 0 END
    ) AS total_cost
  FROM public.expenses
  GROUP BY site_id
) cost ON cost.site_id = s.id;

-- -----------------------------------------------------------------------------
-- 5) View: vehicle_fuel_summary (fuel filled, fuel used, remaining)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.vehicle_fuel_summary AS
SELECT
  v.id AS vehicle_id,
  v.site_id,
  v.vehicle_number_or_id,
  v.type AS vehicle_type,
  COALESCE(fill.fuel_filled, 0) AS fuel_filled_litres,
  COALESCE(used.fuel_used, 0) AS fuel_used_litres,
  v.fuel_balance_litre AS remaining_litres
FROM public.vehicles v
LEFT JOIN (
  SELECT vehicle_id, SUM(COALESCE(litres, 0)) AS fuel_filled
  FROM public.expenses
  WHERE type = 'fuel' AND vehicle_id IS NOT NULL
  GROUP BY vehicle_id
) fill ON fill.vehicle_id = v.id
LEFT JOIN (
  SELECT vehicle_id, SUM(COALESCE(fuel_consumed, 0)) AS fuel_used
  FROM (
    SELECT vehicle_id, fuel_consumed FROM public.trips WHERE status = 'completed'
    UNION ALL
    SELECT vehicle_id, fuel_consumed FROM public.machine_sessions WHERE status = 'completed'
  ) u
  GROUP BY vehicle_id
) used ON used.vehicle_id = v.id;

GRANT SELECT ON public.site_financials TO authenticated;
GRANT SELECT ON public.vehicle_fuel_summary TO authenticated;

-- -----------------------------------------------------------------------------
-- 6) RLS: Accountant can insert/update reports (for Generate Report)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin owner head_supervisor write reports" ON public.reports;
CREATE POLICY "Admin owner head_supervisor write reports"
  ON public.reports FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'owner', 'head_supervisor'));

CREATE POLICY "Accountant insert update reports"
  ON public.reports FOR ALL
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'accountant')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'accountant');

-- Accountant can insert (Generate Report) and update reports
CREATE POLICY "Accountant can write reports"
  ON public.reports FOR INSERT
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'accountant');
CREATE POLICY "Accountant can update reports"
  ON public.reports FOR UPDATE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'accountant');
