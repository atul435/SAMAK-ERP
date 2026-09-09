
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM (
  'md','ceo','cto','sales_director','bd_manager','design_head','designer',
  'project_manager','site_engineer','site_supervisor','horticulture_head',
  'procurement_manager','store_manager','finance','hr','client'
);

CREATE TYPE public.record_status AS ENUM (
  'draft','submitted','pending_approval','approved','rejected','in_progress','blocked','completed','cancelled','archived'
);

CREATE TYPE public.approval_state AS ENUM ('draft','submitted','pending_approval','approved','rejected','executed','cancelled');

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END; $$;

-- ============ ORG ============
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  gstin text,
  city text, state text, country text DEFAULT 'India',
  currency text NOT NULL DEFAULT 'INR',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  head_employee_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, code)
);

CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  user_id uuid UNIQUE,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  designation text,
  primary_role public.app_role NOT NULL DEFAULT 'site_engineer',
  reports_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  date_of_joining date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, employee_code),
  UNIQUE (company_id, email)
);
ALTER TABLE public.departments ADD CONSTRAINT departments_head_fk FOREIGN KEY (head_employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  action text NOT NULL,
  UNIQUE (role, module, action)
);

-- security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_employee_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can(_module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    JOIN public.user_roles ur ON ur.role = rp.role
    WHERE ur.user_id = auth.uid() AND rp.module = _module AND rp.action = _action
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'md') OR public.has_role(auth.uid(),'ceo') OR public.has_role(auth.uid(),'cto');
$$;

-- ============ MASTER DATA ============
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_code text NOT NULL,
  name text NOT NULL,
  sector text,
  gstin text,
  city text, state text,
  address text,
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status public.record_status NOT NULL DEFAULT 'approved',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, client_code)
);

CREATE TABLE public.client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL, designation text, email text, phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.plant_species (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  botanical_name text NOT NULL UNIQUE,
  common_name text NOT NULL,
  category text NOT NULL,
  water_need text, sunlight text, soil_type text,
  growth_rate text, mature_height_m numeric,
  maintenance_level text,
  native_region text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  uom text NOT NULL,
  standard_rate numeric NOT NULL DEFAULT 0,
  hsn_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

-- ============ CRM ============
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  lead_code text NOT NULL,
  title text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  contact_name text, contact_email text, contact_phone text,
  source text NOT NULL DEFAULT 'direct',
  city text,
  estimated_value numeric NOT NULL DEFAULT 0,
  score int NOT NULL DEFAULT 0,
  stage text NOT NULL DEFAULT 'new',
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  next_action text,
  next_action_date date,
  status public.record_status NOT NULL DEFAULT 'in_progress',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, lead_code)
);

CREATE TABLE public.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  opportunity_code text NOT NULL,
  title text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  value numeric NOT NULL DEFAULT 0,
  probability int NOT NULL DEFAULT 50,
  expected_close_date date,
  competitor text,
  stage text NOT NULL DEFAULT 'qualification',
  owner_employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status public.record_status NOT NULL DEFAULT 'in_progress',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, opportunity_code)
);

-- ============ PROJECTS ============
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_code text NOT NULL,
  name text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  project_type text NOT NULL DEFAULT 'landscape_development',
  city text, state text,
  latitude numeric, longitude numeric,
  area_sqm numeric,
  contract_value numeric NOT NULL DEFAULT 0,
  budget_cost numeric NOT NULL DEFAULT 0,
  actual_cost numeric NOT NULL DEFAULT 0,
  committed_cost numeric NOT NULL DEFAULT 0,
  billed_amount numeric NOT NULL DEFAULT 0,
  collected_amount numeric NOT NULL DEFAULT 0,
  progress_percent numeric NOT NULL DEFAULT 0,
  health text NOT NULL DEFAULT 'green',
  start_date date, end_date date,
  project_manager_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  status public.record_status NOT NULL DEFAULT 'in_progress',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, project_code)
);

CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role_on_project text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, employee_id)
);

-- ============ APPROVAL ENGINE ============
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  request_code text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  entity_label text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  amount numeric,
  summary text,
  state public.approval_state NOT NULL DEFAULT 'draft',
  requested_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  approver_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  ai_assisted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (company_id, request_code)
);

