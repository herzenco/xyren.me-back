-- Allow anonymous users to insert leads (for public forms)
CREATE POLICY "Allow anonymous insert on leads"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (true);

-- Also grant INSERT permission to anon role
GRANT INSERT ON public.leads TO anon;