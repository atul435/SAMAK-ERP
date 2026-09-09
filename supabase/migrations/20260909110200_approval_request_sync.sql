-- Phase 2: the generic approval_requests/approval_actions engine and the
-- per-table approval_state columns (purchase_orders, invoices, payroll_runs)
-- never talked to each other — nothing in the app ever inserted an
-- approval_requests row, so "Approvals" could never show a PO, invoice or
-- payroll run even though each of those has its own working approve/reject
-- flow. This mirrors approval_state changes on those three tables into
-- approval_requests automatically, so the Approvals screen becomes a real
-- single queue instead of a second, disconnected approval concept.
--
-- The mirror runs AFTER the real column already changed and is wrapped in
-- its own exception handler: a bug in this best-effort sync must never block
-- the actual PO/invoice/payroll write it is attached to.
CREATE OR REPLACE FUNCTION public.sync_approval_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  req_id uuid;
  lbl text;
  amt numeric;
  proj uuid;
BEGIN
  BEGIN
    IF TG_TABLE_NAME = 'purchase_orders' THEN
      lbl := NEW.po_code || ' - ' || NEW.title;
      proj := NEW.project_id;
      SELECT COALESCE(SUM(quantity * unit_rate), 0) INTO amt
        FROM public.purchase_order_items WHERE purchase_order_id = NEW.id;
    ELSIF TG_TABLE_NAME = 'invoices' THEN
      lbl := NEW.invoice_code || ' - ' || NEW.title;
      proj := NEW.project_id;
      SELECT COALESCE(SUM(quantity * unit_rate), 0) INTO amt
        FROM public.invoice_items WHERE invoice_id = NEW.id;
    ELSIF TG_TABLE_NAME = 'payroll_runs' THEN
      lbl := 'Payroll run ' || NEW.run_code;
      proj := NULL;
      SELECT COALESCE(SUM(basic + hra + allowances + overtime
                          - pf_deduction - esi_deduction - tds_deduction - other_deduction), 0) INTO amt
        FROM public.payroll_items WHERE payroll_run_id = NEW.id;
    ELSE
      RETURN NEW;
    END IF;

    SELECT id INTO req_id FROM public.approval_requests
      WHERE entity_type = TG_TABLE_NAME AND entity_id = NEW.id;

    -- Don't clutter the queue with every brand-new draft.
    IF NEW.approval_state = 'draft' AND req_id IS NULL THEN
      RETURN NEW;
    END IF;

    IF req_id IS NULL THEN
      INSERT INTO public.approval_requests
        (company_id, request_code, entity_type, entity_id, entity_label, project_id, amount, state, requested_by, created_by)
      VALUES
        (NEW.company_id, TG_TABLE_NAME || '-' || left(NEW.id::text, 8), TG_TABLE_NAME, NEW.id, lbl, proj, amt,
         NEW.approval_state, public.my_employee_id(), auth.uid())
      ON CONFLICT (company_id, request_code) DO NOTHING;
    ELSE
      UPDATE public.approval_requests
      SET state = NEW.approval_state,
          entity_label = lbl,
          amount = amt,
          decided_at = CASE WHEN NEW.approval_state IN ('approved','rejected') THEN now() ELSE decided_at END,
          updated_at = now(),
          updated_by = auth.uid()
      WHERE id = req_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- best-effort mirror only; never block the real write
  END;
  RETURN NEW;
END; $$;

REVOKE ALL ON FUNCTION public.sync_approval_request() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_sync_approval_po AFTER INSERT OR UPDATE OF approval_state ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.sync_approval_request();
CREATE TRIGGER trg_sync_approval_invoice AFTER INSERT OR UPDATE OF approval_state ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.sync_approval_request();
CREATE TRIGGER trg_sync_approval_payroll AFTER INSERT OR UPDATE OF approval_state ON public.payroll_runs
  FOR EACH ROW EXECUTE FUNCTION public.sync_approval_request();
