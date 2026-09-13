-- Plant Explorer needs to be usable by designers (already have plantiq.view)
-- and by sales/business-development staff, who did not have it before.
-- Since Explorer's core action is pushing selected plants straight into a
-- direct-client quotation, sales_director and bd_manager also need boq.edit
-- (sales_director already had boq.view; bd_manager had neither).
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('sales_director', 'plantiq', 'view'),
  ('bd_manager', 'plantiq', 'view'),
  ('sales_director', 'boq', 'edit'),
  ('bd_manager', 'boq', 'view'),
  ('bd_manager', 'boq', 'edit')
ON CONFLICT (role, module, action) DO NOTHING;
