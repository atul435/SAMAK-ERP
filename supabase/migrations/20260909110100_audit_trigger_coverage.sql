-- Phase 2: the audit trigger was attached to header tables (boqs, invoices,
-- purchase_orders...) but not to the line-item tables underneath them —
-- exactly where a quantity or rate edit actually moves money. Each of these
-- already has trg_touch_* (so the updated_at/updated_by columns exist); they
-- were just never wired to write_audit().
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'boq_sections',
    'boq_items',
    'purchase_order_items',
    'invoice_items',
    'payroll_items',
    'site_report_items',
    'vendor_receipts'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.write_audit();',
      t
    );
  END LOOP;
END $$;
