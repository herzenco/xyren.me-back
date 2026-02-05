-- Update the function to use service role key for auth
CREATE OR REPLACE FUNCTION public.notify_zapier_on_lead_insert()
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

  -- Call the zapier-webhook edge function using pg_net
  -- The edge function will use service role auth
  PERFORM net.http_post(
    url := 'https://lyawgllawtjtdtqjnhjy.supabase.co/functions/v1/zapier-webhook',
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
  RAISE WARNING 'Failed to notify Zapier: %', SQLERRM;
  RETURN NEW;
END;
$$;