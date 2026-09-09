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

-- DEMO DATA ------------------------------------------------------------
INSERT INTO public.designs (id, company_id, project_id, client_id, design_code, title, design_type, stage, scale, brief, site_plan_notes, elevation_notes, designer_id, current_revision, status, approval_state)
SELECT
  d.id, p.company_id, p.id, p.client_id, d.code, d.title, d.dtype, d.stage, d.scale, d.brief, d.plan_notes, d.elev_notes,
  (SELECT e.id FROM public.employees e WHERE e.company_id = p.company_id AND e.primary_role IN ('designer','design_head') ORDER BY e.primary_role DESC LIMIT 1),
  d.rev, d.status::public.record_status, d.astate::public.approval_state
FROM (VALUES
  ('aaaa1111-0000-4000-8000-000000000001'::uuid,'PRJ-0001','DSG-0001','Central Green Concept Masterplan','softscape','schematic','1:200',
   'Concept masterplan for the central green spine with shaded seating pockets, native tree avenue and a rain-fed swale.',
   'Site plan sets a 3.6 m primary walkway loop, two 120 sqm lawn pockets, a 40 m native tree avenue on the east edge and a bioswale along the north boundary handling monsoon runoff.',
   'Elevations show a layered canopy: 8-10 m flowering trees at the rear, 2-3 m shrub massing mid-ground and 300-450 mm groundcover at path edge, maintaining sightlines under 1.2 m at all junctions.',
   2,'approved','approved'),
  ('aaaa1111-0000-4000-8000-000000000002'::uuid,'PRJ-0002','DSG-0002','Podium Deck Softscape & Hardscape','hardscape','detailed','1:100',
   'Podium-level landscape over structural slab with strict 450 mm soil depth limit and drainage cell build-up.',
   'Site plan divides the podium into four planters, a 220 sqm central deck in IPE-finish WPC, and a perimeter planter band 1.2 m wide with integrated drip lines.',
   'Section shows drainage cell, filter fabric, 450 mm lightweight media and edge restraint; planting limited to shallow-rooted palms and ornamental grasses.',
   3,'in_progress','pending_approval'),
  ('aaaa1111-0000-4000-8000-000000000003'::uuid,'PRJ-0003','DSG-0003','Entrance Plaza & Avenue Planting','softscape','concept','1:250',
   'Arrival experience with a signature specimen tree, water feature edge and evening lighting layers.',
   'Plan centres a 6 m specimen tree in a 5 m circular tree grate, flanked by symmetric shrub beds and a 1.8 m granite seating wall.',
   'Elevation establishes a 4.5 m clear entry height under the canopy and steps planting from 300 mm at kerb to 3 m at the boundary screen.',
   1,'draft','draft')
) AS d(id, project_code, code, title, dtype, stage, scale, brief, plan_notes, elev_notes, rev, status, astate)
JOIN public.projects p ON p.project_code = d.project_code
ON CONFLICT DO NOTHING;

INSERT INTO public.design_revisions (design_id, revision_number, change_summary, issued_by)
SELECT d.id, r.num, r.summary, d.designer_id
FROM (VALUES
  ('aaaa1111-0000-4000-8000-000000000001'::uuid, 1, 'Initial concept issued for client walkthrough.'),
  ('aaaa1111-0000-4000-8000-000000000001'::uuid, 2, 'Swale widened to 2.4 m and tree avenue extended by 12 m after drainage review.'),
  ('aaaa1111-0000-4000-8000-000000000002'::uuid, 1, 'First podium layout issued to structural consultant.'),
  ('aaaa1111-0000-4000-8000-000000000002'::uuid, 2, 'Soil depth reduced to 450 mm; heavy tree species removed from planter P3.'),
  ('aaaa1111-0000-4000-8000-000000000002'::uuid, 3, 'Deck material changed to WPC and drip irrigation zones re-split into four circuits.'),
  ('aaaa1111-0000-4000-8000-000000000003'::uuid, 1, 'Concept plaza layout issued for internal review.')
) AS r(design_id, num, summary)
JOIN public.designs d ON d.id = r.design_id
ON CONFLICT DO NOTHING;

INSERT INTO public.design_plant_items (design_id, species_id, quantity, plant_size, spacing_mm, zone, unit_rate, remarks)
SELECT r.design_id, s.id, r.qty, r.size, r.spacing, r.zone, r.rate, r.remarks
FROM (VALUES
  ('aaaa1111-0000-4000-8000-000000000001'::uuid, 1, 24, '3-3.5 m ht, 100 mm girth', 6000, 'Tree avenue', 4500, 'Staked, with tree guard'),
  ('aaaa1111-0000-4000-8000-000000000001'::uuid, 2, 180, '450-600 mm', 600, 'Shrub massing', 220, 'Massed in drifts of 12'),
  ('aaaa1111-0000-4000-8000-000000000001'::uuid, 3, 900, '150-200 mm', 250, 'Path edge groundcover', 45, 'Continuous edge band'),
  ('aaaa1111-0000-4000-8000-000000000002'::uuid, 4, 16, '2-2.5 m ht', 2400, 'Podium planters', 6200, 'Lightweight media only'),
  ('aaaa1111-0000-4000-8000-000000000002'::uuid, 5, 320, '300-450 mm', 400, 'Perimeter band', 180, 'Drip irrigated'),
  ('aaaa1111-0000-4000-8000-000000000003'::uuid, 6, 1, '6 m ht specimen', NULL, 'Plaza centre', 85000, 'Crane placement required'),
  ('aaaa1111-0000-4000-8000-000000000003'::uuid, 7, 140, '600-750 mm', 750, 'Entry beds', 260, 'Symmetric layout both sides')
) AS r(design_id, species_rank, qty, size, spacing, zone, rate, remarks)
JOIN (SELECT id, row_number() OVER (ORDER BY botanical_name) AS rn FROM public.plant_species) s ON s.rn = r.species_rank
ON CONFLICT DO NOTHING;