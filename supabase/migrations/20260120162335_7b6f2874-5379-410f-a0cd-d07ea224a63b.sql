-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create leads table
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    notes TEXT,
    source TEXT DEFAULT 'hero_modal',
    lead_score INTEGER DEFAULT 0,
    qualification_status TEXT DEFAULT 'cool',
    intent_signals JSONB DEFAULT '{}',
    engagement_depth INTEGER DEFAULT 0,
    industry TEXT
);

-- Create chat_interactions table
CREATE TABLE public.chat_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    session_id TEXT NOT NULL,
    interaction_type TEXT NOT NULL,
    user_message TEXT,
    assistant_message TEXT,
    url_scraped TEXT,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    metadata JSONB
);

-- Create page_sessions table
CREATE TABLE public.page_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    page_path TEXT NOT NULL,
    referrer TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    device_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- Enable Row Level Security on all tables
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads table
-- Anonymous users can insert leads (from marketing site)
CREATE POLICY "Anonymous users can insert leads"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (true);

-- Authenticated admins can view all leads
CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated admins can update leads
CREATE POLICY "Admins can update leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for chat_interactions table
-- Anonymous users can insert chat interactions
CREATE POLICY "Anonymous users can insert chat_interactions"
ON public.chat_interactions
FOR INSERT
TO anon
WITH CHECK (true);

-- Authenticated users (from edge functions) can also insert
CREATE POLICY "Authenticated users can insert chat_interactions"
ON public.chat_interactions
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins can view all chat interactions
CREATE POLICY "Admins can view all chat_interactions"
ON public.chat_interactions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for page_sessions table
-- Anonymous users can insert and update page sessions
CREATE POLICY "Anonymous users can insert page_sessions"
ON public.page_sessions
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Anonymous users can update page_sessions"
ON public.page_sessions
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Admins can view all page sessions
CREATE POLICY "Admins can view all page_sessions"
ON public.page_sessions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles table
-- Only admins can view user roles
CREATE POLICY "Admins can view user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Grant INSERT permissions to anon role for marketing site
GRANT INSERT ON public.leads TO anon;
GRANT INSERT ON public.chat_interactions TO anon;
GRANT INSERT, UPDATE ON public.page_sessions TO anon;

-- Create indexes for better performance
CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_qualification_status ON public.leads(qualification_status);
CREATE INDEX idx_chat_interactions_session_id ON public.chat_interactions(session_id);
CREATE INDEX idx_chat_interactions_lead_id ON public.chat_interactions(lead_id);
CREATE INDEX idx_chat_interactions_created_at ON public.chat_interactions(created_at DESC);
CREATE INDEX idx_page_sessions_session_id ON public.page_sessions(session_id);
CREATE INDEX idx_page_sessions_created_at ON public.page_sessions(created_at DESC);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);