-- Ensure RLS is enabled
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Replace/ensure the public insert policy targets the real connection roles
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
DROP POLICY IF EXISTS "Allow anonymous insert on leads" ON public.leads;

CREATE POLICY "Anyone can submit a lead"
ON public.leads
AS PERMISSIVE
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Ensure the API roles actually have table privileges
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON public.leads TO anon, authenticated;