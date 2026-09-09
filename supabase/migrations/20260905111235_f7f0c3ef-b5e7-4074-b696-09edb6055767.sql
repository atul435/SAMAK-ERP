-- 1. Plant lines on the approved Godrej Emerald BOQ
INSERT INTO public.boq_items (id, boq_id, section_id, item_kind, description, species_id, uom, quantity, wastage_percent, unit_rate, remarks, sort_order) VALUES
('d1000000-0000-0000-0000-000000000001','92207442-2844-42b4-8a6f-e88a2eccd2c1','6fae56c9-4ba8-41fe-badb-ae3bf77a1d7e','plant','Alstonia scholaris, 3-3.5 m ht, 100 mm girth','532e658e-7ae9-4ca7-b6fa-5f917eada1a5','nos',24,5,4500,'Avenue planting along podium edge',11),
('d1000000-0000-0000-0000-000000000002','92207442-2844-42b4-8a6f-e88a2eccd2c1','6fae56c9-4ba8-41fe-badb-ae3bf77a1d7e','plant','Azadirachta indica, 450-600 mm','d46648d4-509e-4289-ae57-3c30107f0a9f','nos',180,5,220,'Buffer belt',12),
('d1000000-0000-0000-0000-000000000003','92207442-2844-42b4-8a6f-e88a2eccd2c1','6fae56c9-4ba8-41fe-badb-ae3bf77a1d7e','plant','Bougainvillea glabra, 150-200 mm','dc97df36-7c80-479a-8ac4-eb754a954554','nos',900,8,45,'Mass shrub bed',13),
('d1000000-0000-0000-0000-000000000004','92207442-2844-42b4-8a6f-e88a2eccd2c1','6fae56c9-4ba8-41fe-badb-ae3bf77a1d7e','plant','Ixora coccinea, 300-450 mm','06b240fe-d94f-47b3-9493-90b17d7996b7','nos',450,8,95,'Border hedge',14),
('d1000000-0000-0000-0000-000000000005','92207442-2844-42b4-8a6f-e88a2eccd2c1','6fae56c9-4ba8-41fe-badb-ae3bf77a1d7e','plant','Plumeria obtusa, 1.5-2 m ht','854263dd-8a4b-4645-9b97-60e2a5744d2e','nos',36,5,2600,'Accent groups at seating courts',15),
('d1000000-0000-0000-0000-000000000006','92207442-2844-42b4-8a6f-e88a2eccd2c1','6fae56c9-4ba8-41fe-badb-ae3bf77a1d7e','plant','Zoysia japonica turf, close-laid','57ba2470-ed02-42c7-920d-582bbc200cc4','sqm',1200,5,95,'Central lawn',16),
('d1000000-0000-0000-0000-000000000011','a4bfc4d1-834c-4dcb-9d3c-7e342c884077','3d966215-3c2c-4bb4-9aae-f7371936202c','plant','Tabebuia rosea, 2.5-3 m ht','51b04134-50b0-4635-a36b-de4297d94dde','nos',60,5,5200,'Campus avenue',4),
('d1000000-0000-0000-0000-000000000012','a4bfc4d1-834c-4dcb-9d3c-7e342c884077','3d966215-3c2c-4bb4-9aae-f7371936202c','plant','Nerium oleander, 450-600 mm','c4e39b19-9557-4aa1-bc3f-ada2196247b4','nos',260,8,140,'Green belt screening',5);

-- 2. Nursery batches
CREATE TABLE public.nursery_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  batch_code text NOT NULL,
  species_id uuid NOT NULL REFERENCES public.plant_species(id),
  store_id uuid REFERENCES public.stores(id),
  vendor_id uuid REFERENCES public.vendors(id),
  project_id uuid REFERENCES public.projects(id),
  boq_item_id uuid REFERENCES public.boq_items(id),
  purchase_order_item_id uuid REFERENCES public.purchase_order_items(id),
  plant_size text,
  pot_size text,
  uom text NOT NULL DEFAULT 'nos',
  quantity_received numeric NOT NULL DEFAULT 0,
  quantity_mortality numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  ready_date date,
  health_grade text NOT NULL DEFAULT 'good',
  location text,
  remarks text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  UNIQUE (company_id, batch_code)
);

