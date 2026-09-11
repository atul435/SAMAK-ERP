-- ============ FINANCE ============
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  invoice_code text NOT NULL,
  title text NOT NULL,
  invoice_type text NOT NULL DEFAULT 'interim',
  project_id uuid REFERENCES public.projects(id),
  client_id uuid REFERENCES public.clients(id),
  boq_id uuid REFERENCES public.boqs(id),
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  tax_percent numeric NOT NULL DEFAULT 18,
  retention_percent numeric NOT NULL DEFAULT 0,
  advance_adjusted numeric NOT NULL DEFAULT 0,
  notes text,
  raised_by uuid REFERENCES public.employees(id),
  status record_status NOT NULL DEFAULT 'draft',
  approval_state approval_state NOT NULL DEFAULT 'draft',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (company_id, invoice_code)
);

CREATE TABLE public.invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  boq_item_id uuid REFERENCES public.boq_items(id),
  description text NOT NULL,
  uom text NOT NULL DEFAULT 'nos',
  quantity numeric NOT NULL DEFAULT 0,
  unit_rate numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  payment_code text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound',
  amount numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL DEFAULT CURRENT_DATE,
  mode text NOT NULL DEFAULT 'neft',
  reference text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id),
  client_id uuid REFERENCES public.clients(id),
  vendor_id uuid REFERENCES public.vendors(id),
  tds_amount numeric NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (company_id, payment_code)
);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  expense_code text NOT NULL,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'site',
  project_id uuid REFERENCES public.projects(id),
  employee_id uuid REFERENCES public.employees(id),
  vendor_id uuid REFERENCES public.vendors(id),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  is_reimbursable boolean NOT NULL DEFAULT false,
  is_reimbursed boolean NOT NULL DEFAULT false,
  payment_mode text NOT NULL DEFAULT 'cash',
  bill_reference text,
  remarks text,
  status record_status NOT NULL DEFAULT 'submitted',
  approval_state approval_state NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (company_id, expense_code)
);

-- ============ HR ============
CREATE TABLE public.employee_compensation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  monthly_gross numeric NOT NULL DEFAULT 0,
  basic numeric NOT NULL DEFAULT 0,
  hra numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  pf_applicable boolean NOT NULL DEFAULT true,
  esi_applicable boolean NOT NULL DEFAULT false,
  bank_account_last4 text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (employee_id, effective_from)
);

CREATE TABLE public.payroll_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  run_code text NOT NULL,
  period_month date NOT NULL,
  working_days integer NOT NULL DEFAULT 26,
  notes text,
  prepared_by uuid REFERENCES public.employees(id),
  status record_status NOT NULL DEFAULT 'draft',
  approval_state approval_state NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (company_id, period_month)
);

CREATE TABLE public.payroll_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id),
  days_present numeric NOT NULL DEFAULT 26,
  basic numeric NOT NULL DEFAULT 0,
  hra numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  overtime numeric NOT NULL DEFAULT 0,
  pf_deduction numeric NOT NULL DEFAULT 0,
  esi_deduction numeric NOT NULL DEFAULT 0,
  tds_deduction numeric NOT NULL DEFAULT 0,
  other_deduction numeric NOT NULL DEFAULT 0,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  UNIQUE (payroll_run_id, employee_id)
);

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL DEFAULT 'casual',
  from_date date NOT NULL,
  to_date date NOT NULL,
  days numeric NOT NULL DEFAULT 1,
  reason text,
  approver_id uuid REFERENCES public.employees(id),
  decided_at timestamptz,
  decision_note text,
  approval_state approval_state NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

-- ============ GRANTS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_compensation TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT ALL ON public.invoice_items TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.expenses TO service_role;
GRANT ALL ON public.employee_compensation TO service_role;
GRANT ALL ON public.payroll_runs TO service_role;
GRANT ALL ON public.payroll_items TO service_role;
GRANT ALL ON public.leave_requests TO service_role;

