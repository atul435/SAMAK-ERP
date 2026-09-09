
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

-- EMPLOYEES
INSERT INTO public.employees (id, company_id, department_id, employee_code, full_name, email, phone, designation, primary_role, date_of_joining) VALUES
  ('31111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000001','SAM-001','Rajendra Samak','rajendra.samak@samaklandscape.in','+91 98220 11001','Managing Director','md','2005-04-01'),
  ('31111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000001','SAM-002','Meera Kulkarni','meera.kulkarni@samaklandscape.in','+91 98220 11002','Chief Executive Officer','ceo','2014-06-15'),
  ('31111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000001','SAM-003','Arjun Deshpande','arjun.deshpande@samaklandscape.in','+91 98220 11003','CTO / Digital Transformation','cto','2022-01-10'),
  ('31111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000002','SAM-004','Nikhil Rane','nikhil.rane@samaklandscape.in','+91 98220 11004','Sales Director','sales_director','2016-08-01'),
  ('31111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000002','SAM-005','Priya Nair','priya.nair@samaklandscape.in','+91 98220 11005','Business Development Manager','bd_manager','2019-02-11'),
  ('31111111-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000003','SAM-006','Ananya Iyer','ananya.iyer@samaklandscape.in','+91 98220 11006','Design Head','design_head','2017-05-20'),
  ('31111111-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000003','SAM-007','Rohit Patil','rohit.patil@samaklandscape.in','+91 98220 11007','Landscape Designer','designer','2021-07-05'),
  ('31111111-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000004','SAM-008','Sanjay Gaikwad','sanjay.gaikwad@samaklandscape.in','+91 98220 11008','Senior Project Manager','project_manager','2015-03-18'),
  ('31111111-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000004','SAM-009','Imran Shaikh','imran.shaikh@samaklandscape.in','+91 98220 11009','Site Engineer','site_engineer','2020-11-02'),
  ('31111111-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000004','SAM-010','Ganesh Jadhav','ganesh.jadhav@samaklandscape.in','+91 98220 11010','Site Supervisor','site_supervisor','2018-09-14'),
  ('31111111-0000-0000-0000-000000000011','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000005','SAM-011','Dr. Kavita Joshi','kavita.joshi@samaklandscape.in','+91 98220 11011','Head of Horticulture','horticulture_head','2012-01-09'),
  ('31111111-0000-0000-0000-000000000012','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000006','SAM-012','Vivek Bhosale','vivek.bhosale@samaklandscape.in','+91 98220 11012','Procurement Manager','procurement_manager','2018-04-23'),
  ('31111111-0000-0000-0000-000000000013','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000006','SAM-013','Sunita More','sunita.more@samaklandscape.in','+91 98220 11013','Store In-charge','store_manager','2019-10-01'),
  ('31111111-0000-0000-0000-000000000014','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000007','SAM-014','Harsh Mehta','harsh.mehta@samaklandscape.in','+91 98220 11014','Chief Financial Officer','finance','2016-12-05'),
  ('31111111-0000-0000-0000-000000000015','11111111-1111-1111-1111-111111111111','21111111-0000-0000-0000-000000000008','SAM-015','Neha Kapoor','neha.kapoor@samaklandscape.in','+91 98220 11015','HR Manager','hr','2020-02-17');

UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000002' WHERE code='MGMT';
UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000004' WHERE code='SALES';
UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000006' WHERE code='DESIGN';
UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000008' WHERE code='PROJ';
UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000011' WHERE code='HORT';
UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000012' WHERE code='PROC';
UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000014' WHERE code='FIN';
UPDATE public.departments SET head_employee_id = '31111111-0000-0000-0000-000000000015' WHERE code='HR';

-- CLIENTS
INSERT INTO public.clients (id, company_id, client_code, name, sector, gstin, city, state, owner_employee_id) VALUES
  ('41111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','CL-0001','Godrej Properties Ltd.','Real Estate','27AAACG1234M1Z5','Mumbai','Maharashtra','31111111-0000-0000-0000-000000000004'),
  ('41111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','CL-0002','Pune Municipal Corporation','Government','27AAAGP4567K1Z2','Pune','Maharashtra','31111111-0000-0000-0000-000000000005'),
  ('41111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','CL-0003','Infosys Ltd. — Hinjawadi Campus','IT / Corporate','29AAACI1234A1Z0','Pune','Maharashtra','31111111-0000-0000-0000-000000000004'),
  ('41111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','CL-0004','Taj Hotels — Blue Diamond','Hospitality','27AAACT2727Q1ZW','Pune','Maharashtra','31111111-0000-0000-0000-000000000005'),
  ('41111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','CL-0005','Kalpataru Group','Real Estate','27AAACK7788R1Z9','Mumbai','Maharashtra','31111111-0000-0000-0000-000000000004');

