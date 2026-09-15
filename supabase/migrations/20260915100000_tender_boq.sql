-- Tender BOQs: the client-issued rate schedule a developer/main
-- contractor sends with a tender (project header, then a flat ordered
-- list of section headers, sub-groupers and priced line items, e.g.
-- "A" / "B.6" as headers with no quantity, "B.1" / "E.1" as fillable
-- items with a quantity and unit already fixed by the client). Samak's
-- job is only to fill in the Rate column per item; Amount is quantity *
-- rate, computed in the app, never stored, matching how boq_items'
-- lineAmount works. Kept flat (item_code + sort_order) rather than a
-- nested section tree, since that is exactly the shape of the source
-- spreadsheet and needs no reinterpretation to round-trip back to it.
CREATE TABLE public.tender_boqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tender_id uuid REFERENCES public.tenders(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  project_name text NOT NULL,
  work_description text,
  status text NOT NULL DEFAULT 'draft',
  prepared_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.tender_boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_boq_id uuid NOT NULL REFERENCES public.tender_boqs(id) ON DELETE CASCADE,
  item_code text,
  description text NOT NULL,
  quantity numeric,
  uom text,
  rate numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tender_boq_items_boq ON public.tender_boq_items(tender_boq_id);
CREATE INDEX idx_tender_boqs_tender ON public.tender_boqs(tender_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_boqs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tender_boq_items TO authenticated;
GRANT ALL ON public.tender_boqs TO service_role;
GRANT ALL ON public.tender_boq_items TO service_role;

ALTER TABLE public.tender_boqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tender_boq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tender_boqs select company" ON public.tender_boqs FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "tender_boqs insert" ON public.tender_boqs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin()));
CREATE POLICY "tender_boqs update" ON public.tender_boqs FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "tender_boqs delete" ON public.tender_boqs FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin()));

CREATE POLICY "tender_boq_items select" ON public.tender_boq_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tender_boqs b WHERE b.id = tender_boq_id AND b.company_id = public.my_company_id()));
CREATE POLICY "tender_boq_items write" ON public.tender_boq_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tender_boqs b WHERE b.id = tender_boq_id AND b.company_id = public.my_company_id())
         AND (public.can('boq','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tender_boqs b WHERE b.id = tender_boq_id AND b.company_id = public.my_company_id())
         AND (public.can('boq','edit') OR public.is_admin()));

CREATE TRIGGER trg_touch_tender_boqs BEFORE UPDATE ON public.tender_boqs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_tender_boqs AFTER INSERT OR UPDATE OR DELETE ON public.tender_boqs FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_tender_boq_items AFTER INSERT OR UPDATE OR DELETE ON public.tender_boq_items FOR EACH ROW EXECUTE FUNCTION public.write_audit();
