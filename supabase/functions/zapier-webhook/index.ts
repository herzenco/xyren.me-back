import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

async function verifyAuthorization(req: Request): Promise<{ authorized: boolean; error?: string; status?: number }> {
  // Check for internal secret header first (service-to-service calls)
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_SECRET');
  
  if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
    return { authorized: true };
  }

  // Check for JWT auth with admin role
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const token = authHeader.replace('Bearer ', '');
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  
  if (claimsError || !claimsData?.claims) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const userId = claimsData.claims.sub;

  // Check if user has admin role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin');

  if (!roles || roles.length === 0) {
    return { authorized: false, error: 'Forbidden: Admin role required', status: 403 };
  }

  return { authorized: true };
}

interface LeadData {
  id?: string;
  email: string;
  full_name: string;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  source?: string | null;
  lead_score?: number | null;
  notes?: string | null;
  created_at?: string;
  qualification_status?: string | null;
  engagement_depth?: number | null;
  intent_signals?: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authorization
  const auth = await verifyAuthorization(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const leadData: LeadData = await req.json();
    const webhookUrl = Deno.env.get('ZAPIER_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.log('ZAPIER_WEBHOOK_URL not configured, skipping webhook');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No webhook URL configured' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending lead to Zapier:', leadData.email, leadData.full_name);

    const payload = {
      name: leadData.full_name,
      email: leadData.email,
      phone: leadData.phone || null,
      website: leadData.website || null,
      industry: leadData.industry || null,
      source: leadData.source || 'unknown',
      score: leadData.lead_score || 0,
      notes: leadData.notes || null,
      qualification_status: leadData.qualification_status || 'cool',
      created_at: leadData.created_at || new Date().toISOString(),
      id: leadData.id,
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Zapier webhook error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Zapier returned ${response.status}` }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead sent to Zapier successfully:', leadData.email);
    return new Response(
      JSON.stringify({ success: true }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Zapier webhook error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
