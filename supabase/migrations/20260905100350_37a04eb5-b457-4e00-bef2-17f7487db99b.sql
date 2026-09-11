
-- PERMISSION MATRIX
INSERT INTO public.role_permissions(role, module, action)
SELECT r::public.app_role, m, a FROM
  (VALUES ('md'),('ceo')) AS roles(r),
  (VALUES ('dashboard'),('crm'),('projects'),('design'),('boq'),('procurement'),('inventory'),('nursery'),('plantiq'),('care'),('finance'),('hr'),('documents'),('admin'),('jarvis')) AS mods(m),
  (VALUES ('view'),('create'),('edit'),('approve'),('reject'),('export'),('delete'),('ai_recommend'),('ai_execute'),('financial_approval')) AS acts(a)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions(role, module, action) VALUES
  ('cto','admin','view'),('cto','admin','edit'),('cto','dashboard','view'),('cto','jarvis','view'),('cto','jarvis','ai_execute'),('cto','documents','view'),('cto','projects','view'),
  ('sales_director','dashboard','view'),('sales_director','crm','view'),('sales_director','crm','create'),('sales_director','crm','edit'),('sales_director','crm','approve'),('sales_director','crm','export'),('sales_director','jarvis','view'),('sales_director','projects','view'),('sales_director','boq','view'),
  ('bd_manager','dashboard','view'),('bd_manager','crm','view'),('bd_manager','crm','create'),('bd_manager','crm','edit'),('bd_manager','jarvis','view'),
  ('design_head','dashboard','view'),('design_head','design','view'),('design_head','design','create'),('design_head','design','edit'),('design_head','design','approve'),('design_head','boq','view'),('design_head','plantiq','view'),('design_head','plantiq','edit'),('design_head','jarvis','view'),('design_head','projects','view'),
  ('designer','dashboard','view'),('designer','design','view'),('designer','design','create'),('designer','design','edit'),('designer','plantiq','view'),('designer','jarvis','view'),
  ('project_manager','dashboard','view'),('project_manager','projects','view'),('project_manager','projects','create'),('project_manager','projects','edit'),('project_manager','projects','approve'),('project_manager','boq','view'),('project_manager','procurement','view'),('project_manager','procurement','create'),('project_manager','inventory','view'),('project_manager','jarvis','view'),('project_manager','documents','view'),
  ('site_engineer','dashboard','view'),('site_engineer','projects','view'),('site_engineer','projects','edit'),('site_engineer','inventory','view'),('site_engineer','jarvis','view'),
  ('site_supervisor','dashboard','view'),('site_supervisor','projects','view'),('site_supervisor','projects','edit'),('site_supervisor','jarvis','view'),
  ('horticulture_head','dashboard','view'),('horticulture_head','plantiq','view'),('horticulture_head','plantiq','create'),('horticulture_head','plantiq','edit'),('horticulture_head','plantiq','approve'),('horticulture_head','nursery','view'),('horticulture_head','care','view'),('horticulture_head','jarvis','view'),
  ('procurement_manager','dashboard','view'),('procurement_manager','procurement','view'),('procurement_manager','procurement','create'),('procurement_manager','procurement','edit'),('procurement_manager','procurement','approve'),('procurement_manager','inventory','view'),('procurement_manager','jarvis','view'),
  ('store_manager','dashboard','view'),('store_manager','inventory','view'),('store_manager','inventory','create'),('store_manager','inventory','edit'),('store_manager','nursery','view'),('store_manager','jarvis','view'),
  ('finance','dashboard','view'),('finance','finance','view'),('finance','finance','create'),('finance','finance','edit'),('finance','finance','approve'),('finance','finance','financial_approval'),('finance','projects','view'),('finance','jarvis','view'),
  ('hr','dashboard','view'),('hr','hr','view'),('hr','hr','create'),('hr','hr','edit'),('hr','hr','approve'),('hr','jarvis','view'),
  ('client','dashboard','view'),('client','projects','view'),('client','jarvis','view')
ON CONFLICT DO NOTHING;

