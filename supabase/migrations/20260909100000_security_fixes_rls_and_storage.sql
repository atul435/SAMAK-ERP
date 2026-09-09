-- Security fixes from code audit (2026-09-08):
--   1. payroll_items had no company scoping in RLS — any user with hr/finance
--      "view" in any company could read every company's payroll lines.
--   2. site-photos storage bucket read/write policies checked only the
--      permission flag, never which company the underlying project belongs to.
--   3. Vendor banking details (bank_name/account_number/ifsc) lived on the
--      `vendors` table, which every employee with procurement "view" can read —
--      far broader than the people who should see bank accounts.

-- ============================================================
-- 1. payroll_items: scope by the owning payroll_run's company_id
-- ============================================================
DROP POLICY IF EXISTS "payroll_items_select" ON public.payroll_items;
DROP POLICY IF EXISTS "payroll_items_write" ON public.payroll_items;

CREATE POLICY "payroll_items_select" ON public.payroll_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.payroll_runs r
    WHERE r.id = payroll_run_id
      AND r.company_id = public.my_company_id()
  )
  AND (
    public.can('hr','view') OR public.can('finance','view') OR public.is_admin()
    OR employee_id = public.my_employee_id()
  )
);

CREATE POLICY "payroll_items_write" ON public.payroll_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.payroll_runs r
      WHERE r.id = payroll_run_id
        AND r.company_id = public.my_company_id()
    )
    AND (public.can('hr','edit') OR public.is_admin())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.payroll_runs r
      WHERE r.id = payroll_run_id
        AND r.company_id = public.my_company_id()
    )
    AND (public.can('hr','edit') OR public.is_admin())
  );

-- ============================================================
-- 2. storage.objects for bucket 'site-photos': scope by the project's
--    company_id, derived from the upload path convention
--    `${project_id}/${reportId}/${filename}` via storage.foldername().
-- ============================================================
DROP POLICY IF EXISTS "site_photos_read" ON storage.objects;
DROP POLICY IF EXISTS "site_photos_upload" ON storage.objects;
DROP POLICY IF EXISTS "site_photos_update" ON storage.objects;
DROP POLICY IF EXISTS "site_photos_delete" ON storage.objects;

CREATE POLICY "site_photos_read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'site-photos'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.company_id = public.my_company_id()
  )
);

CREATE POLICY "site_photos_upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'site-photos'
  AND (public.can('site_ops','edit') OR public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.company_id = public.my_company_id()
  )
);

CREATE POLICY "site_photos_update" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'site-photos'
  AND (public.can('site_ops','edit') OR public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.company_id = public.my_company_id()
  )
);

CREATE POLICY "site_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'site-photos'
  AND (public.can('site_ops','edit') OR public.is_admin())
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.company_id = public.my_company_id()
  )
);

-- ============================================================
-- 3. Vendor banking details: split into their own table with a
--    tighter policy than general vendor visibility (procurement:view
--    is held by most operational roles; banking data should not be).
-- ============================================================
CREATE TABLE public.vendor_bank_details (
  vendor_id uuid PRIMARY KEY REFERENCES public.vendors(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  bank_name text,
  account_number text,
  ifsc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

INSERT INTO public.vendor_bank_details (vendor_id, company_id, bank_name, account_number, ifsc)
SELECT id, company_id, bank_name, account_number, ifsc
FROM public.vendors
WHERE bank_name IS NOT NULL OR account_number IS NOT NULL OR ifsc IS NOT NULL
ON CONFLICT (vendor_id) DO NOTHING;

ALTER TABLE public.vendors
  DROP COLUMN IF EXISTS bank_name,
  DROP COLUMN IF EXISTS account_number,
  DROP COLUMN IF EXISTS ifsc;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_bank_details TO authenticated;
GRANT ALL ON public.vendor_bank_details TO service_role;
ALTER TABLE public.vendor_bank_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor_bank_details_select" ON public.vendor_bank_details FOR SELECT TO authenticated USING (
  company_id = public.my_company_id()
  AND (public.can('finance','view') OR public.can('procurement','edit') OR public.is_admin())
);

CREATE POLICY "vendor_bank_details_write" ON public.vendor_bank_details FOR ALL TO authenticated
  USING (
    company_id = public.my_company_id()
    AND (public.can('finance','edit') OR public.can('procurement','edit') OR public.is_admin())
  )
  WITH CHECK (
    company_id = public.my_company_id()
    AND (public.can('finance','edit') OR public.can('procurement','edit') OR public.is_admin())
  );

CREATE TRIGGER trg_touch_vendor_bank_details BEFORE UPDATE ON public.vendor_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_audit_vendor_bank_details AFTER INSERT OR UPDATE OR DELETE ON public.vendor_bank_details
  FOR EACH ROW EXECUTE FUNCTION public.write_audit();

CREATE INDEX idx_vendor_bank_details_company ON public.vendor_bank_details(company_id);
