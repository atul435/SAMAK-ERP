-- Import Samak's Landscape Labour & Logistics Cost Master workbook:
-- man-hour productivity per plant/work-type activity, planting-pit/bed
-- excavation norms, vehicle payload/transport rates, and the editable
-- wage/overhead/profit/GST assumptions that turn all of the above into a
-- landscape installation cost. This is the missing "installation cost"
-- half of BOQ plant/material pricing (materials.standard_rate and
-- plant_species.indicative_buy_price already cover the buy side).
--
-- All four tables are reference data, editable later like plant_species
-- and materials -- per the user's explicit intent ("all productivity
-- factors are editable... start recording actual labour hours... this can
-- become a proprietary dataset"). cost_input_rates is company-scoped
-- (wages/margins are Samak's own); the other three are shared reference
-- benchmarks, matching how plant_species/materials are shared today.

CREATE TABLE public.labour_productivity_norms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_code text NOT NULL UNIQUE,
  work_type text NOT NULL,
  size_spec text,
  uom text NOT NULL,
  typical_weight_kg numeric,
  pit_bed text,
  loading_mh numeric,
  unloading_mh numeric,
  internal_shift_mh numeric,
  pit_bed_prep_mh numeric,
  plant_backfill_mh numeric,
  stake_tie_mh numeric,
  water_cleanup_mh numeric,
  direct_mh_per_unit numeric NOT NULL,
  supervisor_mh_per_unit numeric NOT NULL,
  machine_type text,
  machine_hr_per_unit numeric,
  suggested_vehicle text,
  units_per_day_2person_crew numeric,
  confidence text,
  basis_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.pit_bed_norms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  application text NOT NULL,
  dimension text,
  excavation_m3 numeric,
  starter_mh numeric,
  machine_hr numeric,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vehicle_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle text NOT NULL UNIQUE,
  payload_kg numeric NOT NULL,
  volume_m3 numeric,
  base_rate_per_trip numeric NOT NULL,
  rate_per_km numeric NOT NULL,
  minimum_rate numeric NOT NULL,
  use_case text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cost_input_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  value numeric NOT NULL,
  unit text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.labour_productivity_norms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pit_bed_norms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicle_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_input_rates TO authenticated;
GRANT ALL ON public.labour_productivity_norms TO service_role;
GRANT ALL ON public.pit_bed_norms TO service_role;
GRANT ALL ON public.vehicle_rates TO service_role;
GRANT ALL ON public.cost_input_rates TO service_role;

ALTER TABLE public.labour_productivity_norms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pit_bed_norms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_input_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read productivity norms" ON public.labour_productivity_norms FOR SELECT TO authenticated USING (true);
CREATE POLICY "write productivity norms" ON public.labour_productivity_norms FOR ALL TO authenticated USING (public.can('boq','edit') OR public.is_admin()) WITH CHECK (public.can('boq','edit') OR public.is_admin());

CREATE POLICY "read pit bed norms" ON public.pit_bed_norms FOR SELECT TO authenticated USING (true);
CREATE POLICY "write pit bed norms" ON public.pit_bed_norms FOR ALL TO authenticated USING (public.can('boq','edit') OR public.is_admin()) WITH CHECK (public.can('boq','edit') OR public.is_admin());

CREATE POLICY "read vehicle rates" ON public.vehicle_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "write vehicle rates" ON public.vehicle_rates FOR ALL TO authenticated USING (public.can('boq','edit') OR public.is_admin()) WITH CHECK (public.can('boq','edit') OR public.is_admin());

CREATE POLICY "read cost input rates" ON public.cost_input_rates FOR SELECT TO authenticated USING (company_id = public.my_company_id());
CREATE POLICY "write cost input rates" ON public.cost_input_rates FOR ALL TO authenticated USING (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin())) WITH CHECK (company_id = public.my_company_id() AND (public.can('boq','edit') OR public.is_admin()));

CREATE TRIGGER trg_touch_labour_productivity_norms BEFORE UPDATE ON public.labour_productivity_norms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_pit_bed_norms BEFORE UPDATE ON public.pit_bed_norms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_touch_vehicle_rates BEFORE UPDATE ON public.vehicle_rates FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_audit_labour_productivity_norms AFTER INSERT OR UPDATE OR DELETE ON public.labour_productivity_norms FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_pit_bed_norms AFTER INSERT OR UPDATE OR DELETE ON public.pit_bed_norms FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_vehicle_rates AFTER INSERT OR UPDATE OR DELETE ON public.vehicle_rates FOR EACH ROW EXECUTE FUNCTION public.write_audit();
CREATE TRIGGER trg_audit_cost_input_rates AFTER INSERT OR UPDATE OR DELETE ON public.cost_input_rates FOR EACH ROW EXECUTE FUNCTION public.write_audit();

INSERT INTO public.labour_productivity_norms
  (activity_code, work_type, size_spec, uom, typical_weight_kg, pit_bed, loading_mh, unloading_mh, internal_shift_mh, pit_bed_prep_mh, plant_backfill_mh, stake_tie_mh, water_cleanup_mh, direct_mh_per_unit, supervisor_mh_per_unit, machine_type, machine_hr_per_unit, suggested_vehicle, units_per_day_2person_crew, confidence, basis_notes)