-- COMPANY
-- This is the real company this ERP is for. handle_new_user() requires at
-- least one row here so the first person to sign up can be auto-provisioned
-- as its 'md'. Everything below this (employees, clients, projects, etc.)
-- was fictional Lovable-generated demo data and has been removed — real
-- records are created through the app itself.
INSERT INTO public.companies (id, code, name, legal_name, gstin, city, state) VALUES
  ('11111111-1111-1111-1111-111111111111','SAMAK','Samak Landscape','Samak Landscape Pvt. Ltd.','27AABCS1429B1ZX','Pune','Maharashtra');

-- DEPARTMENTS
INSERT INTO public.departments (id, company_id, code, name) VALUES
  ('21111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','MGMT','Management'),
  ('21111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','SALES','Sales & Business Development'),
  ('21111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','DESIGN','Design Studio'),
  ('21111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','PROJ','Projects & Execution'),
  ('21111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','HORT','Horticulture'),
  ('21111111-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','PROC','Procurement & Stores'),
  ('21111111-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','FIN','Finance'),
  ('21111111-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','HR','Human Resources');

-- PLANT SPECIES — a generic botanical reference catalogue, not tenant-scoped.
INSERT INTO public.plant_species (botanical_name, common_name, category, water_need, sunlight, soil_type, growth_rate, mature_height_m, maintenance_level, native_region) VALUES
  ('Tabebuia rosea','Pink Trumpet Tree','tree','medium','full_sun','well_drained_loam','fast',15,'low','Tropical America'),
  ('Plumeria obtusa','Frangipani','tree','low','full_sun','sandy_loam','medium',6,'low','Caribbean'),
  ('Ficus benjamina','Weeping Fig','tree','medium','partial_shade','loam','fast',18,'medium','South Asia'),
  ('Bougainvillea glabra','Paper Flower','shrub','low','full_sun','well_drained','fast',4,'low','Brazil'),
  ('Ixora coccinea','Jungle Geranium','shrub','medium','full_sun','acidic_loam','medium',2,'medium','India'),
  ('Cynodon dactylon','Bermuda / Doob Grass','turf','medium','full_sun','sandy_loam','fast',0.1,'high','India'),
  ('Zoysia japonica','Korean Lawn Grass','turf','low','full_sun','loam','slow',0.1,'medium','East Asia'),
  ('Cyperus alternifolius','Umbrella Palm','aquatic','high','partial_shade','wet_clay','fast',1.5,'medium','Madagascar'),
  ('Azadirachta indica','Neem','tree','low','full_sun','any','medium',20,'low','India'),
  ('Alstonia scholaris','Saptaparni','tree','medium','full_sun','loam','fast',25,'low','India'),
  ('Nerium oleander','Kaner','shrub','low','full_sun','any','medium',3,'low','Mediterranean'),
  ('Dracaena trifasciata','Snake Plant','groundcover','low','shade','well_drained','slow',0.9,'low','West Africa');

-- MATERIALS — a generic materials/rate catalogue, not tenant-scoped.
INSERT INTO public.materials (code, name, category, uom, standard_rate, hsn_code) VALUES
  ('MAT-0001','Imported Red Soil','soil','cum',1350,'2505'),
  ('MAT-0002','Well-decomposed Farmyard Manure','soil','cum',2100,'3101'),
  ('MAT-0003','Vermicompost','soil','kg',14,'3101'),
  ('MAT-0004','Cocopeat Block','soil','kg',22,'5305'),
  ('MAT-0005','16mm Inline Drip Lateral','irrigation','rm',28,'3917'),
  ('MAT-0006','Pop-up Sprinkler 4"','irrigation','nos',940,'8424'),
  ('MAT-0007','Solenoid Valve 1" 24V','irrigation','nos',2650,'8481'),
  ('MAT-0008','Irrigation Controller 12 Station','irrigation','nos',48000,'8537'),
  ('MAT-0009','Kota Stone 25mm','hardscape','sqm','780','6802'),
  ('MAT-0010','Interlocking Paver 80mm','hardscape','sqm',620,'6810'),
  ('MAT-0011','Garden Bollard Light 12W','lighting','nos',3400,'9405'),
  ('MAT-0012','Tree Spike Light 9W','lighting','nos',1850,'9405'),
  ('MAT-0013','Geotextile Membrane 200 GSM','civil','sqm',95,'5603'),
  ('MAT-0014','Bamboo Tree Stake 8ft','plantation','nos',110,'1401');
