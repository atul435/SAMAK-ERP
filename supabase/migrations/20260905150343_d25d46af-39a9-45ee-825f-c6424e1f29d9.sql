
CREATE TABLE public.vendor_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  business_name text NOT NULL,
  category text NOT NULL DEFAULT 'material',
  gstin text,
  pan text,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  address text,
  city text,
  state text,
  bank_name text,
  account_number text,
  ifsc text,
  payment_terms text,
  supplies text,
  notes text,
  review_state approval_state NOT NULL DEFAULT 'submitted',
  review_notes text,
  reviewed_by uuid REFERENCES public.employees(id),
  vendor_id uuid REFERENCES public.vendors(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.vendor_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_registrations TO authenticated;
GRANT ALL ON public.vendor_registrations TO service_role;

ALTER TABLE public.vendor_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor registration public submit" ON public.vendor_registrations
  FOR INSERT TO anon WITH CHECK (review_state = 'submitted');

CREATE POLICY "vendor registration signed-in submit" ON public.vendor_registrations
  FOR INSERT TO authenticated WITH CHECK (review_state = 'submitted' OR company_id = my_company_id());

CREATE POLICY "vendor registration select" ON public.vendor_registrations
  FOR SELECT TO authenticated USING (company_id = my_company_id());

CREATE POLICY "vendor registration update" ON public.vendor_registrations
  FOR UPDATE TO authenticated
  USING (company_id = my_company_id() AND (can('procurement','edit') OR is_admin()));

CREATE POLICY "vendor registration delete" ON public.vendor_registrations
  FOR DELETE TO authenticated
  USING (company_id = my_company_id() AND is_admin());

CREATE TRIGGER trg_touch_vendor_registrations BEFORE UPDATE ON public.vendor_registrations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_vendor_registrations_state ON public.vendor_registrations (company_id, review_state);

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS pan text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS ifsc text;
