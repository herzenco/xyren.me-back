-- Drop existing insert policies that might be incomplete
DROP POLICY IF EXISTS "Allow anonymous insert on leads" ON public.leads;
DROP POLICY IF EXISTS "Anonymous users can insert leads" ON public.leads;

-- Create proper anonymous insert policy with TO anon
CREATE POLICY "Allow anonymous insert on leads" 
ON public.leads 
FOR INSERT 
TO anon 
WITH CHECK (true);

-- Ensure the anon role has INSERT permission
GRANT INSERT ON public.leads TO anon;