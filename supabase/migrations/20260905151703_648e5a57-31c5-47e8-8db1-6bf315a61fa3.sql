CREATE TABLE public.vendor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  bill_number text NOT NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  taxable_amount numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  attachment_url text,
  review_state approval_state NOT NULL DEFAULT 'submitted',
  review_notes text,
  reviewed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  vendor_bill_id uuid REFERENCES public.vendor_bills(id) ON DELETE SET NULL,
  receipt_number text,
  receipt_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  mode text NOT NULL DEFAULT 'neft',
  reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_bills TO authenticated;
GRANT ALL ON public.vendor_bills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_receipts TO authenticated;
GRANT ALL ON public.vendor_receipts TO service_role;

ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor bills select" ON public.vendor_bills FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() OR vendor_id = public.my_portal_vendor_id());

CREATE POLICY "vendor bills insert" ON public.vendor_bills FOR INSERT TO authenticated
  WITH CHECK (
    (vendor_id = public.my_portal_vendor_id() AND review_state = 'submitted')
    OR (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.can('finance','edit') OR public.is_admin()))
  );

CREATE POLICY "vendor bills update" ON public.vendor_bills FOR UPDATE TO authenticated
  USING (
    (vendor_id = public.my_portal_vendor_id() AND review_state = 'submitted')
    OR (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.can('finance','edit') OR public.is_admin()))
  )
  WITH CHECK (
    (vendor_id = public.my_portal_vendor_id() AND review_state = 'submitted')
    OR (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.can('finance','edit') OR public.is_admin()))
  );

CREATE POLICY "vendor bills delete" ON public.vendor_bills FOR DELETE TO authenticated
  USING (
    (vendor_id = public.my_portal_vendor_id() AND review_state = 'submitted')
    OR (company_id = public.my_company_id() AND public.is_admin())
  );

CREATE POLICY "vendor receipts select" ON public.vendor_receipts FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() OR vendor_id = public.my_portal_vendor_id());

CREATE POLICY "vendor receipts insert" ON public.vendor_receipts FOR INSERT TO authenticated
  WITH CHECK (
    vendor_id = public.my_portal_vendor_id()
    OR (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.can('finance','edit') OR public.is_admin()))
  );

CREATE POLICY "vendor receipts update" ON public.vendor_receipts FOR UPDATE TO authenticated
  USING (
    vendor_id = public.my_portal_vendor_id()
    OR (company_id = public.my_company_id() AND (public.can('finance','edit') OR public.is_admin()))
  )
  WITH CHECK (
    vendor_id = public.my_portal_vendor_id()
    OR (company_id = public.my_company_id() AND (public.can('finance','edit') OR public.is_admin()))
  );

CREATE POLICY "vendor receipts delete" ON public.vendor_receipts FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.is_admin());

CREATE INDEX idx_vendor_bills_vendor ON public.vendor_bills(vendor_id);
CREATE INDEX idx_vendor_bills_po ON public.vendor_bills(purchase_order_id);
CREATE INDEX idx_vendor_bills_state ON public.vendor_bills(review_state);
CREATE INDEX idx_vendor_receipts_vendor ON public.vendor_receipts(vendor_id);

CREATE TRIGGER trg_touch_vendor_bills BEFORE UPDATE ON public.vendor_bills
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_vendor_receipts BEFORE UPDATE ON public.vendor_receipts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_vendor_bills AFTER INSERT OR UPDATE OR DELETE ON public.vendor_bills
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();