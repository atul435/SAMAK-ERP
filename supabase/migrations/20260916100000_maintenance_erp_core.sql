-- Landscape Maintenance ERP core (Phase 1 of the Maintenance ERP
-- specification): contracts, site/zone/asset registry, service
-- templates, schedules, tasks with append-only execution logging,
-- inspections/findings, plant treatments, and issues wired into the
-- ERP's existing generic approval engine (approval_requests) rather
-- than a second one. Explicitly deferred to later work: inventory/
-- equipment/billing integration (spec 3.9-3.10), full irrigation
-- telemetry beyond a light zones/readings log, AI features (spec 6),
-- and client-portal visibility (spec 3.11) -- this migration is the
-- internal staff-facing operating core only.
--
-- Every "planned/master" table is company-scoped and gated by
-- can('care','edit') for writes, matching plant_species/materials/boqs.
-- maintenance_task_logs is the one deliberate exception: it is
-- append-only (insert only, no update/delete for regular users) so a
-- crew's completion record can never silently overwrite the plan or a
-- prior entry -- matching the specification's own "append-only...
-- never an unlogged overwrite" principle (section 7, section 9).

CREATE TABLE public.maintenance_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_code text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  renewal_notice_days integer,
  escalation_clause text,
  gst_percent numeric,
  billing_terms text,
  frequency text,
  seasonal_allowance text,
  plant_replacement_policy text,
  response_sla_hours numeric,
  resolution_sla_hours numeric,
  working_hours text,
  monthly_fee numeric,
  material_cap numeric,
  equipment_responsibility text,
  client_obligations text,
  access_restrictions text,
  approval_contact text,
  signed_document_url text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (company_id, contract_code)
);

CREATE TABLE public.maintenance_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  contract_id uuid REFERENCES public.maintenance_contracts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  site_code text NOT NULL,
  name text NOT NULL,
  address text,
  city text,
  state text,
  is_external_build boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (company_id, site_code)
);

CREATE TABLE public.maintenance_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  zone_code text,
  name text NOT NULL,
  zone_type text NOT NULL DEFAULT 'other',
  area_sqm numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.maintenance_zones(id) ON DELETE SET NULL,
  asset_code text,
  asset_type text NOT NULL,
  species_id uuid REFERENCES public.plant_species(id) ON DELETE SET NULL,
  specification text,
  count_or_area numeric,
  uom text,
  size_spec text,
  installed_date date,
  source text,
  warranty_until date,
  expected_service_years numeric,
  condition text DEFAULT 'good',
  is_protected boolean NOT NULL DEFAULT false,
  tree_risk_rating text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.service_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_code text NOT NULL,
  name text NOT NULL,
  work_type text,
  uom text NOT NULL DEFAULT 'visit',
  frequency text,
  season text,
  skill_required text,
  standard_hours numeric,
  materials_notes text,
  safety_instructions text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, template_code)
);

