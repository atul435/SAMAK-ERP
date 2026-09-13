-- A BOQ line's "specification" (e.g. nursery size/girth for a plant, or
-- "18mm HDPE, screwed joints" for a material) is distinct from its
-- description (the name) and its remarks (free notes, e.g. a zone label) --
-- estimators need to record and later edit each independently.
ALTER TABLE public.boq_items
  ADD COLUMN IF NOT EXISTS specification text;
