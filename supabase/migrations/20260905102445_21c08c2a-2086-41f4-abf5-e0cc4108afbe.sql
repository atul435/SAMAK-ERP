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

-- ============ demo data ============
DO $$
DECLARE
  cid uuid := '11111111-1111-1111-1111-111111111111';
  d1 uuid; d2 uuid; d3 uuid;
  b1 uuid; b2 uuid; b3 uuid;
  s uuid;
  emp uuid;
BEGIN
  SELECT id INTO d1 FROM public.designs WHERE design_code='DSG-0001' AND company_id=cid;
  SELECT id INTO d2 FROM public.designs WHERE design_code='DSG-0002' AND company_id=cid;
  SELECT id INTO d3 FROM public.designs WHERE design_code='DSG-0003' AND company_id=cid;
  SELECT id INTO emp FROM public.employees WHERE company_id=cid AND primary_role='designer' LIMIT 1;

  INSERT INTO public.boqs(company_id, boq_code, title, project_id, design_id, client_id, version, notes, prepared_by, status, approval_state)
  SELECT cid, 'BOQ-0001', 'Landscape Package — ' || d.title, d.project_id, d.id, d.client_id, 2,
         'Priced against approved design revision. Plant rates as per monsoon 2026 nursery quotes.', emp, 'approved', 'approved'
  FROM public.designs d WHERE d.id = d1 RETURNING id INTO b1;

  INSERT INTO public.boqs(company_id, boq_code, title, project_id, design_id, client_id, version, notes, prepared_by, status, approval_state)
  SELECT cid, 'BOQ-0002', 'Softscape & Irrigation — ' || d.title, d.project_id, d.id, d.client_id, 1,
         'Preliminary estimate pending design sign-off.', emp, 'pending_approval', 'pending_approval'
  FROM public.designs d WHERE d.id = d2 RETURNING id INTO b2;

  INSERT INTO public.boqs(company_id, boq_code, title, project_id, design_id, client_id, version, notes, prepared_by, status, approval_state)
  SELECT cid, 'BOQ-0003', 'Concept Cost Plan — ' || d.title, d.project_id, d.id, d.client_id, 1,
         'Order-of-magnitude cost plan for client discussion.', emp, 'draft', 'draft'
  FROM public.designs d WHERE d.id = d3 RETURNING id INTO b3;

  -- BOQ 1 sections + items
  INSERT INTO public.boq_sections(boq_id, name, sort_order) VALUES (b1,'Site Preparation & Earthwork',1) RETURNING id INTO s;
  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, sort_order) VALUES
    (b1,s,'labour','Site clearance, debris removal and levelling','sqm',2400,0,45,1),
    (b1,s,'material','Imported red soil, screened','cum',180,5,1150,2),
    (b1,s,'material','Organic compost and soil conditioner mix','cum',60,3,2400,3),
    (b1,s,'equipment','JCB backhoe with operator','day',6,0,4800,4);

  INSERT INTO public.boq_sections(boq_id, name, sort_order) VALUES (b1,'Softscape — Planting',2) RETURNING id INTO s;
  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, species_id, uom, quantity, wastage_percent, unit_rate, sort_order)
  SELECT b1, s, 'plant', ps.common_name || ' (' || ps.botanical_name || ')', ps.id, 'nos', q.qty, 5, q.rate, q.ord
  FROM (VALUES ('Rain Tree',18,3200,1),('Bougainvillea',140,180,2),('Bamboo Palm',60,850,3)) AS q(cname, qty, rate, ord)
  JOIN public.plant_species ps ON ps.common_name = q.cname;

  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, sort_order)
  SELECT b1, id, 'material', 'Mexican grass turf, close-laid', 'sqm', 1200, 8, 95, 10 FROM public.boq_sections WHERE boq_id=b1 AND name='Softscape — Planting';

  INSERT INTO public.boq_sections(boq_id, name, sort_order) VALUES (b1,'Hardscape',3) RETURNING id INTO s;
  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, sort_order) VALUES
    (b1,s,'material','Kota stone paving, 25mm, machine cut','sqm',320,4,1450,1),
    (b1,s,'material','Cobble stone edging','rmt',260,3,420,2),
    (b1,s,'labour','Masonry and paving labour','sqm',320,0,310,3);

  INSERT INTO public.boq_sections(boq_id, name, sort_order) VALUES (b1,'Irrigation',4) RETURNING id INTO s;
  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, sort_order) VALUES
    (b1,s,'material','HDPE mainline 63mm PN6','rmt',420,5,180,1),
    (b1,s,'material','Pop-up rotary sprinkler heads','nos',48,2,1250,2),
    (b1,s,'material','Drip lateral 16mm with inline emitters','rmt',900,6,32,3),
    (b1,s,'equipment','Irrigation controller, 8 station, Wi-Fi','nos',1,0,28500,4),
    (b1,s,'labour','Irrigation installation and commissioning','job',1,0,86000,5);

  -- BOQ 2
  INSERT INTO public.boq_sections(boq_id, name, sort_order) VALUES (b2,'Softscape',1) RETURNING id INTO s;
  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, sort_order) VALUES
    (b2,s,'material','Lawn grass, Bermuda, roll turf','sqm',850,8,110,1),
    (b2,s,'material','Shrub mix, assorted 8" pots','nos',420,5,145,2),
    (b2,s,'labour','Planting labour and initial maintenance (30 days)','job',1,0,145000,3);

  INSERT INTO public.boq_sections(boq_id, name, sort_order) VALUES (b2,'Irrigation',2) RETURNING id INTO s;
  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, sort_order) VALUES
    (b2,s,'material','Drip lateral 16mm','rmt',640,6,32,1),
    (b2,s,'material','Solenoid valves 1"','nos',10,0,2400,2),
    (b2,s,'labour','Trenching and pipe laying','rmt',640,0,65,3);

  -- BOQ 3
  INSERT INTO public.boq_sections(boq_id, name, sort_order) VALUES (b3,'Concept Allowances',1) RETURNING id INTO s;
  INSERT INTO public.boq_items(boq_id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, sort_order) VALUES
    (b3,s,'other','Softscape allowance (provisional)','sqm',1800,0,420,1),
    (b3,s,'other','Hardscape allowance (provisional)','sqm',600,0,1650,2),
    (b3,s,'other','Water feature allowance','job',1,0,650000,3),
    (b3,s,'other','Landscape lighting allowance','job',1,0,385000,4);
END $$;