CREATE TABLE public.maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.maintenance_zones(id) ON DELETE SET NULL,
  service_template_id uuid REFERENCES public.service_templates(id) ON DELETE SET NULL,
  frequency text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  assigned_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_crew text,
  status text NOT NULL DEFAULT 'active',
  override_reason text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.maintenance_zones(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.maintenance_schedules(id) ON DELETE SET NULL,
  service_template_id uuid REFERENCES public.service_templates(id) ON DELETE SET NULL,
  task_type text NOT NULL DEFAULT 'preventive',
  title text NOT NULL,
  planned_date date NOT NULL,
  assignee_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned',
  supervisor_reviewed boolean NOT NULL DEFAULT false,
  supervisor_reviewed_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Append-only execution evidence against a planned task -- mirrors how
-- boq_item_execution logs actuals against a boq_item without ever
-- rewriting the plan. A task's current state is its latest log entry.
CREATE TABLE public.maintenance_task_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  logged_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  reported_status text NOT NULL,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  quantity_completed numeric,
  uom text,
  materials_used text,
  issue_notes text,
  incomplete_reason text,
  replan_date date,
  photo_url text,
  client_signature boolean NOT NULL DEFAULT false,
  geo_lat numeric,
  geo_lng numeric,
  gps_override_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.maintenance_zones(id) ON DELETE SET NULL,
  inspection_date date NOT NULL DEFAULT current_date,
  inspector_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  season text,
  overall_score numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.inspection_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.maintenance_inspections(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'low',
  affected_area_or_count numeric,
  probable_cause text,
  confidence text DEFAULT 'medium',
  photo_url text,
  is_verified boolean NOT NULL DEFAULT false,
  verified_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.plant_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES public.inspection_findings(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.maintenance_assets(id) ON DELETE SET NULL,
  product text,
  dose text,
  application_area text,
  operator_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  weather text,
  safety_precautions text,
  follow_up_date date,
  efficacy_notes text,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.maintenance_zones(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.maintenance_assets(id) ON DELETE SET NULL,
  issue_code text,
  source text NOT NULL DEFAULT 'staff_report',
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open',
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  target_date date,
  is_extra_work boolean NOT NULL DEFAULT false,
  estimated_cost numeric,
  approval_request_id uuid REFERENCES public.approval_requests(id) ON DELETE SET NULL,
  reopen_count integer NOT NULL DEFAULT 0,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.irrigation_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES public.maintenance_zones(id) ON DELETE SET NULL,
  controller_name text NOT NULL,
  valve_count integer,
  design_flow_lpm numeric,
  schedule_notes text,
  rainfall_override boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.irrigation_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  irrigation_zone_id uuid NOT NULL REFERENCES public.irrigation_zones(id) ON DELETE CASCADE,
  reading_date date NOT NULL DEFAULT current_date,
  meter_value numeric,
  anomaly_flag boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_maint_sites_client ON public.maintenance_sites(client_id);
CREATE INDEX idx_maint_sites_contract ON public.maintenance_sites(contract_id);
CREATE INDEX idx_maint_zones_site ON public.maintenance_zones(site_id);
CREATE INDEX idx_maint_assets_site ON public.maintenance_assets(site_id);
CREATE INDEX idx_maint_assets_zone ON public.maintenance_assets(zone_id);
CREATE INDEX idx_maint_schedules_site ON public.maintenance_schedules(site_id);
CREATE INDEX idx_maint_tasks_site ON public.maintenance_tasks(site_id);
CREATE INDEX idx_maint_tasks_schedule ON public.maintenance_tasks(schedule_id);
CREATE INDEX idx_maint_tasks_assignee ON public.maintenance_tasks(assignee_employee_id);
CREATE INDEX idx_maint_task_logs_task ON public.maintenance_task_logs(task_id);
CREATE INDEX idx_maint_inspections_site ON public.maintenance_inspections(site_id);
CREATE INDEX idx_inspection_findings_inspection ON public.inspection_findings(inspection_id);
CREATE INDEX idx_plant_treatments_site ON public.plant_treatments(site_id);
CREATE INDEX idx_maint_issues_site ON public.maintenance_issues(site_id);
CREATE INDEX idx_irrigation_zones_site ON public.irrigation_zones(site_id);
CREATE INDEX idx_irrigation_readings_zone ON public.irrigation_readings(irrigation_zone_id);

-- ============ GRANTS + RLS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'maintenance_contracts','maintenance_sites','maintenance_zones','maintenance_assets',
    'service_templates','maintenance_schedules','maintenance_tasks','maintenance_task_logs',
    'maintenance_inspections','inspection_findings','plant_treatments','maintenance_issues',
    'irrigation_zones','irrigation_readings'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Direct company_id tables: standard company-scoped read, can('care','edit')-gated write
CREATE POLICY "maint_contracts_select" ON public.maintenance_contracts FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "maint_contracts_write" ON public.maintenance_contracts FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_sites_select" ON public.maintenance_sites FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "maint_sites_write" ON public.maintenance_sites FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "service_templates_select" ON public.service_templates FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "service_templates_write" ON public.service_templates FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()));

-- Site-scoped tables (one hop via maintenance_sites.company_id)
CREATE POLICY "maint_zones_select" ON public.maintenance_zones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_zones_write" ON public.maintenance_zones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_assets_select" ON public.maintenance_assets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_assets_write" ON public.maintenance_assets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_schedules_select" ON public.maintenance_schedules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_schedules_write" ON public.maintenance_schedules FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_tasks_select" ON public.maintenance_tasks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_tasks_write" ON public.maintenance_tasks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_inspections_select" ON public.maintenance_inspections FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_inspections_write" ON public.maintenance_inspections FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "plant_treatments_select" ON public.plant_treatments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "plant_treatments_write" ON public.plant_treatments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_issues_select" ON public.maintenance_issues FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_issues_write" ON public.maintenance_issues FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "irrigation_zones_select" ON public.irrigation_zones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id()));
CREATE POLICY "irrigation_zones_write" ON public.irrigation_zones FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_sites s WHERE s.id = site_id AND s.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

-- Two-hop joins
CREATE POLICY "inspection_findings_select" ON public.inspection_findings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_inspections i JOIN public.maintenance_sites s ON s.id = i.site_id
    WHERE i.id = inspection_id AND s.company_id = public.my_company_id()));
CREATE POLICY "inspection_findings_write" ON public.inspection_findings FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_inspections i JOIN public.maintenance_sites s ON s.id = i.site_id
    WHERE i.id = inspection_id AND s.company_id = public.my_company_id())
    AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.maintenance_inspections i JOIN public.maintenance_sites s ON s.id = i.site_id
    WHERE i.id = inspection_id AND s.company_id = public.my_company_id())
    AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "irrigation_readings_select" ON public.irrigation_readings FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.irrigation_zones z JOIN public.maintenance_sites s ON s.id = z.site_id
    WHERE z.id = irrigation_zone_id AND s.company_id = public.my_company_id()));
