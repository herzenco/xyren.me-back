const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
      // Top-level fields for easy Zapier mapping
      name: leadData.full_name,
      email: leadData.email,
      
      // Contact info group
      contact: {
        phone: leadData.phone || null,
        website: leadData.website || null,
      },
      
      // Lead qualification group
      qualification: {
        score: leadData.lead_score || 0,
        source: leadData.source || 'unknown',
        industry: leadData.industry || null,
      },
      
      // Metadata group
      metadata: {
        id: leadData.id,
        notes: leadData.notes || null,
        timestamp: new Date().toISOString(),
        created_at: leadData.created_at || new Date().toISOString(),
      },
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
