-- Attendance and timesheets for maintenance crews. Genuinely new -- no
-- attendance or timesheet table exists anywhere else in the ERP (the
-- closest, leave_requests, only tracks leave, not daily presence or hours
-- against a visit). This is also the prerequisite for real job costing
-- later: labour cost needs hours worked, which needs this.
--
-- RLS mirrors leave_requests/expenses: company-scoped read, and a write
-- is allowed either by the record's own employee (self-service logging,
-- the normal case for a crew member marking their own day) or by anyone
-- with care.edit / admin (a supervisor correcting someone else's entry).

CREATE TABLE public.maintenance_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  attendance_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'present',
  check_in_time timestamptz,
  check_out_time timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid,
  UNIQUE (employee_id, attendance_date)
);

CREATE TABLE public.maintenance_timesheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.maintenance_tasks(id) ON DELETE SET NULL,
  work_date date NOT NULL DEFAULT current_date,
  hours_worked numeric NOT NULL,
  overtime_hours numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid, updated_by uuid
);

CREATE INDEX idx_maint_attendance_company ON public.maintenance_attendance(company_id);
CREATE INDEX idx_maint_attendance_employee ON public.maintenance_attendance(employee_id);
CREATE INDEX idx_maint_attendance_date ON public.maintenance_attendance(attendance_date);
CREATE INDEX idx_maint_timesheets_company ON public.maintenance_timesheets(company_id);
CREATE INDEX idx_maint_timesheets_employee ON public.maintenance_timesheets(employee_id);
CREATE INDEX idx_maint_timesheets_task ON public.maintenance_timesheets(task_id);
CREATE INDEX idx_maint_timesheets_date ON public.maintenance_timesheets(work_date);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['maintenance_attendance', 'maintenance_timesheets']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
  END LOOP;
END $$;

CREATE POLICY "maint_attendance_select" ON public.maintenance_attendance FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "maint_attendance_write" ON public.maintenance_attendance FOR ALL TO authenticated
  USING (company_id = public.my_company_id()
    AND (employee_id = public.my_employee_id() OR public.can('care','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id()
    AND (employee_id = public.my_employee_id() OR public.can('care','edit') OR public.is_admin()));

CREATE POLICY "maint_timesheets_select" ON public.maintenance_timesheets FOR SELECT TO authenticated
  USING (company_id = public.my_company_id());
CREATE POLICY "maint_timesheets_write" ON public.maintenance_timesheets FOR ALL TO authenticated
  USING (company_id = public.my_company_id()
    AND (employee_id = public.my_employee_id() OR public.can('care','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id()
    AND (employee_id = public.my_employee_id() OR public.can('care','edit') OR public.is_admin()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['maintenance_attendance', 'maintenance_timesheets']
  LOOP
    EXECUTE format('CREATE TRIGGER trg_touch_%1$s BEFORE UPDATE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t);
    EXECUTE format('CREATE TRIGGER trg_audit_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$s FOR EACH ROW EXECUTE FUNCTION public.write_audit();', t);
  END LOOP;
END $$;
