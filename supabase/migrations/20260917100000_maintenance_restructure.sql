-- Restructures the maintenance vertical around the client -> site -> contract
-- -> visit -> crew hierarchy: adds crews (with members, assigned equipment,
-- assigned sites), an equipment master, and visit-level material/equipment
-- usage logs -- all genuinely new, none duplicating an existing ERP module
-- (no attendance/equipment table exists elsewhere; materials/clients are
-- reused by reference, not copied). Area managers are modelled as employees
-- (via a role + a FK), not a separate person table, matching how the rest
-- of the ERP treats personas.
--
-- Also widens several existing tables so the concrete hierarchy the user
-- described is actually wired: which site an area manager owns, which crew
-- a schedule/task is executed by, which contract a service plan and an
-- inspection roll up to, and which task a service request is raised against.

CREATE TABLE public.maintenance_crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  crew_code text NOT NULL,
  name text NOT NULL,
  area_manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  supervisor_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  default_region text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, crew_code)
);

CREATE TABLE public.maintenance_crew_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.maintenance_crews(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_on_crew text,
  joined_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, employee_id)
);

CREATE TABLE public.maintenance_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  equipment_code text NOT NULL,
  equipment_type text NOT NULL,
  make text,
  model text,
  serial_number text,
  purchase_date date,
  maintenance_interval_hours numeric,
  total_hours_used numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, equipment_code)
);

CREATE TABLE public.maintenance_crew_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.maintenance_crews(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.maintenance_equipment(id) ON DELETE CASCADE,
  assigned_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, equipment_id)
);

CREATE TABLE public.maintenance_crew_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.maintenance_crews(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.maintenance_sites(id) ON DELETE CASCADE,
  assigned_at date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (crew_id, site_id)
);

-- Visit-level consumption logs -- reference the ERP's existing materials
-- catalog rather than a maintenance-specific duplicate. Deliberately not
-- wired into stock_movements yet (that ledger is project_id/store_id
-- shaped, not site_id shaped) -- deferred, noted for a later pass.
CREATE TABLE public.maintenance_material_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity_used numeric NOT NULL,
  unit_cost numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_equipment_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.maintenance_tasks(id) ON DELETE CASCADE,
  equipment_id uuid REFERENCES public.maintenance_equipment(id) ON DELETE SET NULL,
  hours_used numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Widen existing tables to carry the hierarchy through
ALTER TABLE public.maintenance_sites
  ADD COLUMN area_manager_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN geo_lat numeric,
  ADD COLUMN geo_lng numeric,
  ADD COLUMN site_type text,
  ADD COLUMN area_value numeric,
  ADD COLUMN area_uom text;

ALTER TABLE public.maintenance_schedules
  ADD COLUMN contract_id uuid REFERENCES public.maintenance_contracts(id) ON DELETE SET NULL,
  ADD COLUMN crew_id uuid REFERENCES public.maintenance_crews(id) ON DELETE SET NULL,
  ADD COLUMN required_crew_size integer,
  ADD COLUMN expected_duration_minutes integer,
  ADD COLUMN required_skills text;

ALTER TABLE public.maintenance_tasks
  ADD COLUMN crew_id uuid REFERENCES public.maintenance_crews(id) ON DELETE SET NULL,
  ADD COLUMN actual_start_time timestamptz,
  ADD COLUMN actual_end_time timestamptz,
  ADD COLUMN weather_impact text;

