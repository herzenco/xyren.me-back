-- Add new columns to page_sessions for enhanced analytics
ALTER TABLE public.page_sessions 
ADD COLUMN IF NOT EXISTS utm_source text,
ADD COLUMN IF NOT EXISTS utm_medium text,
ADD COLUMN IF NOT EXISTS utm_campaign text,
ADD COLUMN IF NOT EXISTS utm_term text,
ADD COLUMN IF NOT EXISTS utm_content text,
ADD COLUMN IF NOT EXISTS browser text,
ADD COLUMN IF NOT EXISTS os text,
ADD COLUMN IF NOT EXISTS screen_width integer,
ADD COLUMN IF NOT EXISTS screen_height integer,
ADD COLUMN IF NOT EXISTS viewport_width integer,
ADD COLUMN IF NOT EXISTS viewport_height integer,
ADD COLUMN IF NOT EXISTS max_scroll_depth integer;

-- Create analytics_events table for tracking user interactions
CREATE TABLE public.analytics_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text NOT NULL,
  event_type text NOT NULL,
  event_name text NOT NULL,
  element_id text,
  element_text text,
  page_path text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON public.analytics_events(created_at);
CREATE INDEX idx_page_sessions_started_at ON public.page_sessions(started_at);

-- Enable RLS
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert events (from marketing site)
CREATE POLICY "Anyone can insert analytics events"
ON public.analytics_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Admins can view all events
CREATE POLICY "Admins can view all analytics events"
ON public.analytics_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;

-- Enable realtime for analytics
ALTER PUBLICATION supabase_realtime ADD TABLE public.analytics_events;