-- Update the trigger function to use INTERNAL_SECRET header instead of service role
-- The service role key isn't available via current_setting in Cloud
CREATE OR REPLACE FUNCTION public.notify_clickup_on_lead_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  internal_secret text;
BEGIN
  -- Skip if email is a placeholder (chatbot handles these separately)
  IF NEW.email LIKE '%@chatbot.temp' THEN
    RETURN NEW;
  END IF;

  -- Get the internal secret from vault (or use a direct reference)
  -- We'll pass it as a custom header that the edge function checks
  SELECT decrypted_secret INTO internal_secret
  FROM vault.decrypted_secrets
  WHERE name = 'INTERNAL_SECRET'
  LIMIT 1;

  -- Call the clickup-create-task edge function using pg_net
  PERFORM net.http_post(
    url := 'https://lyawgllawtjtdtqjnhjy.supabase.co/functions/v1/clickup-create-task',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', COALESCE(internal_secret, '')
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