CREATE TABLE public.approval_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  from_state public.approval_state,
  to_state public.approval_state NOT NULL,
  actor_user_id uuid,
  actor_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ AUDIT / NOTIFICATIONS / DOCS / ACTIVITY ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  actor_user_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  category text NOT NULL DEFAULT 'general',
  severity text NOT NULL DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  doc_type text NOT NULL DEFAULT 'general',
  entity_type text, entity_id uuid,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  version int NOT NULL DEFAULT 1,
  file_url text, file_name text, mime_type text, size_bytes bigint,
  status public.record_status NOT NULL DEFAULT 'draft',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  activity_type text NOT NULL DEFAULT 'note',
  subject text NOT NULL,
  body text,
  due_date date,
  is_done boolean NOT NULL DEFAULT false,
  employee_id uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE TABLE public.ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  question text NOT NULL,
  answer text,
  context jsonb,
  confidence numeric,
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ AUDIT TRIGGER ============
CREATE OR REPLACE FUNCTION public.write_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cid uuid;
BEGIN
  BEGIN
    cid := COALESCE(to_jsonb(COALESCE(NEW, OLD))->>'company_id', NULL)::uuid;
  EXCEPTION WHEN others THEN cid := NULL; END;
  INSERT INTO public.audit_logs(company_id, table_name, record_id, action, actor_user_id, before_data, after_data)
  VALUES (cid, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, auth.uid(),
          CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD) END,
          CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END; $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','departments','employees','clients','client_contacts','leads','opportunities','projects','approval_requests','documents','materials','plant_species','activities']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_touch_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.write_audit();', t);
  END LOOP;
END $$;

-- ============ NEW USER ONBOARDING ============
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp public.employees%ROWTYPE; default_company uuid;
BEGIN
  SELECT * INTO emp FROM public.employees WHERE lower(email) = lower(NEW.email) AND user_id IS NULL LIMIT 1;
  IF emp.id IS NOT NULL THEN
    UPDATE public.employees SET user_id = NEW.id WHERE id = emp.id;
    INSERT INTO public.user_roles(user_id, role, company_id) VALUES (NEW.id, emp.primary_role, emp.company_id)
      ON CONFLICT DO NOTHING;
  ELSE
    SELECT id INTO default_company FROM public.companies ORDER BY created_at LIMIT 1;
    IF default_company IS NOT NULL THEN
      INSERT INTO public.employees(company_id, user_id, employee_code, full_name, email, primary_role, designation)
      VALUES (default_company, NEW.id, 'EMP-' || substr(replace(NEW.id::text,'-',''),1,8),
              COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)), NEW.email, 'md', 'Management');
      INSERT INTO public.user_roles(user_id, role, company_id) VALUES (NEW.id, 'md', default_company) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ GRANTS + RLS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['companies','departments','employees','user_roles','role_permissions','clients','client_contacts','plant_species','materials','leads','opportunities','projects','project_members','approval_requests','approval_actions','audit_logs','notifications','documents','activities','ai_interactions']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

-- read-for-signed-in helpers
CREATE POLICY "read own company" ON public.companies FOR SELECT TO authenticated USING (id = public.my_company_id());
CREATE POLICY "admin manage companies" ON public.companies FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "read roles self" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "read permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage permissions" ON public.role_permissions FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- company-scoped tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['departments','employees','clients','leads','opportunities','projects','approval_requests','documents','activities','notifications']
  LOOP
    EXECUTE format('CREATE POLICY "company read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (company_id = public.my_company_id());', t);
    EXECUTE format('CREATE POLICY "company insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id());', t);
    EXECUTE format('CREATE POLICY "company update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (company_id = public.my_company_id()) WITH CHECK (company_id = public.my_company_id());', t);
    EXECUTE format('CREATE POLICY "admin delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_admin() AND company_id = public.my_company_id());', t);
  END LOOP;
END $$;

CREATE POLICY "read contacts" ON public.client_contacts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.company_id = public.my_company_id()));
CREATE POLICY "write contacts" ON public.client_contacts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.company_id = public.my_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.company_id = public.my_company_id()));

CREATE POLICY "read project members" ON public.project_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = public.my_company_id()));
CREATE POLICY "write project members" ON public.project_members FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = public.my_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.company_id = public.my_company_id()));

CREATE POLICY "read approval actions" ON public.approval_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.approval_requests a WHERE a.id = approval_request_id AND a.company_id = public.my_company_id()));
CREATE POLICY "insert approval actions" ON public.approval_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.approval_requests a WHERE a.id = approval_request_id AND a.company_id = public.my_company_id()));

CREATE POLICY "read audit" ON public.audit_logs FOR SELECT TO authenticated USING (company_id = public.my_company_id() OR public.is_admin());

CREATE POLICY "read masters plants" ON public.plant_species FOR SELECT TO authenticated USING (true);
CREATE POLICY "write masters plants" ON public.plant_species FOR ALL TO authenticated USING (public.can('plantiq','edit') OR public.is_admin()) WITH CHECK (public.can('plantiq','edit') OR public.is_admin());
CREATE POLICY "read masters materials" ON public.materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "write masters materials" ON public.materials FOR ALL TO authenticated USING (public.can('inventory','edit') OR public.is_admin()) WITH CHECK (public.can('inventory','edit') OR public.is_admin());

CREATE POLICY "read own ai" ON public.ai_interactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "insert own ai" ON public.ai_interactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_projects_company ON public.projects(company_id);
CREATE INDEX idx_leads_company_stage ON public.leads(company_id, stage);
CREATE INDEX idx_audit_record ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_activities_entity ON public.activities(entity_type, entity_id);
CREATE INDEX idx_approvals_state ON public.approval_requests(company_id, state);
