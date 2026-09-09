CREATE OR REPLACE VIEW public.vendor_estimate_coverage
WITH (security_invoker = false) AS
SELECT
  poi.id            AS po_item_id,
  po.id             AS purchase_order_id,
  po.po_code,
  po.approval_state AS po_approval_state,
  po.vendor_id,
  po.project_id,
  p.project_code,
  p.name            AS project_name,
  bi.id             AS boq_item_id,
  bi.description,
  bi.uom,
  bi.quantity       AS required_quantity,
  bi.wastage_percent,
  poi.quantity      AS ordered_quantity,
  poi.received_quantity
FROM public.purchase_order_items poi
JOIN public.purchase_orders po ON po.id = poi.purchase_order_id
JOIN public.boq_items bi       ON bi.id = poi.boq_item_id
JOIN public.projects p         ON p.id = po.project_id
WHERE po.vendor_id = public.my_portal_vendor_id()
  AND po.is_archived = false;

GRANT SELECT ON public.vendor_estimate_coverage TO authenticated;