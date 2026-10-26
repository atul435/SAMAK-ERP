-- Job costing for maintenance contracts, computed rather than stored: a
-- manually-entered cost table would drift from the timesheets, material
-- usage and equipment hours it is supposed to summarise.
--
-- Cost of a visit = labour (timesheet hours x the employee's hourly cost,
-- derived from employee_compensation.monthly_gross) + material usage
-- (quantity x unit cost, falling back to the materials catalogue rate) +
-- equipment hours x the equipment's hourly cost rate. Everything is
-- attributed by the visit's planned date, so "a month" means "the visits
-- scheduled that month", and rolled up per contract through
-- maintenance_sites.contract_id. Timesheet hours that are not linked to a
-- visit cannot be attributed to a contract and are not counted.
--
-- Pay is confidential: employee_compensation is RLS-limited to HR, the
-- employee themself and admins. This function is SECURITY DEFINER so a
-- maintenance manager can see labour cost without HR access, but it only
-- ever returns per-contract aggregates, requires care.view, and withholds
-- labour cost entirely when a single employee's hours make up a contract's
-- labour (otherwise margin would reveal that one person's pay). That
-- threshold is the "= 1" below; raise it to withhold more aggressively.

ALTER TABLE public.maintenance_equipment ADD COLUMN hourly_cost_rate numeric;

CREATE OR REPLACE FUNCTION public.maintenance_contract_costing(
  p_month_start date,
  p_overtime_multiplier numeric DEFAULT 2,
  p_standard_monthly_hours numeric DEFAULT 208
)
RETURNS TABLE (
  contract_id uuid,
  contract_code text,
  title text,
  client_name text,
  revenue numeric,
  visit_count integer,
  labour_hours numeric,
  labour_cost numeric,
  labour_withheld boolean,
  material_cost numeric,
  equipment_cost numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_start date := date_trunc('month', p_month_start)::date;
  v_end date := (date_trunc('month', p_month_start) + interval '1 month' - interval '1 day')::date;
BEGIN
  IF NOT (public.can('care', 'view') OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not permitted to view maintenance costing';
  END IF;
  IF p_standard_monthly_hours IS NULL OR p_standard_monthly_hours <= 0 THEN
    RAISE EXCEPTION 'Standard monthly hours must be greater than zero';
  END IF;

  RETURN QUERY
  WITH visits AS (
    SELECT t.id AS task_id, s.contract_id AS contract_id
    FROM public.maintenance_tasks t
    JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE s.company_id = public.my_company_id()
      AND s.contract_id IS NOT NULL
      AND t.planned_date BETWEEN v_start AND v_end
      AND t.status <> 'cancelled'
  ),
  visit_counts AS (
    SELECT v.contract_id, count(*)::integer AS n
    FROM visits v GROUP BY v.contract_id
  ),
  labour AS (
    SELECT v.contract_id,
           sum(ts.hours_worked + ts.overtime_hours) AS hours,
           sum((ts.hours_worked + ts.overtime_hours * p_overtime_multiplier)
               * COALESCE(comp.monthly_gross, 0) / p_standard_monthly_hours) AS cost,
           count(DISTINCT ts.employee_id) AS people
    FROM visits v
    JOIN public.maintenance_timesheets ts ON ts.task_id = v.task_id
    LEFT JOIN LATERAL (
      SELECT c.monthly_gross
      FROM public.employee_compensation c
      WHERE c.employee_id = ts.employee_id AND c.effective_from <= ts.work_date
      ORDER BY c.effective_from DESC
      LIMIT 1
    ) comp ON true
    GROUP BY v.contract_id
  ),
  material AS (
    SELECT v.contract_id,
           sum(mu.quantity_used * COALESCE(mu.unit_cost, m.standard_rate, 0)) AS cost
    FROM visits v
    JOIN public.maintenance_material_usage mu ON mu.task_id = v.task_id
    LEFT JOIN public.materials m ON m.id = mu.material_id
    GROUP BY v.contract_id
  ),
  equipment AS (
    SELECT v.contract_id,
           sum(eu.hours_used * COALESCE(e.hourly_cost_rate, 0)) AS cost
    FROM visits v
    JOIN public.maintenance_equipment_usage eu ON eu.task_id = v.task_id
    LEFT JOIN public.maintenance_equipment e ON e.id = eu.equipment_id
    GROUP BY v.contract_id
  )
  SELECT
    c.id,
    c.contract_code,
    c.title,
    cl.name,
    CASE WHEN c.status = 'active'
              AND (c.start_date IS NULL OR c.start_date <= v_end)
              AND (c.end_date IS NULL OR c.end_date >= v_start)
         THEN COALESCE(c.monthly_fee, 0) ELSE 0 END,
    COALESCE(vc.n, 0),
    COALESCE(l.hours, 0),
    CASE WHEN COALESCE(l.people, 0) = 1 AND COALESCE(l.cost, 0) > 0
         THEN NULL ELSE COALESCE(l.cost, 0) END,
    (COALESCE(l.people, 0) = 1 AND COALESCE(l.cost, 0) > 0),
    COALESCE(m.cost, 0),
    COALESCE(e.cost, 0)
  FROM public.maintenance_contracts c
  JOIN public.clients cl ON cl.id = c.client_id
  LEFT JOIN visit_counts vc ON vc.contract_id = c.id
  LEFT JOIN labour l ON l.contract_id = c.id
  LEFT JOIN material m ON m.contract_id = c.id
  LEFT JOIN equipment e ON e.contract_id = c.id
  WHERE c.company_id = public.my_company_id()
    AND NOT c.is_archived
    AND (vc.n IS NOT NULL
         OR (c.status = 'active'
             AND (c.start_date IS NULL OR c.start_date <= v_end)
             AND (c.end_date IS NULL OR c.end_date >= v_start)))
  ORDER BY c.contract_code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.maintenance_contract_costing(date, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.maintenance_contract_costing(date, numeric, numeric) TO authenticated;
