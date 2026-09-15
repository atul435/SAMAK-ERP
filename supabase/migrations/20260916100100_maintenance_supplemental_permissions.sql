-- horticulture_head (the specification's Horticulturist/arborist
-- persona: "Diagnose, prescribe, follow-up") and site_supervisor (the
-- specification's Site supervisor persona: "Assign tasks, attendance,
-- daily report, inspections") each already existed for other reasons
-- but had little or no 'care' access -- horticulture_head had only
-- care.view, site_supervisor had none at all.
INSERT INTO public.role_permissions (role, module, action) VALUES
  ('horticulture_head','care','create'),
  ('horticulture_head','care','edit'),

  ('site_supervisor','dashboard','view'),
  ('site_supervisor','care','view'),
  ('site_supervisor','care','create'),
  ('site_supervisor','care','edit')
ON CONFLICT (role, module, action) DO NOTHING;
