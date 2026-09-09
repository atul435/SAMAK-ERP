ALTER TABLE public.vendor_bills
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid;
ALTER TABLE public.vendor_receipts
  ADD COLUMN created_by uuid,
  ADD COLUMN updated_by uuid;