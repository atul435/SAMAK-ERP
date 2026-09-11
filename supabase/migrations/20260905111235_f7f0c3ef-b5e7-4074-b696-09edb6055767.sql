-- Fictional demo BOQ plant lines removed (referenced a boq_id from the
-- original live database that a fresh replay never reproduces).

-- 2. Nursery batches
CREATE TABLE public.nursery_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  batch_code text NOT NULL,
  species_id uuid NOT NULL REFERENCES public.plant_species(id),
  store_id uuid REFERENCES public.stores(id),
  vendor_id uuid REFERENCES public.vendors(id),
  project_id uuid REFERENCES public.projects(id),
  boq_item_id uuid REFERENCES public.boq_items(id),
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id),
  plant_size text,
  pot_size text,
  uom text NOT NULL DEFAULT 'nos',
  quantity_received numeric NOT NULL DEFAULT 0,
  quantity_mortality numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  ready_date date,
  health_grade text NOT NULL DEFAULT 'good',
  location text,
  remarks text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (company_id, batch_code)
);

CREATE TABLE public.plantings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  batch_id uuid NOT NULL REFERENCES public.nursery_batches(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  boq_item_id uuid REFERENCES public.boq_items(id),
  site_report_id uuid REFERENCES public.site_reports(id),
  species_id uuid NOT NULL REFERENCES public.plant_species(id),
  quantity numeric NOT NULL DEFAULT 0,
  planted_on date NOT NULL DEFAULT CURRENT_DATE,
  zone text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.plant_care_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id uuid NOT NULL REFERENCES public.plant_species(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  frequency_days integer NOT NULL DEFAULT 7,
  season text NOT NULL DEFAULT 'all_year',
  instruction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.plant_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid REFERENCES public.projects(id),
  batch_id uuid REFERENCES public.nursery_batches(id) ON DELETE CASCADE,
  species_id uuid NOT NULL REFERENCES public.plant_species(id),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  inspected_by uuid REFERENCES public.employees(id),
  sample_size numeric NOT NULL DEFAULT 0,
  healthy_count numeric NOT NULL DEFAULT 0,
  issue text,
  severity text NOT NULL DEFAULT 'low',
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nursery_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_care_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_health_checks TO authenticated;
GRANT ALL ON public.nursery_batches TO service_role;
GRANT ALL ON public.plantings TO service_role;
GRANT ALL ON public.plant_care_schedules TO service_role;
GRANT ALL ON public.plant_health_checks TO service_role;

ALTER TABLE public.nursery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_care_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nursery_batches_select" ON public.nursery_batches FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "nursery_batches_write" ON public.nursery_batches FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('plantiq','edit') OR public.is_admin()));
CREATE POLICY "nursery_batches_update" ON public.nursery_batches FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('plantiq','edit') OR public.is_admin()));
CREATE POLICY "nursery_batches_delete" ON public.nursery_batches FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "plantings_select" ON public.plantings FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "plantings_write" ON public.plantings FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "plantings_update" ON public.plantings FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "plantings_delete" ON public.plantings FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "care_schedules_select" ON public.plant_care_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "care_schedules_write" ON public.plant_care_schedules FOR ALL TO authenticated USING (public.can('plantiq','edit') OR public.is_admin()) WITH CHECK (public.can('plantiq','edit') OR public.is_admin());

CREATE POLICY "health_checks_select" ON public.plant_health_checks FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "health_checks_write" ON public.plant_health_checks FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('plantiq','edit') OR public.can('nursery','edit') OR public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "health_checks_update" ON public.plant_health_checks FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('plantiq','edit') OR public.can('nursery','edit') OR public.is_admin()));
CREATE POLICY "health_checks_delete" ON public.plant_health_checks FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX idx_nursery_batches_species ON public.nursery_batches(species_id);
CREATE INDEX idx_nursery_batches_project ON public.nursery_batches(project_id);
CREATE INDEX idx_plantings_project ON public.plantings(project_id);
CREATE INDEX idx_plantings_batch ON public.plantings(batch_id);
CREATE INDEX idx_plantings_boq_item ON public.plantings(boq_item_id);
CREATE INDEX idx_health_checks_project ON public.plant_health_checks(project_id);

CREATE TRIGGER trg_touch_nursery_batches BEFORE UPDATE ON public.nursery_batches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_plantings BEFORE UPDATE ON public.plantings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_care_schedules BEFORE UPDATE ON public.plant_care_schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_health_checks BEFORE UPDATE ON public.plant_health_checks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_nursery_batches AFTER INSERT OR UPDATE OR DELETE ON public.nursery_batches FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_plantings AFTER INSERT OR UPDATE OR DELETE ON public.plantings FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_health_checks AFTER INSERT OR UPDATE OR DELETE ON public.plant_health_checks FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- Fictional demo nursery batches / plantings / care schedules / health
-- checks removed — created through the app once real projects and stock
-- exist.