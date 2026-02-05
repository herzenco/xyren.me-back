-- Update the trigger function to call ClickUp instead of Zapier
CREATE OR REPLACE FUNCTION public.notify_clickup_on_lead_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Skip if email is a placeholder (chatbot handles these separately)
  IF NEW.email LIKE '%@chatbot.temp' THEN
    RETURN NEW;
  END IF;

  -- Call the clickup-create-task edge function using pg_net
  PERFORM net.http_post(
    url := 'https://lyawgllawtjtdtqjnhjy.supabase.co/functions/v1/clickup-create-task',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
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
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Failed to notify ClickUp: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Drop the old Zapier trigger and create the new ClickUp trigger
DROP TRIGGER IF EXISTS trigger_notify_zapier_on_lead ON public.leads;
DROP TRIGGER IF EXISTS trigger_notify_clickup_on_lead ON public.leads;

CREATE TRIGGER trigger_notify_clickup_on_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_clickup_on_lead_insert();

-- Optionally drop the old function
DROP FUNCTION IF EXISTS public.notify_zapier_on_lead_insert();