DROP VIEW IF EXISTS public.vendor_estimate_coverage;

CREATE OR REPLACE FUNCTION public.vendor_estimate_coverage()
RETURNS TABLE (
  po_item_id uuid,
  purchase_order_id uuid,
  po_code text,
  po_approval_state public.approval_state,
  project_id uuid,
  project_code text,
  project_name text,
  description text,
  uom text,
  required_quantity numeric,
  wastage_percent numeric,
  ordered_quantity numeric,
  received_quantity numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    poi.id, po.id, po.po_code, po.approval_state,
    po.project_id, p.project_code, p.name,
    bi.description, bi.uom, bi.quantity, bi.wastage_percent,
    poi.quantity, poi.received_quantity
  FROM public.purchase_order_items poi
  JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
  JOIN public.boq_items bi       ON bi.id = poi.boq_item_id
  JOIN public.projects p         ON p.id = po.project_id
  WHERE po.vendor_id = public.my_portal_vendor_id()
    AND po.is_archived = false;
$$;

GRANT EXECUTE ON FUNCTION public.vendor_estimate_coverage() TO authenticated;