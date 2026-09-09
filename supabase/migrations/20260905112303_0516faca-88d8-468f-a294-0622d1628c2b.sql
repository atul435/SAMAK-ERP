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

-- ============ DEMO DATA ============
INSERT INTO public.invoices (id, company_id, invoice_code, title, invoice_type, project_id, client_id, invoice_date, due_date, tax_percent, retention_percent, advance_adjusted, notes, raised_by, status, approval_state)
VALUES
 ('d1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','INV-2026-001','Mobilisation advance — Godrej Emerald','advance','71111111-0000-0000-0000-000000000001','41111111-0000-0000-0000-000000000001','2026-04-10','2026-04-25',18,0,0,'20% mobilisation advance against bank guarantee','31111111-0000-0000-0000-000000000014','completed','executed'),
 ('d1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','INV-2026-002','RA Bill 1 — Godrej Emerald','interim','71111111-0000-0000-0000-000000000001','41111111-0000-0000-0000-000000000001','2026-06-05','2026-07-05',18,5,900000,'Earthwork, hardscape base and irrigation mains','31111111-0000-0000-0000-000000000014','completed','executed'),
 ('d1000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','INV-2026-003','RA Bill 2 — Godrej Emerald','interim','71111111-0000-0000-0000-000000000001','41111111-0000-0000-0000-000000000001','2026-08-08','2026-09-07',18,5,900000,'Softscape phase 1 and pathway paving','31111111-0000-0000-0000-000000000014','approved','approved'),
 ('d1000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','INV-2026-004','RA Bill 1 — PMC Riverfront','interim','71111111-0000-0000-0000-000000000002','41111111-0000-0000-0000-000000000002','2026-07-18','2026-08-17',18,10,0,'Riverfront promenade earthwork and avenue planting','31111111-0000-0000-0000-000000000014','completed','executed'),
 ('d1000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','INV-2026-005','RA Bill 2 — PMC Riverfront','interim','71111111-0000-0000-0000-000000000002','41111111-0000-0000-0000-000000000002','2026-08-28','2026-09-27',18,10,0,'Lawn establishment and lighting conduits','31111111-0000-0000-0000-000000000014','submitted','pending_approval'),
 ('d1000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','INV-2026-006','RA Bill 1 — Infosys Hinjawadi','interim','71111111-0000-0000-0000-000000000003','41111111-0000-0000-0000-000000000003','2026-08-20','2026-09-19',18,5,0,'Courtyard hardscape and specimen tree supply','31111111-0000-0000-0000-000000000014','approved','approved'),
 ('d1000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','INV-2026-007','AMC Quarter 2 — Taj Blue Diamond','final','71111111-0000-0000-0000-000000000004','41111111-0000-0000-0000-000000000004','2026-09-01','2026-09-16',18,0,0,'Quarterly maintenance billing','31111111-0000-0000-0000-000000000014','draft','draft');

INSERT INTO public.invoice_items (invoice_id, description, uom, quantity, unit_rate, sort_order) VALUES
 ('d1000000-0000-0000-0000-000000000001','20% mobilisation advance on contract value','ls',1,3700000,1),
 ('d1000000-0000-0000-0000-000000000002','Site clearance and earthwork in landscape zones','sqm',4200,180,1),
 ('d1000000-0000-0000-0000-000000000002','Irrigation mainline and valve chambers','rm',860,640,2),
 ('d1000000-0000-0000-0000-000000000002','Hardscape sub-base and kerbing','sqm',1150,520,3),
 ('d1000000-0000-0000-0000-000000000003','Supply and planting of ornamental shrubs','nos',3800,240,1),
 ('d1000000-0000-0000-0000-000000000003','Kota stone pathway paving','sqm',940,1450,2),
 ('d1000000-0000-0000-0000-000000000003','Imported garden soil and compost mix','cum',260,2100,3),
 ('d1000000-0000-0000-0000-000000000004','Promenade earthwork and grading','sqm',6800,165,1),
 ('d1000000-0000-0000-0000-000000000004','Avenue tree supply and pit preparation','nos',420,3200,2),
 ('d1000000-0000-0000-0000-000000000005','Lawn establishment — Bermuda turf','sqm',7400,120,1),
 ('d1000000-0000-0000-0000-000000000005','Lighting conduit and pole foundations','nos',96,4800,2),
 ('d1000000-0000-0000-0000-000000000006','Courtyard granite paving','sqm',1320,2250,1),
 ('d1000000-0000-0000-0000-000000000006','Specimen tree supply — 300mm girth','nos',48,28000,2),
 ('d1000000-0000-0000-0000-000000000007','Quarterly horticulture maintenance — 3 months','month',3,185000,1);

