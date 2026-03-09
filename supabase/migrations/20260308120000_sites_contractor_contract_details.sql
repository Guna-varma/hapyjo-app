-- Add contractor name and contract details per site (Owner sets these with contract rate).
ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS contractor_name text,
  ADD COLUMN IF NOT EXISTS contract_details text;

COMMENT ON COLUMN public.sites.contractor_name IS 'Contractor name for this site (per contract).';
COMMENT ON COLUMN public.sites.contract_details IS 'Contract details / notes for this site.';
