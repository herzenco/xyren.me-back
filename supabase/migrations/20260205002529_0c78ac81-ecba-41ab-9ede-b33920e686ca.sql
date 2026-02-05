-- Make ClickUp syncing idempotent and allow DB trigger calls without relying on service_role current_setting

-- 1) Track ClickUp sync status on leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS clickup_task_id text,
  ADD COLUMN IF NOT EXISTS clickup_task_url text,
  ADD COLUMN IF NOT EXISTS clickup_synced_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_leads_clickup_task_id
  ON public.leads (clickup_task_id);

-- 2) Update trigger function: call clickup-create-task with only the lead id
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

  PERFORM net.http_post(
    url := 'https://lyawgllawtjtdtqjnhjy.supabase.co/functions/v1/clickup-create-task',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'id', NEW.id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the insert
  RAISE WARNING 'Failed to notify ClickUp: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_notify_clickup_on_lead ON public.leads;
CREATE TRIGGER trigger_notify_clickup_on_lead
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_clickup_on_lead_insert();
