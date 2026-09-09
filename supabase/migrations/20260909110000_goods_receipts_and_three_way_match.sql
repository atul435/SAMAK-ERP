-- Phase 2 (production-readiness roadmap): a real GRN entity and PO/GRN/Invoice
-- 3-way match. Previously "receiving" a PO line just bumped
-- purchase_order_items.received_quantity directly from the client, and the
-- "Goods receipts" tab matched stock_movements by string-searching the PO
-- code inside a free-text reference field. Neither left a proper receipt
-- record, and nothing ever compared what was billed against what was
-- actually received.

-- ============================================================
-- 1. goods_receipts / goods_receipt_items
-- ============================================================
CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  grn_code text NOT NULL,
  store_id uuid REFERENCES public.stores(id),
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  challan_reference text,
  remarks text,
  received_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (company_id, grn_code)
);

CREATE TABLE public.goods_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  purchase_order_item_id uuid NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE CASCADE,
  quantity_received numeric NOT NULL DEFAULT 0,
  quality_status text NOT NULL DEFAULT 'accepted' CHECK (quality_status IN ('accepted','partial','rejected')),
  stock_movement_id uuid REFERENCES public.stock_movements(id) ON DELETE SET NULL,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goods_receipt_items TO authenticated;
GRANT ALL ON public.goods_receipts TO service_role;
GRANT ALL ON public.goods_receipt_items TO service_role;

ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goods_receipts_select" ON public.goods_receipts FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "goods_receipts_write" ON public.goods_receipts FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('inventory','edit') OR public.can('procurement','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('inventory','edit') OR public.can('procurement','edit') OR public.is_admin()));

CREATE POLICY "goods_receipt_items_select" ON public.goods_receipt_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.goods_receipts g WHERE g.id = goods_receipt_id AND g.company_id = public.my_company_id()));
CREATE POLICY "goods_receipt_items_write" ON public.goods_receipt_items FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.goods_receipts g WHERE g.id = goods_receipt_id AND g.company_id = public.my_company_id())
    AND (public.can('inventory','edit') OR public.can('procurement','edit') OR public.is_admin())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.goods_receipts g WHERE g.id = goods_receipt_id AND g.company_id = public.my_company_id())
    AND (public.can('inventory','edit') OR public.can('procurement','edit') OR public.is_admin())
  );

CREATE TRIGGER trg_touch_goods_receipts BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_goods_receipt_items BEFORE UPDATE ON public.goods_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_goods_receipts AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_goods_receipt_items AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();

CREATE INDEX idx_goods_receipts_po ON public.goods_receipts(purchase_order_id);
CREATE INDEX idx_goods_receipt_items_grn ON public.goods_receipt_items(goods_receipt_id);
CREATE INDEX idx_goods_receipt_items_po_item ON public.goods_receipt_items(purchase_order_item_id);

-- ============================================================
-- 2. Roll up goods_receipt_items into purchase_order_items.received_quantity.
--    SECURITY DEFINER so a user with only inventory:edit (who may lack
--    direct UPDATE rights on purchase_order_items) can still receive goods —
--    the rollup, not the client, keeps the PO line in sync.
-- ============================================================
CREATE OR REPLACE FUNCTION public.recalc_po_item_received() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_po_item uuid;
  total numeric;
BEGIN
  target_po_item := COALESCE(NEW.purchase_order_item_id, OLD.purchase_order_item_id);
  SELECT COALESCE(SUM(quantity_received), 0) INTO total
    FROM public.goods_receipt_items
    WHERE purchase_order_item_id = target_po_item
      AND quality_status <> 'rejected';
  UPDATE public.purchase_order_items SET received_quantity = total WHERE id = target_po_item;
  RETURN COALESCE(NEW, OLD);
END; $$;

REVOKE ALL ON FUNCTION public.recalc_po_item_received() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_recalc_po_item_received
  AFTER INSERT OR UPDATE OR DELETE ON public.goods_receipt_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_po_item_received();

-- ============================================================
-- 3. PO / GRN / vendor-bill 3-way match, one row per purchase order.
--    security_invoker so it only ever shows what the querying user's own
--    RLS already lets them see on the underlying tables.
-- ============================================================
CREATE VIEW public.po_three_way_match
WITH (security_invoker = true) AS
SELECT
  t.*,
  CASE
    WHEN t.billed_amount = 0 THEN 'no_bill'
    WHEN t.billed_amount > t.received_amount * 1.02 THEN 'over_billed'
    WHEN t.received_amount > t.ordered_amount * 1.02 THEN 'over_received'
    ELSE 'ok'
  END AS match_status
FROM (
  SELECT
    po.id AS purchase_order_id,
    po.company_id,
    po.po_code,
    COALESCE(item_totals.ordered_amount, 0) AS ordered_amount,
    COALESCE(item_totals.received_amount, 0) AS received_amount,
    COALESCE(bill_totals.billed_amount, 0) AS billed_amount
  FROM public.purchase_orders po
  LEFT JOIN (
    SELECT
      purchase_order_id,
      SUM(quantity * unit_rate) AS ordered_amount,
      SUM(LEAST(received_quantity, quantity) * unit_rate) AS received_amount
    FROM public.purchase_order_items
    GROUP BY purchase_order_id
  ) item_totals ON item_totals.purchase_order_id = po.id
  LEFT JOIN (
    SELECT purchase_order_id, SUM(total_amount) AS billed_amount
    FROM public.vendor_bills
    WHERE review_state <> 'rejected' AND purchase_order_id IS NOT NULL
    GROUP BY purchase_order_id
  ) bill_totals ON bill_totals.purchase_order_id = po.id
) t;

GRANT SELECT ON public.po_three_way_match TO authenticated;
