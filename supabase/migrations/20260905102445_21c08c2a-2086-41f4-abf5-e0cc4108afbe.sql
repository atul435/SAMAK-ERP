-- ============ BOQ tables ============
CREATE TABLE public.boqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  boq_code text NOT NULL,
  title text NOT NULL,
  project_id uuid REFERENCES public.projects(id),
  design_id uuid REFERENCES public.designs(id),
  client_id uuid REFERENCES public.clients(id),
  version integer NOT NULL DEFAULT 1,
  notes text,
  overhead_percent numeric NOT NULL DEFAULT 8,
  profit_percent numeric NOT NULL DEFAULT 12,
  contingency_percent numeric NOT NULL DEFAULT 3,
  tax_percent numeric NOT NULL DEFAULT 18,
  prepared_by uuid REFERENCES public.employees(id),
  status record_status NOT NULL DEFAULT 'draft',
  approval_state approval_state NOT NULL DEFAULT 'draft',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (company_id, boq_code)
);

CREATE TABLE public.boq_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id uuid NOT NULL REFERENCES public.boqs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.boq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  boq_id uuid NOT NULL REFERENCES public.boqs(id) ON DELETE CASCADE,
  section_id uuid REFERENCES public.boq_sections(id) ON DELETE SET NULL,
  item_kind text NOT NULL DEFAULT 'material',
  description text NOT NULL,
  species_id uuid REFERENCES public.plant_species(id),
  material_id uuid REFERENCES public.materials(id),
  uom text NOT NULL DEFAULT 'nos',
  quantity numeric NOT NULL DEFAULT 0,
  wastage_percent numeric NOT NULL DEFAULT 0,
  unit_rate numeric NOT NULL DEFAULT 0,
  remarks text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE INDEX idx_boqs_project ON public.boqs(project_id);
CREATE INDEX idx_boqs_design ON public.boqs(design_id);
CREATE INDEX idx_boq_sections_boq ON public.boq_sections(boq_id);
CREATE INDEX idx_boq_items_boq ON public.boq_items(boq_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boqs TO authenticated;
GRANT ALL ON public.boqs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boq_sections TO authenticated;
GRANT ALL ON public.boq_sections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boq_items TO authenticated;
GRANT ALL ON public.boq_items TO service_role;

ALTER TABLE public.boqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boqs select company" ON public.boqs FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "boqs insert" ON public.boqs FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin()));
CREATE POLICY "boqs update" ON public.boqs FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id());
CREATE POLICY "boqs delete" ON public.boqs FOR DELETE TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin()));

CREATE POLICY "boq_sections select" ON public.boq_sections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.boqs b WHERE b.id = boq_id AND b.company_id = public.my_company_id()));
CREATE POLICY "boq_sections write" ON public.boq_sections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.boqs b WHERE b.id = boq_id AND b.company_id = public.my_company_id())
         AND (public.can('boq','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.boqs b WHERE b.id = boq_id AND b.company_id = public.my_company_id())
         AND (public.can('boq','edit') OR public.is_admin()));

CREATE POLICY "boq_items select" ON public.boq_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.boqs b WHERE b.id = boq_id AND b.company_id = public.my_company_id()));
CREATE POLICY "boq_items write" ON public.boq_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.boqs b WHERE b.id = boq_id AND b.company_id = public.my_company_id())
         AND (public.can('boq','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.boqs b WHERE b.id = boq_id AND b.company_id = public.my_company_id())
         AND (public.can('boq','edit') OR public.is_admin()));

CREATE TRIGGER trg_touch_boqs BEFORE UPDATE ON public.boqs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_boq_sections BEFORE UPDATE ON public.boq_sections FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_boq_items BEFORE UPDATE ON public.boq_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_boqs AFTER INSERT OR UPDATE OR DELETE ON public.boqs FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- ============ permissions ============
INSERT INTO public.role_permissions(role, module, action) VALUES
  ('md','boq','view'),('md','boq','edit'),('md','boq','approve'),
  ('ceo','boq','view'),('ceo','boq','edit'),('ceo','boq','approve'),
  ('cto','boq','view'),('cto','boq','edit'),
  ('design_head','boq','view'),('design_head','boq','edit'),('design_head','boq','approve'),
  ('designer','boq','view'),('designer','boq','edit'),
  ('project_manager','boq','view'),('project_manager','boq','edit'),
  ('procurement_manager','boq','view'),('procurement_manager','boq','edit'),
  ('finance','boq','view'),
  ('sales_director','boq','view'),
  ('bd_manager','boq','view'),
  ('horticulture_head','boq','view')
ON CONFLICT DO NOTHING;

-- Fictional demo BOQs/sections/items removed — created through the app instead.