VALUES
('GC-PLUG','Groundcover / plug','Plug / 4-6 inch','No.',0.5,'Prepared bed',0.01,0.01,0.01,0.03,0.06,0.0,0.02,0.14,0.005,'None',0.0,'Tata Ace / mini truck',114.285714,'Medium','Prepared bed; starter norm'),
('GC-1L','Groundcover / perennial','1-2 L','No.',1.5,'150-200 mm',0.015,0.015,0.02,0.05,0.08,0.0,0.02,0.2,0.008,'None',0.0,'Tata Ace / mini truck',80.0,'Medium','Mass planting'),
('SHR-3L','Shrub - small','3-5 L / 300-450 mm','No.',4.0,'300-450 mm',0.03,0.03,0.04,0.1,0.18,0.0,0.05,0.43,0.015,'None',0.0,'Tata Ace / mini truck',37.209302,'High','Anchored to 0.5 MH small-container shrub benchmark'),
('SHR-10L','Shrub - medium','10-15 L / 450-750 mm','No.',12.0,'450 mm',0.05,0.05,0.08,0.18,0.3,0.02,0.07,0.75,0.025,'None',0.0,'Pickup / 1.5T',21.333333,'Medium','Starter norm'),
('SHR-25L','Shrub - large','20-35 L / 0.75-1.2 m','No.',25.0,'450-600 mm',0.08,0.08,0.12,0.28,0.45,0.05,0.1,1.16,0.04,'None',0.0,'Pickup / 1.5T',13.793103,'Medium','2-person handling'),
('HEDGE','Hedge plant','3-10 L','No.',6.0,'Prepared trench',0.025,0.025,0.03,0.08,0.16,0.0,0.04,0.36,0.01,'None',0.0,'Tata Ace / mini truck',44.444444,'Medium','Excludes major trench prep if separate'),
('CLIMBER','Climber','3-10 L','No.',6.0,'300-450 mm',0.025,0.025,0.03,0.08,0.15,0.05,0.04,0.4,0.012,'None',0.0,'Tata Ace / mini truck',40.0,'Medium','Basic tie included'),
('GRASS','Ornamental grass/perennial','3-5 L','No.',4.0,'Prepared bed',0.02,0.02,0.02,0.05,0.1,0.0,0.03,0.24,0.008,'None',0.0,'Tata Ace / mini truck',66.666667,'Medium','Prepared bed'),
('BAM-S','Bamboo - small','10-20 L','No.',18.0,'450-600 mm',0.05,0.05,0.08,0.18,0.3,0.03,0.07,0.76,0.025,'None',0.0,'Pickup / 1.5T',21.052632,'Medium','Clumping bamboo'),
('BAM-L','Bamboo - large','40-80 L','No.',60.0,'600-900 mm',0.1,0.1,0.18,0.4,0.65,0.1,0.12,1.65,0.06,'Mini excavator/JCB',0.1,'3T truck',9.69697,'Medium','Mechanical help'),
('TOP-S','Topiary - small','0.6-1.2 m / 20-40 L','No.',30.0,'450-600 mm',0.1,0.1,0.15,0.25,0.45,0.08,0.1,1.23,0.05,'None',0.0,'Pickup / 1.5T',13.00813,'Medium','Careful handling'),
('TOP-L','Topiary - large','1.5-2.5 m / 80-200 L','No.',120.0,'600-900 mm',0.2,0.2,0.3,0.5,0.85,0.18,0.15,2.38,0.1,'Crane / Hydra small',0.15,'7T truck',6.722689,'Medium','Fragile form'),
('CYCAD','Cycad / specimen shrub','40-80 L','No.',55.0,'600 mm',0.1,0.1,0.15,0.3,0.5,0.06,0.1,1.31,0.05,'None',0.0,'3T truck',12.21374,'Medium','Protect crown'),
('TREE-S','Tree - small','1.5-2.5 m / 20-40 L','No.',35.0,'600 mm',0.1,0.1,0.15,0.4,0.65,0.2,0.12,1.72,0.08,'None',0.0,'Pickup / 1.5T',9.302326,'High','CPWD 60 cm pit + benchmark scaling'),
('TREE-M','Tree - medium','2.5-3.5 m / 50-100 L','No.',90.0,'900 mm',0.18,0.18,0.25,0.75,1.0,0.3,0.18,2.84,0.15,'Mini excavator/JCB',0.15,'3T truck',5.633803,'Medium','CPWD 90 cm pit + scaling'),
('TREE-L','Tree - large','3.5-5 m / 100-250 L','No.',220.0,'1.2 m',0.35,0.35,0.5,1.2,1.8,0.5,0.25,4.95,0.25,'Crane / Hydra small',0.35,'7T truck',3.232323,'Medium','CPWD 1.2 m pit + scaling'),
('TREE-XL','Tree - specimen / XL','>5 m / >250 L','No.',600.0,'1.2 m+ engineered',0.75,0.75,1.0,2.0,3.5,0.75,0.4,9.15,0.5,'Crane / Hydra large',0.75,'14T truck',1.748634,'Low','Project-specific lifting method'),
('PALM-S','Palm - small','1-2 m OA / 30-60 L','No.',50.0,'600 mm',0.1,0.1,0.15,0.35,0.55,0.15,0.1,1.5,0.06,'None',0.0,'Pickup / 1.5T',10.666667,'Medium','Protect growing point'),
('PALM-M','Palm - medium','2-4 m OA / rootball','No.',180.0,'900 mm',0.3,0.3,0.4,0.8,1.3,0.35,0.2,3.65,0.2,'Crane / Hydra small',0.25,'7T truck',4.383562,'Medium','Machine placement typical'),
('PALM-L','Palm - large','4-7 m OA / rootball','No.',500.0,'1.2 m+',0.6,0.6,0.8,1.5,2.6,0.6,0.35,7.05,0.4,'Crane / Hydra large',0.6,'14T truck',2.269504,'Low','Rigging/stabilization'),
('TURF','Turf laying','Sod/carpet turf','m²',0.0,'Prepared bed',0.0,0.0,0.01,0.03,0.04,0.0,0.02,0.1,0.003,'None',0.0,'3T truck',160.0,'Medium','MH per m²');

