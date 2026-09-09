-- VENDORS
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  vendor_code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'material',
  gstin text,
  city text,
  state text,
  contact_name text,
  email text,
  phone text,
  payment_terms text,
  rating numeric NOT NULL DEFAULT 0,
  is_approved boolean NOT NULL DEFAULT false,
  status record_status NOT NULL DEFAULT 'approved',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (company_id, vendor_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors select" ON public.vendors FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "vendors insert" ON public.vendors FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.is_admin()));
CREATE POLICY "vendors update" ON public.vendors FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.is_admin()));
CREATE POLICY "vendors delete" ON public.vendors FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND public.is_admin());

-- PURCHASE ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  po_code text NOT NULL,
  title text NOT NULL,
  vendor_id uuid REFERENCES public.vendors(id),
  project_id uuid REFERENCES public.projects(id),
  boq_id uuid REFERENCES public.boqs(id),
  expected_date date,
  delivery_address text,
  notes text,
  tax_percent numeric NOT NULL DEFAULT 18,
  freight_amount numeric NOT NULL DEFAULT 0,
  requested_by uuid REFERENCES public.employees(id),
  approver_id uuid REFERENCES public.employees(id),
  status record_status NOT NULL DEFAULT 'draft',
  approval_state approval_state NOT NULL DEFAULT 'draft',
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (company_id, po_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po select" ON public.purchase_orders FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "po insert" ON public.purchase_orders FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.is_admin()));
CREATE POLICY "po update" ON public.purchase_orders FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('procurement','edit') OR public.is_admin()));
CREATE POLICY "po delete" ON public.purchase_orders FOR DELETE TO authenticated USING (company_id = public.my_company_id() AND public.is_admin());

-- PURCHASE ORDER ITEMS
CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  boq_item_id uuid REFERENCES public.boq_items(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id),
  species_id uuid REFERENCES public.plant_species(id),
  description text NOT NULL,
  uom text NOT NULL DEFAULT 'nos',
  quantity numeric NOT NULL DEFAULT 0,
  unit_rate numeric NOT NULL DEFAULT 0,
  received_quantity numeric NOT NULL DEFAULT 0,
  remarks text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_order_items TO authenticated;
GRANT ALL ON public.purchase_order_items TO service_role;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po items select" ON public.purchase_order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND p.company_id = public.my_company_id()));
CREATE POLICY "po items write" ON public.purchase_order_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND p.company_id = public.my_company_id()) AND (public.can('procurement','edit') OR public.is_admin()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders p WHERE p.id = purchase_order_id AND p.company_id = public.my_company_id()) AND (public.can('procurement','edit') OR public.is_admin()));

-- STORES
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  code text NOT NULL,
  name text NOT NULL,
  store_type text NOT NULL DEFAULT 'site',
  project_id uuid REFERENCES public.projects(id),
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (company_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stores select" ON public.stores FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "stores write" ON public.stores FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('inventory','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('inventory','edit') OR public.is_admin()));

-- STOCK MOVEMENTS
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  store_id uuid NOT NULL REFERENCES public.stores(id),
  movement_type text NOT NULL DEFAULT 'receipt',
  material_id uuid REFERENCES public.materials(id),
  species_id uuid REFERENCES public.plant_species(id),
  description text NOT NULL,
  uom text NOT NULL DEFAULT 'nos',
  quantity numeric NOT NULL DEFAULT 0,
  unit_rate numeric NOT NULL DEFAULT 0,
  project_id uuid REFERENCES public.projects(id),
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id) ON DELETE SET NULL,
  reference text,
  remarks text,
  moved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock select" ON public.stock_movements FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "stock write" ON public.stock_movements FOR ALL TO authenticated
  USING (company_id = public.my_company_id() AND (public.can('inventory','edit') OR public.is_admin()))
  WITH CHECK (company_id = public.my_company_id() AND (public.can('inventory','edit') OR public.is_admin()));

-- TRIGGERS
CREATE TRIGGER trg_touch_vendors BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_purchase_orders BEFORE UPDATE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_po_items BEFORE UPDATE ON public.purchase_order_items FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_stores BEFORE UPDATE ON public.stores FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_stock_movements BEFORE UPDATE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_vendors AFTER INSERT OR UPDATE OR DELETE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_stock_movements AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- INDEXES
CREATE INDEX idx_po_items_po ON public.purchase_order_items(purchase_order_id);
CREATE INDEX idx_po_items_boq_item ON public.purchase_order_items(boq_item_id);
CREATE INDEX idx_stock_store ON public.stock_movements(store_id);
CREATE INDEX idx_stock_project ON public.stock_movements(project_id);

-- PERMISSIONS
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('md','procurement','view'),('md','procurement','edit'),('md','procurement','approve'),
  ('ceo','procurement','view'),('ceo','procurement','edit'),('ceo','procurement','approve'),
  ('cto','procurement','view'),
  ('procurement_manager','procurement','view'),('procurement_manager','procurement','edit'),
  ('store_manager','procurement','view'),
  ('project_manager','procurement','view'),('project_manager','procurement','edit'),
  ('finance','procurement','view'),
  ('site_engineer','procurement','view'),
  ('md','inventory','view'),('md','inventory','edit'),
  ('ceo','inventory','view'),('ceo','inventory','edit'),
  ('store_manager','inventory','view'),('store_manager','inventory','edit'),
  ('procurement_manager','inventory','view'),('procurement_manager','inventory','edit'),
  ('project_manager','inventory','view'),('project_manager','inventory','edit'),
  ('site_engineer','inventory','view'),('site_engineer','inventory','edit'),
  ('site_supervisor','inventory','view'),
  ('horticulture_head','inventory','view'),
  ('finance','inventory','view')
ON CONFLICT DO NOTHING;