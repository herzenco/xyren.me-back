-- Remove the industry column from leads table
ALTER TABLE public.leads DROP COLUMN IF EXISTS industry;