INSERT INTO public.pit_bed_norms (code, application, dimension, excavation_m3, starter_mh, machine_hr, reference)
VALUES
('P45','Small shrub/hedge','0.45 m cube',0.091,0.25,0.0,'CPWD 45 cm standard hole'),
('P60','Small tree/large shrub','0.60 m cube',0.216,0.55,0.0,'CPWD 60 cm standard hole'),
('P90','Medium tree/palm','0.90 m cube',0.729,1.1,0.12,'CPWD 90 cm standard hole'),
('P120','Large tree/palm','1.20 m cube',1.728,2.2,0.3,'CPWD 1.2 m standard hole'),
('BED-S','Shrub/groundcover bed','per m² @ 300 mm',0.3,0.2,0.0,'Starter norm'),
('TRENCH','Hedge trench','per RM @ 450x450',0.203,0.3,0.0,'Starter norm');

INSERT INTO public.vehicle_rates (vehicle, payload_kg, volume_m3, base_rate_per_trip, rate_per_km, minimum_rate, use_case)
VALUES
('Tata Ace / mini truck',700.0,4.0,1500.0,24.0,1500.0,'Small shrubs, groundcovers'),
('Pickup / 1.5T',1500.0,7.0,2200.0,30.0,2200.0,'Shrubs, small trees'),
('3T truck',3000.0,14.0,3500.0,40.0,3500.0,'Mixed landscape loads'),
('7T truck',7000.0,28.0,5500.0,55.0,5500.0,'Trees/palms'),
('14T truck',14000.0,45.0,8500.0,75.0,8500.0,'Large trees/palms'),
('Low-bed / special carrier',18000.0,60.0,15000.0,100.0,15000.0,'Specimen material');

INSERT INTO public.cost_input_rates (company_id, key, label, value, unit, notes)
SELECT (SELECT id FROM public.companies ORDER BY created_at LIMIT 1), v.key, v.label, v.value, v.unit, v.notes
FROM (VALUES
('working_hours_per_day','Working hours/day',8.0,'hr/day','Editable'),
('general_labour_wage','General labour wage',900.0,'₹/day','Replace with current site wage'),
('skilled_gardener_wage','Skilled gardener/mali wage',1100.0,'₹/day','Editable'),
('supervisor_wage','Supervisor wage',1800.0,'₹/day','Editable'),
('equipment_operator_wage','Equipment operator wage',1400.0,'₹/day','Editable'),
('loading_labour_wage','Loading labour wage',900.0,'₹/day','Editable'),
('unloading_labour_wage','Unloading labour wage',900.0,'₹/day','Editable'),
('water_tanker_rate','Water tanker',2500.0,'₹/day','Editable'),
('jcb_rate','Mini excavator/JCB',9000.0,'₹/day','Editable'),
('crane_small_rate','Crane / Hydra small',12000.0,'₹/day','Editable'),
('crane_large_rate','Crane / Hydra large',20000.0,'₹/day','Editable'),
('tools_ppe_percent','Small tools / PPE',3.0,'% labour','Consumables'),
('overhead_percent','Contractor overhead',10.0,'% direct cost','Editable'),
('profit_percent','Profit',10.0,'% cost incl OH','Editable'),
('gst_percent','GST',18.0,'%','Optional'),
('default_transport_distance_km','Default one-way transport distance',30.0,'km','Editable'),
('loading_waiting_hr','Loading waiting time/trip',0.5,'hr/trip','Crew time'),
('unloading_waiting_hr','Unloading waiting time/trip',0.75,'hr/trip','Crew time'),
('traffic_factor','Traffic factor',1.0,'x','1 normal; >1 congestion'),
('site_access_factor','Site access factor',1.0,'x','1 normal; 1.15 constrained; 1.30 severe')
) AS v(key, label, value, unit, notes);
