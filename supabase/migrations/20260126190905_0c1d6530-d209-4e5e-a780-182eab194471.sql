-- Add industry column back to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS industry text;