CREATE POLICY "irrigation_readings_write" ON public.irrigation_readings FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.irrigation_zones z JOIN public.maintenance_sites s ON s.id = z.site_id
    WHERE z.id = irrigation_zone_id AND s.company_id = public.my_company_id())
    AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.irrigation_zones z JOIN public.maintenance_sites s ON s.id = z.site_id
    WHERE z.id = irrigation_zone_id AND s.company_id = public.my_company_id())
    AND (public.can('care','edit') OR public.is_admin()));

-- maintenance_task_logs: append-only. Anyone who can view/log care work
-- (view or create) may insert; only admins may correct/remove a bad
-- entry, and never by editing it into something else silently.
CREATE POLICY "maint_task_logs_select" ON public.maintenance_task_logs FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_task_logs_insert" ON public.maintenance_task_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id())
    AND (public.can('care','create') OR public.can('care','edit') OR public.is_admin()));
CREATE POLICY "maint_task_logs_admin_fix" ON public.maintenance_task_logs FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "maint_task_logs_admin_delete" ON public.maintenance_task_logs FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============ TRIGGERS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'maintenance_contracts','maintenance_sites','maintenance_zones','maintenance_assets',
    'service_templates','maintenance_schedules','maintenance_tasks',
    'maintenance_inspections','inspection_findings','plant_treatments','maintenance_issues',
    'irrigation_zones'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER trg_touch_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.write_audit();', t);
  END LOOP;
  -- Append-only / no updated_at: still audit inserts (and admin corrections)
  EXECUTE 'CREATE TRIGGER trg_audit_maintenance_task_logs AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_task_logs FOR EACH ROW EXECUTE FUNCTION public.write_audit();';
  EXECUTE 'CREATE TRIGGER trg_audit_irrigation_readings AFTER INSERT OR UPDATE OR DELETE ON public.irrigation_readings FOR EACH ROW EXECUTE FUNCTION public.write_audit();';
END $$;
