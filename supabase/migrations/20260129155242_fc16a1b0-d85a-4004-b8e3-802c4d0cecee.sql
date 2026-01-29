-- Add archived column to leads table
ALTER TABLE public.leads 
ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Allow admins to delete leads
CREATE POLICY "Admins can delete leads" 
ON public.leads 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));