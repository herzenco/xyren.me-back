-- Create a function to notify Zapier when leads are created
-- This uses pg_net extension to make HTTP calls from Postgres
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send lead to Zapier webhook
CREATE OR REPLACE FUNCTION public.notify_zapier_on_lead_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  webhook_url text;
  internal_secret text;
  supabase_url text;
BEGIN
  -- Skip if email is a placeholder (chatbot handles these separately)
  IF NEW.email LIKE '%@chatbot.temp' THEN
    RETURN NEW;
  END IF;

  -- Get the Supabase URL from environment (we'll call our edge function)
  supabase_url := current_setting('app.settings.supabase_url', true);
  internal_secret := current_setting('app.settings.internal_secret', true);
  
  -- If settings aren't available, try to call the edge function directly
  -- We'll use the edge function approach for better security
  PERFORM net.http_post(
    url := 'https://lyawgllawtjtdtqjnhjy.supabase.co/functions/v1/zapier-webhook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', coalesce(internal_secret, '')
    ),
    body := jsonb_build_object(
      'id', NEW.id,
      'email', NEW.email,
      'full_name', NEW.full_name,
      'phone', NEW.phone,
      'website', NEW.website,
      'industry', NEW.industry,
      'source', NEW.source,
      'lead_score', NEW.lead_score,
      'notes', NEW.notes,
      'qualification_status', NEW.qualification_status,
      'created_at', NEW.created_at
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire on lead insert
DROP TRIGGER IF EXISTS trigger_notify_zapier_on_lead ON public.leads;
CREATE TRIGGER trigger_notify_zapier_on_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_zapier_on_lead_insert();