INSERT INTO public.payments (company_id, payment_code, direction, amount, paid_on, mode, reference, invoice_id, project_id, client_id, tds_amount, remarks) VALUES
 ('11111111-1111-1111-1111-111111111111','RCT-2026-001','inbound',4366000,'2026-04-22','rtgs','GODREJ/ADV/4471','d1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','41111111-0000-0000-0000-000000000001',0,'Mobilisation advance received in full'),
 ('11111111-1111-1111-1111-111111111111','RCT-2026-002','inbound',2100000,'2026-07-02','neft','GODREJ/RA1/5510','d1000000-0000-0000-0000-000000000002','71111111-0000-0000-0000-000000000001','41111111-0000-0000-0000-000000000001',42000,'Part payment against RA Bill 1'),
 ('11111111-1111-1111-1111-111111111111','RCT-2026-003','inbound',1250000,'2026-07-28','neft','GODREJ/RA1/5680','d1000000-0000-0000-0000-000000000002','71111111-0000-0000-0000-000000000001','41111111-0000-0000-0000-000000000001',25000,'Balance against RA Bill 1 less retention'),
 ('11111111-1111-1111-1111-111111111111','RCT-2026-004','inbound',1800000,'2026-08-14','rtgs','PMC/TR/22190','d1000000-0000-0000-0000-000000000004','71111111-0000-0000-0000-000000000002','41111111-0000-0000-0000-000000000002',36000,'Treasury release against RA Bill 1');

INSERT INTO public.payments (company_id, payment_code, direction, amount, paid_on, mode, reference, purchase_order_id, project_id, vendor_id, tds_amount, remarks) VALUES
 ('11111111-1111-1111-1111-111111111111','PAY-2026-001','outbound',780000,'2026-07-10','neft','SAM/VEN/0091','c3000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',7800,'Advance 50% against plant supply order'),
 ('11111111-1111-1111-1111-111111111111','PAY-2026-002','outbound',415000,'2026-08-06','neft','SAM/VEN/0104','c3000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001',4150,'Part payment on delivery of first lot'),
 ('11111111-1111-1111-1111-111111111111','PAY-2026-003','outbound',236000,'2026-08-21','cheque','CHQ/447120',NULL,'71111111-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000003',2360,'Irrigation fittings running account');

INSERT INTO public.expenses (company_id, expense_code, title, category, project_id, employee_id, expense_date, amount, tax_amount, is_reimbursable, is_reimbursed, payment_mode, bill_reference, remarks, status, approval_state) VALUES
 ('11111111-1111-1111-1111-111111111111','EXP-2026-001','Site fuel for excavator and tipper','site','71111111-0000-0000-0000-000000000001','31111111-0000-0000-0000-000000000009','2026-08-04',18400,0,false,false,'cash','HP/PUN/88213','Two days of earthwork','completed','approved'),
 ('11111111-1111-1111-1111-111111111111','EXP-2026-002','Labour transport — Hinjawadi site','site','71111111-0000-0000-0000-000000000003','31111111-0000-0000-0000-000000000010','2026-08-09',9600,0,true,true,'upi','TEMPO/2231','Daily pickup for 22 workers','completed','approved'),
 ('11111111-1111-1111-1111-111111111111','EXP-2026-003','Client meeting travel — Mumbai','travel',NULL,'31111111-0000-0000-0000-000000000004','2026-08-12',7250,0,true,false,'card','UBER/MH/7712','Godrej head office review','submitted','pending_approval'),
 ('11111111-1111-1111-1111-111111111111','EXP-2026-004','Safety helmets, gloves and jackets','site','71111111-0000-0000-0000-000000000002','31111111-0000-0000-0000-000000000008','2026-08-16',34500,6210,false,false,'neft','SAFE/PUN/1180','PPE replenishment for riverfront crew','completed','approved'),
 ('11111111-1111-1111-1111-111111111111','EXP-2026-005','Nursery water tanker supply','site','71111111-0000-0000-0000-000000000001','31111111-0000-0000-0000-000000000011','2026-08-22',12800,0,false,false,'cash','TANK/449','Six tankers during dry spell','submitted','pending_approval'),
 ('11111111-1111-1111-1111-111111111111','EXP-2026-006','Design software subscription — annual','office',NULL,'31111111-0000-0000-0000-000000000006','2026-08-25',146000,26280,false,false,'card','AUTODESK/IN/9921','CAD and rendering licences','completed','approved'),
 ('11111111-1111-1111-1111-111111111111','EXP-2026-007','Site office rent and electricity','site','71111111-0000-0000-0000-000000000002','31111111-0000-0000-0000-000000000008','2026-08-31',28000,0,false,false,'neft','RENT/AUG26','Riverfront site cabin','completed','approved'),
 ('11111111-1111-1111-1111-111111111111','EXP-2026-008','Plant health lab testing','site','71111111-0000-0000-0000-000000000003','31111111-0000-0000-0000-000000000011','2026-09-02',6400,1152,true,false,'upi','AGRILAB/338','Soil and leaf analysis','submitted','submitted');

