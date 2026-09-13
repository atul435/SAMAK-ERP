-- Per-item GST: plants and hardscape materials genuinely carry different GST
-- rates in India (live plants are frequently 0%/5% under HSN 0602; stone,
-- cement and other hardscape materials are typically 18%/28%). A BOQ that
-- mixes both was previously taxed at one blanket rate (boqs.tax_percent),
-- which misstates the true tax on a mixed quotation. Each catalogue item and
-- each BOQ line now carries its own GST rate; boqs.tax_percent becomes the
-- fallback used only when a line has no rate of its own (old rows, or an
-- item added without one), so existing BOQs are unaffected.

ALTER TABLE public.plant_species
  ADD COLUMN IF NOT EXISTS gst_percent numeric,
  ADD COLUMN IF NOT EXISTS hsn_code text;

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS gst_percent numeric;

ALTER TABLE public.boq_items
  ADD COLUMN IF NOT EXISTS gst_percent numeric;
