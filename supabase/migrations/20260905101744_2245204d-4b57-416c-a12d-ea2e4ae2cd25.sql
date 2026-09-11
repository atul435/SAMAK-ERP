-- DESIGNS -------------------------------------------------------------
CREATE TABLE public.designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid REFERENCES public.projects(id),
  client_id uuid REFERENCES public.clients(id),
  design_code text NOT NULL,
  title text NOT NULL,
  design_type text NOT NULL DEFAULT 'softscape',
  stage text NOT NULL DEFAULT 'concept',
  scale text,
  brief text,
  site_plan_notes text,
  elevation_notes text,
  site_plan_url text,
  elevation_url text,
  designer_id uuid REFERENCES public.employees(id),
  current_revision integer NOT NULL DEFAULT 1,
  status public.record_status NOT NULL DEFAULT 'draft',
  approval_state public.approval_state NOT NULL DEFAULT 'draft',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT designs_code_unique UNIQUE (company_id, design_code)
);

GRANT SELECT, INSERT, UPDATE ON public.designs TO authenticated;
GRANT ALL ON public.designs TO service_role;
ALTER TABLE public.designs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "designs read own company" ON public.designs
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "designs insert" ON public.designs
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.my_company_id() AND (public.can('design','edit') OR public.is_admin()));
CREATE POLICY "designs update" ON public.designs
  FOR UPDATE TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('design','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id());

CREATE TRIGGER trg_touch_designs BEFORE UPDATE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_designs AFTER INSERT OR UPDATE OR DELETE ON public.designs
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();

CREATE INDEX idx_designs_project ON public.designs(project_id);
CREATE INDEX idx_designs_company ON public.designs(company_id);

-- DESIGN REVISIONS -----------------------------------------------------
CREATE TABLE public.design_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id),
  revision_number integer NOT NULL,
  change_summary text NOT NULL,
  drawing_url text,
  issued_by uuid REFERENCES public.employees(id),
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  CONSTRAINT design_revision_unique UNIQUE (design_id, revision_number)
);

GRANT SELECT, INSERT ON public.design_revisions TO authenticated;
GRANT ALL ON public.design_revisions TO service_role;
ALTER TABLE public.design_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design revisions read" ON public.design_revisions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.designs d WHERE d.id = design_id AND d.company_id = public.my_company_id()));
CREATE POLICY "design revisions insert" ON public.design_revisions
  FOR INSERT TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM public.designs d WHERE d.id = design_id AND d.company_id = public.my_company_id())
    AND (public.can('design','edit') OR public.is_admin()));

CREATE INDEX idx_design_revisions_design ON public.design_revisions(design_id);

-- DESIGN PLANT ITEMS ---------------------------------------------------
CREATE TABLE public.design_plant_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_id uuid NOT NULL REFERENCES public.designs(id),
  species_id uuid NOT NULL REFERENCES public.plant_species(id),
  quantity numeric NOT NULL DEFAULT 1 CHECK (quantity > 0),
  plant_size text,
  spacing_mm integer,
  zone text,
  unit_rate numeric NOT NULL DEFAULT 0 CHECK (unit_rate >= 0),
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT design_species_unique UNIQUE (design_id, species_id, zone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.design_plant_items TO authenticated;
GRANT ALL ON public.design_plant_items TO service_role;
ALTER TABLE public.design_plant_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design plants read" ON public.design_plant_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.designs d WHERE d.id = design_id AND d.company_id = public.my_company_id()));
CREATE POLICY "design plants write" ON public.design_plant_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designs d WHERE d.id = design_id AND d.company_id = public.my_company_id())
         AND (public.can('design','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.designs d WHERE d.id = design_id AND d.company_id = public.my_company_id())
         AND (public.can('design','edit') OR public.is_admin()));

CREATE TRIGGER trg_touch_design_plant_items BEFORE UPDATE ON public.design_plant_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_design_plants_design ON public.design_plant_items(design_id);

-- PERMISSIONS ----------------------------------------------------------
INSERT INTO public.role_permissions(role, module, action) VALUES
  ('md','design','view'), ('md','design','edit'), ('md','design','approve'),
  ('ceo','design','view'), ('ceo','design','edit'), ('ceo','design','approve'),
  ('cto','design','view'), ('cto','design','edit'),
  ('design_head','design','view'), ('design_head','design','edit'), ('design_head','design','approve'),
  ('designer','design','view'), ('designer','design','edit'),
  ('project_manager','design','view'),
  ('site_engineer','design','view'),
  ('horticulture_head','design','view'),
  ('sales_director','design','view'),
  ('bd_manager','design','view')
ON CONFLICT DO NOTHING;

-- Fictional demo designs/revisions/plant items removed — created through the app instead.