INSERT INTO public.employee_compensation (company_id, employee_id, effective_from, monthly_gross, basic, hra, allowances, pf_applicable, esi_applicable, bank_account_last4)
SELECT e.company_id, e.id, DATE '2026-04-01',
  g.gross, ROUND(g.gross * 0.5), ROUND(g.gross * 0.2), g.gross - ROUND(g.gross * 0.5) - ROUND(g.gross * 0.2),
  true, g.gross < 25000,
  LPAD(((ABS(HASHTEXT(e.employee_code)) % 9000) + 1000)::text, 4, '0')
FROM public.employees e
CROSS JOIN LATERAL (SELECT CASE e.primary_role
    WHEN 'md' THEN 450000 WHEN 'ceo' THEN 380000 WHEN 'cto' THEN 320000
    WHEN 'sales_director' THEN 210000 WHEN 'bd_manager' THEN 120000
    WHEN 'design_head' THEN 175000 WHEN 'designer' THEN 78000
    WHEN 'project_manager' THEN 145000 WHEN 'site_engineer' THEN 62000
    WHEN 'site_supervisor' THEN 38000 WHEN 'horticulture_head' THEN 155000
    WHEN 'procurement_manager' THEN 112000 WHEN 'store_manager' THEN 46000
    WHEN 'finance' THEN 98000 WHEN 'hr' THEN 86000 ELSE 55000 END AS gross) g
WHERE e.is_active
ON CONFLICT DO NOTHING;

INSERT INTO public.payroll_runs (id, company_id, run_code, period_month, working_days, notes, prepared_by, status, approval_state) VALUES
 ('d2000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','PR-2026-07','2026-07-01',26,'July 2026 payroll — disbursed on 31 July','31111111-0000-0000-0000-000000000015','completed','executed'),
 ('d2000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','PR-2026-08','2026-08-01',26,'August 2026 payroll — awaiting finance approval','31111111-0000-0000-0000-000000000015','submitted','pending_approval');

INSERT INTO public.payroll_items (payroll_run_id, employee_id, project_id, days_present, basic, hra, allowances, overtime, pf_deduction, esi_deduction, tds_deduction, other_deduction)
SELECT r.id, c.employee_id,
  CASE e.primary_role WHEN 'site_engineer' THEN '71111111-0000-0000-0000-000000000001'::uuid
                      WHEN 'site_supervisor' THEN '71111111-0000-0000-0000-000000000003'::uuid
                      WHEN 'project_manager' THEN '71111111-0000-0000-0000-000000000002'::uuid
                      ELSE NULL END,
  CASE WHEN r.run_code = 'PR-2026-08' AND e.primary_role = 'designer' THEN 24 ELSE 26 END,
  c.basic, c.hra, c.allowances,
  CASE WHEN e.primary_role IN ('site_engineer','site_supervisor') THEN 4200 ELSE 0 END,
  CASE WHEN c.pf_applicable THEN LEAST(ROUND(c.basic * 0.12), 1800) ELSE 0 END,
  CASE WHEN c.esi_applicable THEN ROUND(c.monthly_gross * 0.0075) ELSE 0 END,
  ROUND(c.monthly_gross * CASE WHEN c.monthly_gross > 150000 THEN 0.14 WHEN c.monthly_gross > 80000 THEN 0.08 WHEN c.monthly_gross > 45000 THEN 0.03 ELSE 0 END),
  0
FROM public.payroll_runs r
JOIN public.employee_compensation c ON c.company_id = r.company_id
JOIN public.employees e ON e.id = c.employee_id
WHERE r.run_code IN ('PR-2026-07','PR-2026-08')
ON CONFLICT DO NOTHING;

INSERT INTO public.leave_requests (company_id, employee_id, leave_type, from_date, to_date, days, reason, approver_id, approval_state, decided_at, decision_note) VALUES
 ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000007','casual','2026-08-14','2026-08-15',2,'Family function in Nashik','31111111-0000-0000-0000-000000000006','approved','2026-08-11 06:30:00+00','Cover arranged for the Infosys drawings'),
 ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000009','sick','2026-08-26','2026-08-27',2,'Viral fever, doctor advised rest','31111111-0000-0000-0000-000000000008','approved','2026-08-26 04:15:00+00','Medical certificate received'),
 ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000010','earned','2026-09-08','2026-09-12',5,'Annual village visit','31111111-0000-0000-0000-000000000008','pending_approval',NULL,NULL),
 ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000013','casual','2026-09-04','2026-09-04',1,'Personal bank work','31111111-0000-0000-0000-000000000015','submitted',NULL,NULL),
 ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000005','earned','2026-09-15','2026-09-19',5,'Pre-planned holiday','31111111-0000-0000-0000-000000000004','pending_approval',NULL,NULL);