INSERT INTO public.client_contacts (client_id, name, designation, email, phone, is_primary) VALUES
  ('41111111-0000-0000-0000-000000000001','Amit Bhandari','GM - Projects','amit.bhandari@godrejproperties.com','+91 98200 55511',true),
  ('41111111-0000-0000-0000-000000000002','Sunil Kadam','Executive Engineer - Garden Dept.','se.garden@punecorporation.org','+91 98500 77812',true),
  ('41111111-0000-0000-0000-000000000003','Rachel Fernandes','Facilities Head','rachel.fernandes@infosys.com','+91 99700 44120',true),
  ('41111111-0000-0000-0000-000000000004','Vikram Anand','General Manager','gm.bluediamond@tajhotels.com','+91 98600 22133',true),
  ('41111111-0000-0000-0000-000000000005','Sneha Rao','Head - Landscape','sneha.rao@kalpataru.com','+91 98190 66677',true);

-- LEADS
INSERT INTO public.leads (id, company_id, lead_code, title, client_id, contact_name, contact_phone, source, city, estimated_value, score, stage, owner_employee_id, next_action, next_action_date) VALUES
  ('51111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','LD-0001','Godrej Emerald — Podium Garden','41111111-0000-0000-0000-000000000001','Amit Bhandari','+91 98200 55511','referral','Thane',12500000,86,'qualification','31111111-0000-0000-0000-000000000005','Schedule site survey','2026-09-08'),
  ('51111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','LD-0002','PMC Riverfront Plantation Phase 2','41111111-0000-0000-0000-000000000002','Sunil Kadam','+91 98500 77812','tender','Pune',48000000,74,'site_visit','31111111-0000-0000-0000-000000000005','Collect tender documents','2026-09-07'),
  ('51111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','LD-0003','Kalpataru Sunrise — Terrace Gardens','41111111-0000-0000-0000-000000000005','Sneha Rao','+91 98190 66677','campaign','Mumbai',8600000,61,'new','31111111-0000-0000-0000-000000000004','Introductory call','2026-09-06'),
  ('51111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','LD-0004','Taj Blue Diamond — Courtyard Revamp','41111111-0000-0000-0000-000000000004','Vikram Anand','+91 98600 22133','direct','Pune',3200000,68,'proposal','31111111-0000-0000-0000-000000000005','Send revised proposal','2026-09-09'),
  ('51111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','LD-0005','Infosys Hinjawadi — Biodiversity Park','41111111-0000-0000-0000-000000000003','Rachel Fernandes','+91 99700 44120','existing_client','Pune',21000000,91,'negotiation','31111111-0000-0000-0000-000000000004','Finalise commercial terms','2026-09-05');

-- OPPORTUNITIES
INSERT INTO public.opportunities (id, company_id, opportunity_code, title, client_id, lead_id, value, probability, expected_close_date, competitor, stage, owner_employee_id) VALUES
  ('61111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','OPP-0001','Infosys Biodiversity Park — Design & Build','41111111-0000-0000-0000-000000000003','51111111-0000-0000-0000-000000000005',21000000,75,'2026-10-15','Greenscape India','negotiation','31111111-0000-0000-0000-000000000004'),
  ('61111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','OPP-0002','PMC Riverfront Plantation Phase 2','41111111-0000-0000-0000-000000000002','51111111-0000-0000-0000-000000000002',48000000,40,'2026-11-30','L&T Landscape','proposal','31111111-0000-0000-0000-000000000005'),
  ('61111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','OPP-0003','Taj Blue Diamond Courtyard Revamp','41111111-0000-0000-0000-000000000004','51111111-0000-0000-0000-000000000004',3200000,60,'2026-09-30','Local contractor','proposal','31111111-0000-0000-0000-000000000005');

