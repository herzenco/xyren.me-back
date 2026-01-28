-- Add questionnaire_answers column to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS questionnaire_answers jsonb DEFAULT NULL;