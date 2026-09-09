CREATE TABLE public.site_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  reported_by uuid REFERENCES public.employees(id),
  weather text NOT NULL DEFAULT 'clear',
  temperature_c numeric,
  work_done text NOT NULL DEFAULT '',
  planned_next text,
  blockers text,
  progress_percent numeric NOT NULL DEFAULT 0,
  latitude numeric,
  longitude numeric,
  location_accuracy_m numeric,
  status record_status NOT NULL DEFAULT 'draft',
  approval_state approval_state NOT NULL DEFAULT 'draft',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (project_id, report_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_reports TO authenticated;
GRANT ALL ON public.site_reports TO service_role;
ALTER TABLE public.site_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_reports_select" ON public.site_reports FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "site_reports_insert" ON public.site_reports FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "site_reports_update" ON public.site_reports FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "site_reports_delete" ON public.site_reports FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND public.is_admin());

CREATE TABLE public.site_report_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_report_id uuid NOT NULL REFERENCES public.site_reports(id) ON DELETE CASCADE,
  description text NOT NULL,
  uom text NOT NULL DEFAULT 'nos',
  quantity_planned numeric NOT NULL DEFAULT 0,
  quantity_done numeric NOT NULL DEFAULT 0,
  boq_item_id uuid REFERENCES public.boq_items(id),
  remarks text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_report_items TO authenticated;
GRANT ALL ON public.site_report_items TO service_role;
ALTER TABLE public.site_report_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_report_items_select" ON public.site_report_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.site_reports r WHERE r.id = site_report_id AND r.company_id = public.my_company_id()));
CREATE POLICY "site_report_items_write" ON public.site_report_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.site_reports r WHERE r.id = site_report_id AND r.company_id = public.my_company_id()) AND (public.can('site_ops','edit') OR public.is_admin())) WITH CHECK (EXISTS (SELECT 1 FROM public.site_reports r WHERE r.id = site_report_id AND r.company_id = public.my_company_id()) AND (public.can('site_ops','edit') OR public.is_admin()));

CREATE TABLE public.labour_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  site_report_id uuid REFERENCES public.site_reports(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT CURRENT_DATE,
  trade text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id),
  headcount_planned integer NOT NULL DEFAULT 0,
  headcount_present integer NOT NULL DEFAULT 0,
  hours_worked numeric NOT NULL DEFAULT 8,
  day_rate numeric NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_attendance TO authenticated;
GRANT ALL ON public.labour_attendance TO service_role;
ALTER TABLE public.labour_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "labour_attendance_select" ON public.labour_attendance FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "labour_attendance_write" ON public.labour_attendance FOR ALL TO authenticated USING (company_id = public.my_company_id() AND (public.can('site_ops','edit') OR public.is_admin())) WITH CHECK (company_id = public.my_company_id() AND (public.can('site_ops','edit') OR public.is_admin()));

CREATE TABLE public.site_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid NOT NULL REFERENCES public.projects(id),
  site_report_id uuid REFERENCES public.site_reports(id) ON DELETE SET NULL,
  title text NOT NULL,
  caption text,
  category text NOT NULL DEFAULT 'progress',
  storage_path text,
  file_url text,
  latitude numeric,
  longitude numeric,
  taken_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_photos TO authenticated;
GRANT ALL ON public.site_photos TO service_role;
ALTER TABLE public.site_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site_photos_select" ON public.site_photos FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "site_photos_write" ON public.site_photos FOR ALL TO authenticated USING (company_id = public.my_company_id() AND (public.can('site_ops','edit') OR public.is_admin())) WITH CHECK (company_id = public.my_company_id() AND (public.can('site_ops','edit') OR public.is_admin()));

CREATE INDEX idx_site_reports_project ON public.site_reports(project_id, report_date DESC);
CREATE INDEX idx_site_report_items_report ON public.site_report_items(site_report_id);
CREATE INDEX idx_labour_attendance_project ON public.labour_attendance(project_id, attendance_date DESC);
CREATE INDEX idx_site_photos_project ON public.site_photos(project_id, taken_at DESC);

CREATE TRIGGER trg_touch_site_reports BEFORE UPDATE ON public.site_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_site_report_items BEFORE UPDATE ON public.site_report_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_labour_attendance BEFORE UPDATE ON public.labour_attendance FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_site_photos BEFORE UPDATE ON public.site_photos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_audit_site_reports AFTER INSERT OR UPDATE OR DELETE ON public.site_reports FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_labour_attendance AFTER INSERT OR UPDATE OR DELETE ON public.labour_attendance FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_site_photos AFTER INSERT OR UPDATE OR DELETE ON public.site_photos FOR EACH ROW EXECUTE FUNCTION public.write_audit();

INSERT INTO public.role_permissions(role, module, action)
SELECT r, 'site_ops', a FROM (VALUES ('md'::app_role),('ceo'),('cto'),('project_manager'),('site_engineer'),('site_supervisor'),('horticulture_head')) AS roles(r),
  (VALUES ('view'),('edit')) AS actions(a)
ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role, module, action)
SELECT r, 'site_ops', 'approve' FROM (VALUES ('md'::app_role),('ceo'),('project_manager')) AS roles(r)
ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role, module, action)
SELECT r, 'site_ops', 'view' FROM (VALUES ('design_head'::app_role),('designer'),('procurement_manager'),('store_manager'),('finance'),('sales_director'),('bd_manager'),('hr')) AS roles(r)
ON CONFLICT DO NOTHING;