-- PROJECTS
INSERT INTO public.projects (id, company_id, project_code, name, client_id, project_type, city, state, latitude, longitude, area_sqm, contract_value, budget_cost, actual_cost, committed_cost, billed_amount, collected_amount, progress_percent, health, start_date, end_date, project_manager_id, status) VALUES
  ('71111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','PRJ-0001','Godrej Emerald Podium Landscape','41111111-0000-0000-0000-000000000001','landscape_development','Thane','Maharashtra',19.2183,72.9781,4200,18500000,13200000,9450000,11100000,11000000,8200000,62,'amber','2026-03-01','2026-12-15','31111111-0000-0000-0000-000000000008','in_progress'),
  ('71111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','PRJ-0002','Infosys Hinjawadi Campus Green Belt','41111111-0000-0000-0000-000000000003','landscape_development','Pune','Maharashtra',18.5913,73.7389,15600,32000000,24000000,7600000,12400000,9000000,9000000,31,'green','2026-06-10','2027-03-31','31111111-0000-0000-0000-000000000008','in_progress'),
  ('71111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','PRJ-0003','PMC Riverfront Avenue Plantation Ph-1','41111111-0000-0000-0000-000000000002','plantation','Pune','Maharashtra',18.5204,73.8567,28000,26500000,20300000,19800000,20100000,17000000,10500000,86,'red','2025-11-01','2026-09-30','31111111-0000-0000-0000-000000000009','in_progress'),
  ('71111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','PRJ-0004','Taj Blue Diamond Courtyard AMC','41111111-0000-0000-0000-000000000004','amc','Pune','Maharashtra',18.5362,73.8815,1800,4200000,2900000,1450000,1600000,2100000,2100000,50,'green','2026-04-01','2027-03-31','31111111-0000-0000-0000-000000000010','in_progress'),
  ('71111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','PRJ-0005','Kalpataru Sunrise Terrace Gardens','41111111-0000-0000-0000-000000000005','landscape_development','Mumbai','Maharashtra',19.1136,72.8697,2600,9600000,7100000,320000,900000,0,0,4,'green','2026-08-20','2027-02-28','31111111-0000-0000-0000-000000000008','in_progress');

INSERT INTO public.project_members (project_id, employee_id, role_on_project) VALUES
  ('71111111-0000-0000-0000-000000000001','31111111-0000-0000-0000-000000000008','project_manager'),
  ('71111111-0000-0000-0000-000000000001','31111111-0000-0000-0000-000000000009','site_engineer'),
  ('71111111-0000-0000-0000-000000000001','31111111-0000-0000-0000-000000000010','supervisor'),
  ('71111111-0000-0000-0000-000000000002','31111111-0000-0000-0000-000000000008','project_manager'),
  ('71111111-0000-0000-0000-000000000002','31111111-0000-0000-0000-000000000011','horticulture_lead'),
  ('71111111-0000-0000-0000-000000000003','31111111-0000-0000-0000-000000000009','project_manager'),
  ('71111111-0000-0000-0000-000000000004','31111111-0000-0000-0000-000000000010','supervisor'),
  ('71111111-0000-0000-0000-000000000005','31111111-0000-0000-0000-000000000008','project_manager');

-- APPROVALS
INSERT INTO public.approval_requests (id, company_id, request_code, entity_type, entity_id, entity_label, project_id, amount, summary, state, requested_by, approver_id) VALUES
  ('81111111-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','APR-0001','purchase_order',NULL,'PO for 320 nos. Tabebuia Rosea (100-120mm girth)','71111111-0000-0000-0000-000000000002',2880000,'Vendor: Green Earth Nursery, Pune. Rate ₹9,000/plant, 3% above last approved rate card.','pending_approval','31111111-0000-0000-0000-000000000012','31111111-0000-0000-0000-000000000002'),
  ('81111111-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','APR-0002','boq',NULL,'BOQ v3 — Kalpataru Sunrise Terrace Gardens','71111111-0000-0000-0000-000000000005',7100000,'Revised BOQ after client brief change: added irrigation automation and 2 water bodies.','pending_approval','31111111-0000-0000-0000-000000000006','31111111-0000-0000-0000-000000000004'),
  ('81111111-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','APR-0003','project_variation',NULL,'Variation VO-02 — PMC Riverfront soil replacement','71111111-0000-0000-0000-000000000003',1450000,'Additional 620 cum imported red soil due to unsuitable existing strata.','pending_approval','31111111-0000-0000-0000-000000000009','31111111-0000-0000-0000-000000000001'),
  ('81111111-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','APR-0004','payment',NULL,'Vendor payment — Shree Irrigation Systems','71111111-0000-0000-0000-000000000001',680000,'Running bill 3 against PO-0044. Three-way match cleared.','approved','31111111-0000-0000-0000-000000000014','31111111-0000-0000-0000-000000000002'),
  ('81111111-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','APR-0005','quotation',NULL,'Quotation — Taj Blue Diamond Courtyard Revamp','71111111-0000-0000-0000-000000000004',3200000,'Margin 24.5%, above the 22% floor for hospitality accounts.','submitted','31111111-0000-0000-0000-000000000005','31111111-0000-0000-0000-000000000004');

UPDATE public.approval_requests SET decided_at = now() - interval '2 days', decision_note = 'Match verified. Release payment in this week''s cycle.' WHERE request_code = 'APR-0004';