CREATE TABLE public.plantings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  batch_id uuid NOT NULL REFERENCES public.nursery_batches(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  boq_item_id uuid REFERENCES public.boq_items(id),
  site_report_id uuid REFERENCES public.site_reports(id),
  species_id uuid NOT NULL REFERENCES public.plant_species(id),
  quantity numeric NOT NULL DEFAULT 0,
  planted_on date NOT NULL DEFAULT CURRENT_DATE,
  zone text,
  remarks text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.plant_care_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id uuid NOT NULL REFERENCES public.plant_species(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  frequency_days integer NOT NULL DEFAULT 7,
  season text NOT NULL DEFAULT 'all_year',
  instruction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

CREATE TABLE public.plant_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  project_id uuid REFERENCES public.projects(id),
  batch_id uuid REFERENCES public.nursery_batches(id) ON DELETE CASCADE,
  species_id uuid NOT NULL REFERENCES public.plant_species(id),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  inspected_by uuid REFERENCES public.employees(id),
  sample_size numeric NOT NULL DEFAULT 0,
  healthy_count numeric NOT NULL DEFAULT 0,
  issue text,
  severity text NOT NULL DEFAULT 'low',
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nursery_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plantings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_care_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_health_checks TO authenticated;
GRANT ALL ON public.nursery_batches TO service_role;
GRANT ALL ON public.plantings TO service_role;
GRANT ALL ON public.plant_care_schedules TO service_role;
GRANT ALL ON public.plant_health_checks TO service_role;

ALTER TABLE public.nursery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_care_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plant_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nursery_batches_select" ON public.nursery_batches FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "nursery_batches_write" ON public.nursery_batches FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('plantiq','edit') OR public.is_admin()));
CREATE POLICY "nursery_batches_update" ON public.nursery_batches FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('plantiq','edit') OR public.is_admin()));
CREATE POLICY "nursery_batches_delete" ON public.nursery_batches FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "plantings_select" ON public.plantings FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "plantings_write" ON public.plantings FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "plantings_update" ON public.plantings FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('nursery','edit') OR public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "plantings_delete" ON public.plantings FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "care_schedules_select" ON public.plant_care_schedules FOR SELECT TO authenticated USING (true);
CREATE POLICY "care_schedules_write" ON public.plant_care_schedules FOR ALL TO authenticated USING (public.can('plantiq','edit') OR public.is_admin()) WITH CHECK (public.can('plantiq','edit') OR public.is_admin());

CREATE POLICY "health_checks_select" ON public.plant_health_checks FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "health_checks_write" ON public.plant_health_checks FOR INSERT TO authenticated WITH CHECK (company_id = public.my_company_id() AND (public.can('plantiq','edit') OR public.can('nursery','edit') OR public.can('site_ops','edit') OR public.is_admin()));
CREATE POLICY "health_checks_update" ON public.plant_health_checks FOR UPDATE TO authenticated USING (company_id = public.my_company_id() AND (public.can('plantiq','edit') OR public.can('nursery','edit') OR public.is_admin()));
CREATE POLICY "health_checks_delete" ON public.plant_health_checks FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX idx_nursery_batches_species ON public.nursery_batches(species_id);
CREATE INDEX idx_nursery_batches_project ON public.nursery_batches(project_id);
CREATE INDEX idx_plantings_project ON public.plantings(project_id);
CREATE INDEX idx_plantings_batch ON public.plantings(batch_id);
CREATE INDEX idx_plantings_boq_item ON public.plantings(boq_item_id);
CREATE INDEX idx_health_checks_project ON public.plant_health_checks(project_id);

CREATE TRIGGER trg_touch_nursery_batches BEFORE UPDATE ON public.nursery_batches FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_plantings BEFORE UPDATE ON public.plantings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_care_schedules BEFORE UPDATE ON public.plant_care_schedules FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_health_checks BEFORE UPDATE ON public.plant_health_checks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_nursery_batches AFTER INSERT OR UPDATE OR DELETE ON public.nursery_batches FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_plantings AFTER INSERT OR UPDATE OR DELETE ON public.plantings FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_health_checks AFTER INSERT OR UPDATE OR DELETE ON public.plant_health_checks FOR EACH ROW EXECUTE FUNCTION public.write_audit();

