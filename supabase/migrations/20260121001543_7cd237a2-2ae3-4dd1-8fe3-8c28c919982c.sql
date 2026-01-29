-- Create leads automatically when an email is captured in chat_interactions

CREATE OR REPLACE FUNCTION public.create_lead_from_chat_interaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  extracted_email text;
  existing_lead_id uuid;
  inferred_name text;
  inferred_website_raw text;
  inferred_website text;
BEGIN
  -- Only act on rows that contain a user message
  IF NEW.user_message IS NULL OR NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Extract email from the message
  SELECT lower((regexp_matches(NEW.user_message, '([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})'))[1])
    INTO extracted_email;

  IF extracted_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- If lead already exists for this email, nothing to do
  SELECT id
    INTO existing_lead_id
  FROM public.leads
  WHERE email = extracted_email
  LIMIT 1;

  IF existing_lead_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Infer name from earliest short capitalized user message in the same session
  SELECT ci.user_message
    INTO inferred_name
  FROM public.chat_interactions ci
  WHERE ci.session_id = NEW.session_id
    AND ci.user_message IS NOT NULL
    AND char_length(ci.user_message) < 50
    AND array_length(string_to_array(trim(ci.user_message), ' '), 1) <= 4
    AND ci.user_message ~ '^[A-Z][a-z]'
    AND ci.user_message !~* '@'
    AND ci.user_message !~* '\.com'
  ORDER BY ci.created_at ASC
  LIMIT 1;

  IF inferred_name IS NULL THEN
    inferred_name := 'Unknown';
  END IF;

  -- Infer website from earliest URL-like message in the same session
  SELECT (regexp_matches(ci.user_message, '((?:https?://)?(?:www\.)?[A-Za-z0-9-]+\.[A-Za-z]{2,}(?:\.[A-Za-z]{2,})?)', 'i'))[1]
    INTO inferred_website_raw
  FROM public.chat_interactions ci
  WHERE ci.session_id = NEW.session_id
    AND ci.user_message IS NOT NULL
    AND ci.user_message ~* '(https?://)?(www\.)?[A-Za-z0-9-]+\.[A-Za-z]{2,}'
  ORDER BY ci.created_at ASC
  LIMIT 1;

  IF inferred_website_raw IS NULL THEN
    inferred_website := NULL;
  ELSIF inferred_website_raw ~* '^https?://' THEN
    inferred_website := inferred_website_raw;
  ELSE
    inferred_website := 'https://' || inferred_website_raw;
  END IF;

  -- Create the lead
  INSERT INTO public.leads (email, full_name, website, source, lead_score)
  VALUES (
    extracted_email,
    inferred_name,
    inferred_website,
    'chatbot',
    CASE WHEN inferred_website IS NULL THEN 30 ELSE 50 END
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_lead_from_chat_interaction ON public.chat_interactions;
CREATE TRIGGER trg_create_lead_from_chat_interaction
AFTER INSERT ON public.chat_interactions
FOR EACH ROW
EXECUTE FUNCTION public.create_lead_from_chat_interaction();

-- One-time backfill: create leads from already recorded chat_interactions (if any)
WITH email_rows AS (
  SELECT
    session_id,
    lower((regexp_matches(user_message, '([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})'))[1]) AS email,
    created_at
  FROM public.chat_interactions
  WHERE user_message ~* '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
),
session_email AS (
  SELECT DISTINCT ON (session_id)
    session_id,
    email
  FROM email_rows
  ORDER BY session_id, created_at ASC
),
session_name AS (
  SELECT DISTINCT ON (session_id)
    session_id,
    user_message AS full_name
  FROM public.chat_interactions
  WHERE user_message IS NOT NULL
    AND char_length(user_message) < 50
    AND array_length(string_to_array(trim(user_message), ' '), 1) <= 4
    AND user_message ~ '^[A-Z][a-z]'
    AND user_message !~* '@'
    AND user_message !~* '\.com'
  ORDER BY session_id, created_at ASC
),
session_website AS (
  SELECT DISTINCT ON (session_id)
    session_id,
    (regexp_matches(user_message, '((?:https?://)?(?:www\.)?[A-Za-z0-9-]+\.[A-Za-z]{2,}(?:\.[A-Za-z]{2,})?)', 'i'))[1] AS website_raw
  FROM public.chat_interactions
  WHERE user_message ~* '(https?://)?(www\.)?[A-Za-z0-9-]+\.[A-Za-z]{2,}'
  ORDER BY session_id, created_at ASC
),
candidate AS (
  SELECT
    se.email,
    COALESCE(sn.full_name, 'Unknown') AS full_name,
    CASE
      WHEN sw.website_raw IS NULL THEN NULL
      WHEN sw.website_raw ~* '^https?://' THEN sw.website_raw
      ELSE 'https://' || sw.website_raw
    END AS website
  FROM session_email se
  LEFT JOIN session_name sn USING (session_id)
  LEFT JOIN session_website sw USING (session_id)
)
INSERT INTO public.leads (email, full_name, website, source, lead_score)
SELECT
  c.email,
  c.full_name,
  c.website,
  'chatbot',
  CASE WHEN c.website IS NULL THEN 30 ELSE 50 END
FROM candidate c
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads l WHERE l.email = c.email
);
