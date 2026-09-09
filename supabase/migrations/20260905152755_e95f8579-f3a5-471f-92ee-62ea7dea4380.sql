CREATE TABLE public.tenders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.my_company_id(),
  tender_ref text NOT NULL,
  organisation text NOT NULL,
  title text NOT NULL,
  description text,
  keyword_matched text,
  published_on date,
  closing_on date,
  estimated_value numeric(14,2),
  location text,
  state text,
  source_name text,
  source_url text,
  status text NOT NULL DEFAULT 'new',
  is_starred boolean NOT NULL DEFAULT false,
  notes text,
  reviewed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_tenders_unique_ref ON public.tenders (company_id, lower(tender_ref));
CREATE INDEX idx_tenders_closing ON public.tenders (closing_on);
CREATE INDEX idx_tenders_status ON public.tenders (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenders TO authenticated;
GRANT ALL ON public.tenders TO service_role;

ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenders select" ON public.tenders FOR SELECT TO authenticated
  USING (company_id = public.my_company_id() AND public.my_employee_id() IS NOT NULL);

CREATE POLICY "tenders insert" ON public.tenders FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id()
    AND (public.can('sales','edit') OR public.can('crm','edit') OR public.is_admin()));

CREATE POLICY "tenders update" ON public.tenders FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id()
    AND (public.can('sales','edit') OR public.can('crm','edit') OR public.is_admin()));

CREATE POLICY "tenders delete" ON public.tenders FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND public.is_admin());

CREATE TRIGGER trg_touch_tenders BEFORE UPDATE ON public.tenders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();