-- Landscape maintenance staff (per the Maintenance ERP specification's
-- persona table): roles not covered by any existing construction-side
-- role. Site supervision and plant-health diagnosis reuse the existing
-- site_supervisor / horticulture_head roles rather than duplicating them.
--
-- Postgres can't add an enum value and use it in the same transaction,
-- so this must be run and committed on its own before the follow-up
-- migration that inserts role_permissions rows using these values.
ALTER TYPE public.app_role ADD VALUE 'maintenance_head';
ALTER TYPE public.app_role ADD VALUE 'regional_manager';
ALTER TYPE public.app_role ADD VALUE 'irrigation_technician';
ALTER TYPE public.app_role ADD VALUE 'maintenance_crew';
