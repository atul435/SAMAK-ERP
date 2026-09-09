
CREATE OR REPLACE VIEW public.boq_item_execution
WITH (security_invoker = on) AS
SELECT
  bi.id                AS boq_item_id,
  bi.boq_id            AS boq_id,
  b.project_id         AS project_id,
  b.company_id         AS company_id,
  b.approval_state     AS boq_approval_state,
  bi.description       AS description,
  bi.uom               AS uom,
  bi.item_kind         AS item_kind,
  bi.quantity          AS quantity_planned,
  bi.unit_rate         AS unit_rate,
  (bi.quantity * (1 + bi.wastage_percent / 100.0) * bi.unit_rate) AS planned_amount,
  COALESCE(x.quantity_done, 0)                     AS quantity_done,
  COALESCE(x.quantity_done, 0) * bi.unit_rate      AS executed_amount,
  CASE WHEN bi.quantity > 0
       THEN LEAST(COALESCE(x.quantity_done, 0) / bi.quantity, 1) * 100
       ELSE 0 END                                  AS percent_done,
  x.last_reported_on                               AS last_reported_on
FROM public.boq_items bi
JOIN public.boqs b ON b.id = bi.boq_id
LEFT JOIN LATERAL (
  SELECT SUM(sri.quantity_done) AS quantity_done,
         MAX(sr.report_date)    AS last_reported_on
  FROM public.site_report_items sri
  JOIN public.site_reports sr ON sr.id = sri.site_report_id
  WHERE sri.boq_item_id = bi.id
    AND sr.is_archived = false
) x ON true
WHERE b.is_archived = false;

GRANT SELECT ON public.boq_item_execution TO authenticated;
GRANT SELECT ON public.boq_item_execution TO service_role;

CREATE OR REPLACE VIEW public.project_boq_progress
WITH (security_invoker = on) AS
SELECT
  e.project_id,
  SUM(e.planned_amount)   AS planned_amount,
  SUM(LEAST(e.executed_amount, e.planned_amount)) AS executed_amount,
  CASE WHEN SUM(e.planned_amount) > 0
       THEN SUM(LEAST(e.executed_amount, e.planned_amount)) / SUM(e.planned_amount) * 100
       ELSE 0 END AS progress_percent
FROM public.boq_item_execution e
WHERE e.boq_approval_state = 'approved'
GROUP BY e.project_id;

GRANT SELECT ON public.project_boq_progress TO authenticated;
GRANT SELECT ON public.project_boq_progress TO service_role;

CREATE OR REPLACE FUNCTION public.recalc_project_progress(_project_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _planned numeric := 0;
  _done numeric := 0;
BEGIN
  SELECT COALESCE(SUM(bi.quantity * bi.unit_rate), 0),
         COALESCE(SUM(LEAST(COALESCE(x.qty, 0), bi.quantity) * bi.unit_rate), 0)
    INTO _planned, _done
  FROM public.boq_items bi
  JOIN public.boqs b ON b.id = bi.boq_id
  LEFT JOIN LATERAL (
    SELECT SUM(sri.quantity_done) AS qty
    FROM public.site_report_items sri
    JOIN public.site_reports sr ON sr.id = sri.site_report_id
    WHERE sri.boq_item_id = bi.id AND sr.is_archived = false
  ) x ON true
  WHERE b.project_id = _project_id
    AND b.is_archived = false
    AND b.approval_state = 'approved';

  IF _planned > 0 THEN
    UPDATE public.projects
       SET progress_percent = ROUND(LEAST(_done / _planned * 100, 100)::numeric, 2)
     WHERE id = _project_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_site_item_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _report_id uuid := COALESCE(NEW.site_report_id, OLD.site_report_id);
  _project_id uuid;
  _planned numeric := 0;
  _done numeric := 0;
BEGIN
  SELECT project_id INTO _project_id FROM public.site_reports WHERE id = _report_id;

  SELECT COALESCE(SUM(quantity_planned), 0), COALESCE(SUM(quantity_done), 0)
    INTO _planned, _done
  FROM public.site_report_items WHERE site_report_id = _report_id;

  IF _planned > 0 THEN
    UPDATE public.site_reports
       SET progress_percent = ROUND(LEAST(_done / _planned * 100, 100)::numeric, 2)
     WHERE id = _report_id;
  END IF;

  IF _project_id IS NOT NULL THEN
    PERFORM public.recalc_project_progress(_project_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_item_progress ON public.site_report_items;
CREATE TRIGGER trg_site_item_progress
AFTER INSERT OR UPDATE OR DELETE ON public.site_report_items
FOR EACH ROW EXECUTE FUNCTION public.sync_site_item_progress();