-- 3. Demo data
INSERT INTO public.nursery_batches (id, company_id, batch_code, species_id, store_id, vendor_id, project_id, boq_item_id, plant_size, pot_size, uom, quantity_received, quantity_mortality, unit_cost, received_date, ready_date, health_grade, location, remarks) VALUES
('d2000000-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','NB-2601','532e658e-7ae9-4ca7-b6fa-5f917eada1a5','c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','3-3.5 m ht, 100 mm girth','24 inch bag','nos',26,1,4300,'2026-08-12','2026-08-26','good','Block A rows 1-2','Hardened at Shirur before podium lift'),
('d2000000-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','NB-2602','d46648d4-509e-4289-ae57-3c30107f0a9f','c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000002','450-600 mm','8 inch poly','nos',190,6,205,'2026-08-14','2026-08-24','good','Block B','Buffer belt stock'),
('d2000000-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','NB-2603','dc97df36-7c80-479a-8ac4-eb754a954554','c2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000003','150-200 mm','6 inch poly','nos',950,42,42,'2026-08-18','2026-08-22','fair','Site holding yard','Some sun scorch on arrival, pruned back'),
('d2000000-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','NB-2604','06b240fe-d94f-47b3-9493-90b17d7996b7','c2000000-0000-0000-0000-000000000002','c1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000004','300-450 mm','8 inch poly','nos',470,8,88,'2026-08-20','2026-08-25','good','Site holding yard','Border hedge stock'),
('d2000000-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','NB-2605','854263dd-8a4b-4645-9b97-60e2a5744d2e','c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000005','1.5-2 m ht','18 inch bag','nos',38,0,2450,'2026-08-22','2026-09-05','good','Block C','Accent specimens, holding till courts are ready'),
('d2000000-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','NB-2606','57ba2470-ed02-42c7-920d-582bbc200cc4','c2000000-0000-0000-0000-000000000002',NULL,'71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000006','Roll turf, 25 mm','—','sqm',1260,60,88,'2026-08-28','2026-08-28','fair','Site holding yard','Perishable — lay within 48 hours of delivery'),
('d2000000-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','NB-2607','51b04134-50b0-4635-a36b-de4297d94dde','c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000011','2.5-3 m ht','24 inch bag','nos',64,2,4950,'2026-08-24','2026-09-10','good','Block D','Campus avenue, staged in two lots'),
('d2000000-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','NB-2608','c4e39b19-9557-4aa1-bc3f-ada2196247b4','c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000012','450-600 mm','8 inch poly','nos',280,12,132,'2026-08-26','2026-09-02','good','Block D','Screening hedge'),
('d2000000-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','NB-2609','8f5cf7f1-0db0-4a29-b90d-73ff350a4e02','c2000000-0000-0000-0000-000000000003','c1000000-0000-0000-0000-000000000001',NULL,NULL,'600-750 mm','10 inch poly','nos',150,4,240,'2026-08-30','2026-09-12','good','Block E','Unallocated general stock'),
('d2000000-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','NB-2610','31af577f-972e-4e0f-8131-f20d92f0600d','c2000000-0000-0000-0000-000000000003',NULL,'71111111-0000-0000-0000-000000000003',NULL,'Sod mats','—','sqm',800,25,62,'2026-09-01','2026-09-01','good','Grass beds','Riverfront verge grassing');

INSERT INTO public.plantings (company_id, batch_id, project_id, boq_item_id, site_report_id, species_id, quantity, planted_on, zone, remarks) VALUES
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001',NULL,'532e658e-7ae9-4ca7-b6fa-5f917eada1a5',12,'2026-08-28','Podium edge north','Pits pre-charged with compost'),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000001','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001',NULL,'532e658e-7ae9-4ca7-b6fa-5f917eada1a5',8,'2026-09-02','Podium edge east','Staked against monsoon wind'),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000002','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000002',NULL,'d46648d4-509e-4289-ae57-3c30107f0a9f',120,'2026-08-30','Buffer belt west',NULL),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000003','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000003','cca214de-5cff-4592-8d2a-07641944da0a','dc97df36-7c80-479a-8ac4-eb754a954554',620,'2026-09-05','Shrub bed A & B','Laid 450 mm centres'),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000004','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000004','cca214de-5cff-4592-8d2a-07641944da0a','06b240fe-d94f-47b3-9493-90b17d7996b7',310,'2026-09-05','Border hedge loop',NULL),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000006','71111111-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000006',NULL,'57ba2470-ed02-42c7-920d-582bbc200cc4',780,'2026-08-29','Central lawn','Rolled and watered same day'),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000007','71111111-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000011','c50976f1-c0a1-4d57-a94a-ff6c19a24d5b','51b04134-50b0-4635-a36b-de4297d94dde',26,'2026-09-05','Avenue phase 1',NULL),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000008','71111111-0000-0000-0000-000000000002','d1000000-0000-0000-0000-000000000012',NULL,'c4e39b19-9557-4aa1-bc3f-ada2196247b4',150,'2026-09-03','Green belt south',NULL),
('11111111-1111-1111-1111-111111111111','d2000000-0000-0000-0000-000000000010','71111111-0000-0000-0000-000000000003',NULL,'cbfeeab3-9808-440b-87b0-7dac85f5a220','31af577f-972e-4e0f-8131-f20d92f0600d',420,'2026-09-05','Riverfront verge ch. 0-400','Grass mats on prepared verge');

