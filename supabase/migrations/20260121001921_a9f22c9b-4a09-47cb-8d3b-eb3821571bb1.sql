-- Add unique constraint on email to prevent duplicate leads
ALTER TABLE public.leads
ADD CONSTRAINT leads_email_unique UNIQUE (email);