-- ============ RLS ============
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_compensation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON public.invoices FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "invoices_insert" ON public.invoices FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('finance','edit') OR public.is_admin()));
CREATE POLICY "invoices_update" ON public.invoices FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('finance','edit') OR public.is_admin()));
CREATE POLICY "invoices_delete" ON public.invoices FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "invoice_items_select" ON public.invoice_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = public.my_company_id()));
CREATE POLICY "invoice_items_write" ON public.invoice_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = public.my_company_id()) AND (public.can('finance','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND i.company_id = public.my_company_id()) AND (public.can('finance','edit') OR public.is_admin()));

CREATE POLICY "payments_select" ON public.payments FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "payments_insert" ON public.payments FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('finance','edit') OR public.is_admin()));
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('finance','edit') OR public.is_admin()));
CREATE POLICY "payments_delete" ON public.payments FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "expenses_select" ON public.expenses FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "expenses_insert" ON public.expenses FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('finance','edit') OR employee_id = public.my_employee_id() OR public.is_admin()));
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('finance','edit') OR public.is_admin()));
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "comp_select" ON public.employee_compensation FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND (public.can('hr','view') OR public.is_admin() OR employee_id = public.my_employee_id()));
CREATE POLICY "comp_insert" ON public.employee_compensation FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('hr','edit') OR public.is_admin()));
CREATE POLICY "comp_update" ON public.employee_compensation FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('hr','edit') OR public.is_admin()));
CREATE POLICY "comp_delete" ON public.employee_compensation FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "payroll_runs_select" ON public.payroll_runs FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND (public.can('hr','view') OR public.can('finance','view') OR public.is_admin()));
CREATE POLICY "payroll_runs_insert" ON public.payroll_runs FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('hr','edit') OR public.is_admin()));
CREATE POLICY "payroll_runs_update" ON public.payroll_runs FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('hr','edit') OR public.is_admin()));
CREATE POLICY "payroll_runs_delete" ON public.payroll_runs FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "payroll_items_select" ON public.payroll_items FOR SELECT TO authenticated USING (
  public.can('hr','view') OR public.can('finance','view') OR public.is_admin() OR employee_id = public.my_employee_id()
);
CREATE POLICY "payroll_items_write" ON public.payroll_items FOR ALL TO authenticated
  USING (public.can('hr','edit') OR public.is_admin())
  WITH CHECK (public.can('hr','edit') OR public.is_admin());

CREATE POLICY "leave_select" ON public.leave_requests FOR SELECT TO authenticated USING (company_id = public.my_company_id() AND (public.can('hr','view') OR public.is_admin() OR employee_id = public.my_employee_id()));
CREATE POLICY "leave_insert" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (employee_id = public.my_employee_id() OR public.can('hr','edit') OR public.is_admin()));
CREATE POLICY "leave_update" ON public.leave_requests FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('hr','edit') OR public.is_admin() OR employee_id = public.my_employee_id()));
CREATE POLICY "leave_delete" ON public.leave_requests FOR DELETE TO authenticated USING (public.is_admin());

-- ============ TRIGGERS & INDEXES ============
CREATE TRIGGER trg_touch_invoices BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_invoice_items BEFORE UPDATE ON public.invoice_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_payments BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_expenses BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_comp BEFORE UPDATE ON public.employee_compensation FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_payroll_runs BEFORE UPDATE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_payroll_items BEFORE UPDATE ON public.payroll_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_leave BEFORE UPDATE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_audit_invoices AFTER INSERT OR UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_payments AFTER INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_payroll_runs AFTER INSERT OR UPDATE OR DELETE ON public.payroll_runs FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_comp AFTER INSERT OR UPDATE OR DELETE ON public.employee_compensation FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_leave AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests FOR EACH ROW EXECUTE FUNCTION public.write_audit();

CREATE INDEX idx_invoices_project ON public.invoices(project_id);
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX idx_payments_project ON public.payments(project_id);
CREATE INDEX idx_expenses_project ON public.expenses(project_id);
CREATE INDEX idx_payroll_items_run ON public.payroll_items(payroll_run_id);
CREATE INDEX idx_leave_employee ON public.leave_requests(employee_id);

-- ============ PERMISSIONS ============
INSERT INTO public.role_permissions(role, module, action)
SELECT r::app_role, m, a FROM
  (VALUES ('md'),('ceo'),('cto'),('finance')) roles(r),
  (VALUES ('finance'),('hr')) mods(m),
  (VALUES ('view'),('edit'),('approve')) acts(a)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role, module, action)
SELECT r::app_role, m, a FROM
  (VALUES ('hr')) roles(r),
  (VALUES ('hr')) mods(m),
  (VALUES ('view'),('edit'),('approve')) acts(a)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role, module, action)
SELECT r::app_role, 'finance', 'view' FROM (VALUES ('hr'),('sales_director'),('bd_manager'),('project_manager'),('procurement_manager'),('design_head')) roles(r)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role, module, action)
SELECT r::app_role, 'hr', 'view' FROM (VALUES ('project_manager'),('design_head'),('horticulture_head')) roles(r)
ON CONFLICT DO NOTHING;

-- Fictional demo invoices/payments/expenses/payroll/leave removed —
-- created through the app once real projects and employees exist.