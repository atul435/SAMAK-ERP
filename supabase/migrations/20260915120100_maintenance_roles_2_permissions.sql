-- Default permissions for the new landscape maintenance roles. The
-- 'care' module already exists in role_permissions/PERMISSION_MODULES
-- as a placeholder for the "Samak Care / AMC" nav item (currently
-- future:true, no live tables/RLS reference it yet) -- these grants are
-- forward-looking, so the module works correctly for the right people
-- the moment it's actually built, per the Maintenance ERP specification.
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('maintenance_head','dashboard','view'),
  ('maintenance_head','care','view'),
  ('maintenance_head','care','create'),
  ('maintenance_head','care','edit'),
  ('maintenance_head','care','approve'),
  ('maintenance_head','hr','view'),
  ('maintenance_head','finance','view'),
  ('maintenance_head','projects','view'),
  ('maintenance_head','jarvis','view'),

  ('regional_manager','dashboard','view'),
  ('regional_manager','care','view'),
  ('regional_manager','care','create'),
  ('regional_manager','care','edit'),
  ('regional_manager','procurement','view'),
  ('regional_manager','procurement','create'),
  ('regional_manager','jarvis','view'),

  ('irrigation_technician','dashboard','view'),
  ('irrigation_technician','care','view'),
  ('irrigation_technician','care','create'),
  ('irrigation_technician','care','edit'),
  ('irrigation_technician','jarvis','view'),

  ('maintenance_crew','dashboard','view'),
  ('maintenance_crew','care','view'),
  ('maintenance_crew','care','create'),
  ('maintenance_crew','jarvis','view')
ON CONFLICT (role, module, action) DO NOTHING;