INSERT INTO public.plant_care_schedules (species_id, task_type, frequency_days, season, instruction) VALUES
('532e658e-7ae9-4ca7-b6fa-5f917eada1a5','watering',3,'summer','40 litres per tree via basin, early morning'),
('532e658e-7ae9-4ca7-b6fa-5f917eada1a5','feeding',90,'all_year','2 kg FYM plus 200 g NPK 19:19:19 per tree'),
('532e658e-7ae9-4ca7-b6fa-5f917eada1a5','pruning',180,'winter','Clear crossing branches, maintain single leader'),
('d46648d4-509e-4289-ae57-3c30107f0a9f','watering',4,'summer','15 litres per plant, reduce to weekly in monsoon'),
('d46648d4-509e-4289-ae57-3c30107f0a9f','pest_watch',15,'all_year','Check for tea mosquito bug and leaf webber'),
('dc97df36-7c80-479a-8ac4-eb754a954554','watering',2,'summer','Light daily spray until established, then alternate days'),
('dc97df36-7c80-479a-8ac4-eb754a954554','pruning',45,'all_year','Hard trim after each flush to hold bract density'),
('06b240fe-d94f-47b3-9493-90b17d7996b7','watering',2,'summer','Keep root zone moist, avoid waterlogging'),
('06b240fe-d94f-47b3-9493-90b17d7996b7','feeding',60,'all_year','Micronutrient spray, iron chelate for chlorosis'),
('854263dd-8a4b-4645-9b97-60e2a5744d2e','watering',7,'all_year','Deep soak weekly, withhold in heavy monsoon'),
('854263dd-8a4b-4645-9b97-60e2a5744d2e','pest_watch',21,'monsoon','Watch for frangipani rust on leaf underside'),
('57ba2470-ed02-42c7-920d-582bbc200cc4','watering',1,'summer','8 mm irrigation daily for first 21 days'),
('57ba2470-ed02-42c7-920d-582bbc200cc4','mowing',10,'all_year','Mow at 25 mm, never remove more than a third'),
('57ba2470-ed02-42c7-920d-582bbc200cc4','feeding',45,'all_year','Urea 20 g per sqm after mowing, water in'),
('51b04134-50b0-4635-a36b-de4297d94dde','watering',3,'summer','30 litres per tree in basin'),
('51b04134-50b0-4635-a36b-de4297d94dde','staking',90,'all_year','Check ties and stakes, loosen as girth grows'),
('c4e39b19-9557-4aa1-bc3f-ada2196247b4','pruning',60,'all_year','Shear to 600 mm hedge line'),
('31af577f-972e-4e0f-8131-f20d92f0600d','mowing',12,'all_year','Mow at 30 mm on verge sections'),
('8f5cf7f1-0db0-4a29-b90d-73ff350a4e02','pest_watch',20,'all_year','Scale and mealy bug inspection on stems'),
('91396814-db4f-43f1-9f6f-95066fd547e0','watering',1,'all_year','Keep pot standing in 50 mm water');

INSERT INTO public.plant_health_checks (company_id, project_id, batch_id, species_id, check_date, inspected_by, sample_size, healthy_count, issue, severity, action_taken) VALUES
('11111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000001','532e658e-7ae9-4ca7-b6fa-5f917eada1a5','2026-08-29','31111111-0000-0000-0000-000000000011',20,20,NULL,'low','Basins recharged, ties checked'),
('11111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000003','dc97df36-7c80-479a-8ac4-eb754a954554','2026-08-30','31111111-0000-0000-0000-000000000011',100,86,'Sun scorch on young foliage after transport','medium','Shade net for 5 days, morning misting'),
('11111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000001','d2000000-0000-0000-0000-000000000006','57ba2470-ed02-42c7-920d-582bbc200cc4','2026-09-01','31111111-0000-0000-0000-000000000010',200,182,'Patchy yellowing on lawn edge near paving','medium','Increased edge irrigation run by 4 minutes'),
('11111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000002','d2000000-0000-0000-0000-000000000007','51b04134-50b0-4635-a36b-de4297d94dde','2026-09-02','31111111-0000-0000-0000-000000000011',30,29,'One specimen with root-ball crack','low','Replaced from holding nursery'),
('11111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000002','d2000000-0000-0000-0000-000000000008','c4e39b19-9557-4aa1-bc3f-ada2196247b4','2026-09-04','31111111-0000-0000-0000-000000000009',60,52,'Mealy bug clusters on new shoots','high','Neem oil spray, repeat after 7 days'),
('11111111-1111-1111-1111-111111111111','71111111-0000-0000-0000-000000000003','d2000000-0000-0000-0000-000000000010','31af577f-972e-4e0f-8131-f20d92f0600d','2026-09-05','31111111-0000-0000-0000-000000000010',150,138,'Mat edges drying at chainage 250-300','medium','Extra hand watering twice daily for a week');