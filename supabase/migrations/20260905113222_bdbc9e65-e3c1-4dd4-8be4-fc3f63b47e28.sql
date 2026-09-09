CREATE TABLE public.portal_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_type text NOT NULL CHECK (portal_type IN ('client','vendor')),
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  designation text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid,
  CONSTRAINT portal_users_target_ck CHECK (
    (portal_type = 'client' AND client_id IS NOT NULL AND vendor_id IS NULL)
    OR (portal_type = 'vendor' AND vendor_id IS NOT NULL AND client_id IS NULL)
  )
);

CREATE UNIQUE INDEX portal_users_email_key ON public.portal_users (lower(email));
CREATE INDEX idx_portal_users_client ON public.portal_users(client_id);
CREATE INDEX idx_portal_users_vendor ON public.portal_users(vendor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_users TO authenticated;
GRANT ALL ON public.portal_users TO service_role;

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.my_portal_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.portal_users
  WHERE user_id = auth.uid() AND portal_type = 'client' AND is_active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.my_portal_vendor_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vendor_id FROM public.portal_users
  WHERE user_id = auth.uid() AND portal_type = 'vendor' AND is_active LIMIT 1;
$$;

CREATE POLICY "portal_users_self_select" ON public.portal_users
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "portal_users_staff_select" ON public.portal_users
  FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "portal_users_admin_write" ON public.portal_users
  FOR ALL TO authenticated
  USING (public.is_admin() OR public.can('crm','edit'))
  WITH CHECK (public.is_admin() OR public.can('crm','edit'));

CREATE TRIGGER trg_touch_portal_users BEFORE UPDATE ON public.portal_users
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_portal_users AFTER INSERT OR UPDATE OR DELETE ON public.portal_users
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- Signup linking: portal invitees never become employees
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp public.employees%ROWTYPE; default_company uuid; portal public.portal_users%ROWTYPE;
BEGIN
  SELECT * INTO portal FROM public.portal_users
    WHERE lower(email) = lower(NEW.email) AND user_id IS NULL LIMIT 1;
  IF portal.id IS NOT NULL THEN
    UPDATE public.portal_users SET user_id = NEW.id WHERE id = portal.id;
    RETURN NEW;
  END IF;

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

-- Client portal read access
CREATE POLICY "portal_client_projects_select" ON public.projects
  FOR SELECT TO authenticated USING (client_id = public.my_portal_client_id());
CREATE POLICY "portal_client_clients_select" ON public.clients
  FOR SELECT TO authenticated USING (id = public.my_portal_client_id());
CREATE POLICY "portal_client_invoices_select" ON public.invoices
  FOR SELECT TO authenticated USING (client_id = public.my_portal_client_id());
CREATE POLICY "portal_client_invoice_items_select" ON public.invoice_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_items.invoice_id
      AND i.client_id = public.my_portal_client_id()));
CREATE POLICY "portal_client_site_reports_select" ON public.site_reports
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = site_reports.project_id
      AND p.client_id = public.my_portal_client_id()));

-- Vendor portal read access
CREATE POLICY "portal_vendor_vendors_select" ON public.vendors
  FOR SELECT TO authenticated USING (id = public.my_portal_vendor_id());
CREATE POLICY "portal_vendor_po_select" ON public.purchase_orders
  FOR SELECT TO authenticated USING (vendor_id = public.my_portal_vendor_id());
CREATE POLICY "portal_vendor_po_items_select" ON public.purchase_order_items
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.purchase_order_id
      AND po.vendor_id = public.my_portal_vendor_id()));

-- Payments visible to both sides
CREATE POLICY "portal_payments_select" ON public.payments
  FOR SELECT TO authenticated USING (
    client_id = public.my_portal_client_id() OR vendor_id = public.my_portal_vendor_id());

-- Demo portal accounts
INSERT INTO public.portal_users (id, company_id, portal_type, client_id, vendor_id, full_name, email, designation)
VALUES
 ('d1000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','client','41111111-0000-0000-0000-000000000001',NULL,'Anup Deshmukh','anup.deshmukh@godrejproperties.in','Project Head'),
 ('d1000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','client','41111111-0000-0000-0000-000000000003',NULL,'Sneha Iyer','sneha.iyer@infosys-campus.in','Facilities Manager'),
 ('d1000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','vendor',NULL,'c1000000-0000-0000-0000-000000000001','Sahyadri Nursery Desk','sales@sahyadrinursery.in','Sales Desk'),
 ('d1000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','vendor',NULL,'c1000000-0000-0000-0000-000000000004','Vishal Kadam','vishal@deccanstone.in','Proprietor');