ALTER TABLE public.maintenance_issues
  ADD COLUMN request_type text NOT NULL DEFAULT 'complaint',
  ADD COLUMN linked_task_id uuid REFERENCES public.maintenance_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.maintenance_inspections
  ADD COLUMN contract_id uuid REFERENCES public.maintenance_contracts(id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  ADD COLUMN maintenance_contract_id uuid REFERENCES public.maintenance_contracts(id) ON DELETE SET NULL;

CREATE INDEX idx_maint_crews_company ON public.maintenance_crews(company_id);
CREATE INDEX idx_maint_crews_area_manager ON public.maintenance_crews(area_manager_employee_id);
CREATE INDEX idx_maint_crew_members_crew ON public.maintenance_crew_members(crew_id);
CREATE INDEX idx_maint_crew_members_employee ON public.maintenance_crew_members(employee_id);
CREATE INDEX idx_maint_equipment_company ON public.maintenance_equipment(company_id);
CREATE INDEX idx_maint_crew_equipment_crew ON public.maintenance_crew_equipment(crew_id);
CREATE INDEX idx_maint_crew_sites_crew ON public.maintenance_crew_sites(crew_id);
CREATE INDEX idx_maint_crew_sites_site ON public.maintenance_crew_sites(site_id);
CREATE INDEX idx_maint_material_usage_task ON public.maintenance_material_usage(task_id);
CREATE INDEX idx_maint_equipment_usage_task ON public.maintenance_equipment_usage(task_id);
CREATE INDEX idx_maint_sites_area_manager ON public.maintenance_sites(area_manager_employee_id);
CREATE INDEX idx_maint_schedules_contract ON public.maintenance_schedules(contract_id);
CREATE INDEX idx_maint_schedules_crew ON public.maintenance_schedules(crew_id);
CREATE INDEX idx_maint_tasks_crew ON public.maintenance_tasks(crew_id);
CREATE INDEX idx_maint_issues_linked_task ON public.maintenance_issues(linked_task_id);

-- ============ GRANTS + RLS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'maintenance_crews','maintenance_crew_members','maintenance_equipment',
    'maintenance_crew_equipment','maintenance_crew_sites',
    'maintenance_material_usage','maintenance_equipment_usage'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- Direct company_id tables
CREATE POLICY "maint_crews_select" ON public.maintenance_crews FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "maint_crews_write" ON public.maintenance_crews FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_equipment_select" ON public.maintenance_equipment FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "maint_equipment_write" ON public.maintenance_equipment FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('care','edit') OR public.is_admin()));

-- One-hop via crew_id -> maintenance_crews.company_id
CREATE POLICY "maint_crew_members_select" ON public.maintenance_crew_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id()));
CREATE POLICY "maint_crew_members_write" ON public.maintenance_crew_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_crew_equipment_select" ON public.maintenance_crew_equipment FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id()));
CREATE POLICY "maint_crew_equipment_write" ON public.maintenance_crew_equipment FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_crew_sites_select" ON public.maintenance_crew_sites FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id()));
CREATE POLICY "maint_crew_sites_write" ON public.maintenance_crew_sites FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.maintenance_crews c WHERE c.id = crew_id AND c.company_id = public.my_company_id())
         AND (public.can('care','edit') OR public.is_admin()));

-- Two-hop via task_id -> maintenance_tasks -> maintenance_sites.company_id
CREATE POLICY "maint_material_usage_select" ON public.maintenance_material_usage FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_material_usage_write" ON public.maintenance_material_usage FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id())
    AND (public.can('care','create') OR public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id())
    AND (public.can('care','create') OR public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_equipment_usage_select" ON public.maintenance_equipment_usage FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id()));
CREATE POLICY "maint_equipment_usage_write" ON public.maintenance_equipment_usage FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id())
    AND (public.can('care','create') OR public.can('care','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.maintenance_tasks t JOIN public.maintenance_sites s ON s.id = t.site_id
    WHERE t.id = task_id AND s.company_id = public.my_company_id())
    AND (public.can('care','create') OR public.can('care','edit') OR public.is_admin()));

-- ============ TRIGGERS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['maintenance_crews','maintenance_equipment']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_touch_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'maintenance_crews','maintenance_crew_members','maintenance_equipment',
    'maintenance_crew_equipment','maintenance_crew_sites',
    'maintenance_material_usage','maintenance_equipment_usage'
  ]
  LOOP
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.write_audit();', t);
  END LOOP;
END $$;