INSERT INTO public.approval_actions (approval_request_id, from_state, to_state, actor_name, note, created_at) VALUES
  ('81111111-0000-0000-0000-000000000001','draft','submitted','Vivek Bhosale','Submitted after comparative statement of 3 vendors.', now() - interval '3 days'),
  ('81111111-0000-0000-0000-000000000001','submitted','pending_approval','System','Routed to CEO — amount above ₹20,00,000.', now() - interval '3 days'),
  ('81111111-0000-0000-0000-000000000002','draft','submitted','Ananya Iyer','BOQ v3 released for commercial approval.', now() - interval '1 day'),
  ('81111111-0000-0000-0000-000000000002','submitted','pending_approval','System','Routed to Sales Director.', now() - interval '1 day'),
  ('81111111-0000-0000-0000-000000000003','draft','submitted','Imran Shaikh','Soil test report attached.', now() - interval '5 days'),
  ('81111111-0000-0000-0000-000000000003','submitted','pending_approval','System','Routed to Managing Director — client variation.', now() - interval '5 days'),
  ('81111111-0000-0000-0000-000000000004','draft','submitted','Harsh Mehta','Three-way match complete.', now() - interval '4 days'),
  ('81111111-0000-0000-0000-000000000004','submitted','pending_approval','System','Routed to CEO.', now() - interval '4 days'),
  ('81111111-0000-0000-0000-000000000004','pending_approval','approved','Meera Kulkarni','Approved for release.', now() - interval '2 days'),
  ('81111111-0000-0000-0000-000000000005','draft','submitted','Priya Nair','Quotation prepared from BOQ v2.', now() - interval '6 hours');

-- ACTIVITIES
INSERT INTO public.activities (company_id, entity_type, entity_id, activity_type, subject, body, due_date, is_done, employee_id) VALUES
  ('11111111-1111-1111-1111-111111111111','lead','51111111-0000-0000-0000-000000000005','meeting','Commercial review with Infosys facilities','Client requested 6% reduction; countered with extended AMC.', '2026-09-05', false,'31111111-0000-0000-0000-000000000004'),
  ('11111111-1111-1111-1111-111111111111','lead','51111111-0000-0000-0000-000000000001','call','Intro call with Amit Bhandari','Podium garden over basement slab — load calculations needed.', '2026-09-08', false,'31111111-0000-0000-0000-000000000005'),
  ('11111111-1111-1111-1111-111111111111','project','71111111-0000-0000-0000-000000000003','note','Soil strata issue at chainage 1.2 km','Black cotton soil found; variation raised.', NULL, true,'31111111-0000-0000-0000-000000000009'),
  ('11111111-1111-1111-1111-111111111111','project','71111111-0000-0000-0000-000000000001','task','Irrigation pressure testing','Zone 3 and 4 pending.', '2026-09-10', false,'31111111-0000-0000-0000-000000000010'),
  ('11111111-1111-1111-1111-111111111111','project','71111111-0000-0000-0000-000000000002','note','Tree pit marking completed for Block C','1,250 pits marked and approved by client rep.', NULL, true,'31111111-0000-0000-0000-000000000011');

-- NOTIFICATIONS
INSERT INTO public.notifications (company_id, employee_id, title, body, category, severity, link) VALUES
  ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000001','Variation VO-02 awaiting your approval','₹14.5L soil replacement on PMC Riverfront.','approval','warning','/approvals'),
  ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000002','Purchase order above threshold','₹28.8L Tabebuia order needs CEO approval.','approval','warning','/approvals'),
  ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000001','PMC Riverfront margin at risk','Actual cost is 97.5% of budget with 14% work remaining.','risk','critical','/projects'),
  ('11111111-1111-1111-1111-111111111111','31111111-0000-0000-0000-000000000004','Infosys negotiation closing this week','Expected close 15 Oct, probability 75%.','sales','info','/crm/opportunities');

-- PLANT SPECIES
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

-- MATERIALS
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

-- DOCUMENTS
INSERT INTO public.documents (company_id, title, doc_type, entity_type, entity_id, project_id, version, file_name, status) VALUES
  ('11111111-1111-1111-1111-111111111111','Godrej Emerald — Planting Layout Rev C','drawing','project','71111111-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001',3,'GE-PLANT-LAYOUT-RC.pdf','approved'),
  ('11111111-1111-1111-1111-111111111111','Infosys Green Belt — Soil Test Report','report','project','71111111-0000-0000-0000-000000000002','71111111-0000-0000-0000-000000000002',1,'INF-SOIL-TEST.pdf','approved'),
  ('11111111-1111-1111-1111-111111111111','PMC Riverfront — Work Order Ph-1','contract','project','71111111-0000-0000-0000-000000000003','71111111-0000-0000-0000-000000000003',1,'PMC-WO-PH1.pdf','approved'),
  ('11111111-1111-1111-1111-111111111111','Samak Standard Planting Specification 2026','knowledge',NULL,NULL,NULL,2,'SAMAK-PLANTING-SPEC-2026.pdf','approved'),
  ('11111111-1111-1111-1111-111111111111','Taj Blue Diamond — AMC Contract','contract','project','71111111-0000-0000-0000-000000000004','71111111-0000-0000-0000-000000000004',1,'TAJ-AMC-2026.pdf','approved');
