import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleLeadFormData {
  lead_id?: string;
  user_column_data?: Array<{
    column_id: string;
    string_value?: string;
    column_name?: string;
  }>;
  campaign_id?: string;
  gclid?: string;
  api_version?: string;
  form_id?: string;
  google_key?: string;
  is_test?: boolean;
  gcl_id?: string;
  adgroup_id?: string;
  creative_id?: string;
}

function extractField(data: GoogleLeadFormData, ...fieldNames: string[]): string | null {
  if (!data.user_column_data) return null;
  
  for (const field of data.user_column_data) {
    const columnName = (field.column_name || field.column_id || '').toLowerCase();
    for (const name of fieldNames) {
      if (columnName.includes(name.toLowerCase())) {
        return field.string_value || null;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify secret key from query parameter or header
    const url = new URL(req.url);
    const secretFromQuery = url.searchParams.get('key') || url.searchParams.get('google_key');
    const secretFromHeader = req.headers.get('x-webhook-secret');
    const providedSecret = secretFromQuery || secretFromHeader;
    
    const expectedSecret = Deno.env.get('GOOGLE_WEBHOOK_SECRET');
    
    if (!expectedSecret) {
      console.error('GOOGLE_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (providedSecret !== expectedSecret) {
      console.error('Invalid or missing webhook secret');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Parse the incoming data
    let leadData: GoogleLeadFormData;
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      leadData = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      // Convert form data to object
      const obj: Record<string, unknown> = {};
      formData.forEach((value, key) => {
        try {
          obj[key] = JSON.parse(value as string);
        } catch {
          obj[key] = value;
        }
      });
      leadData = obj as unknown as GoogleLeadFormData;
    } else {
      // Try to parse as JSON anyway
      const text = await req.text();
      try {
        leadData = JSON.parse(text);
      } catch {
        console.error('Failed to parse request body:', text.substring(0, 500));
        return new Response(
          JSON.stringify({ error: 'Invalid request format' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Received Google Lead Form data:', JSON.stringify(leadData, null, 2));

    // Extract fields from Google's format
    const email = extractField(leadData, 'email', 'e-mail', 'email_address');
    const fullName = extractField(leadData, 'full_name', 'name', 'first_name', 'full name') 
      || extractField(leadData, 'first_name', 'first name');
    const lastName = extractField(leadData, 'last_name', 'last name', 'surname');
    const phone = extractField(leadData, 'phone', 'phone_number', 'telephone', 'mobile');
    const company = extractField(leadData, 'company', 'company_name', 'business', 'organization');

    // Build the full name
    let name = fullName || 'Unknown';
    if (lastName && fullName && !fullName.includes(lastName)) {
      name = `${fullName} ${lastName}`;
    }

    // Validate required fields
    if (!email) {
      console.error('No email found in lead data');
      return new Response(
        JSON.stringify({ error: 'Email is required', received: leadData }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing lead by email
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingLead) {
      console.log('Lead already exists:', email);
      return new Response(
        JSON.stringify({ success: true, message: 'Lead already exists', leadId: existingLead.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build notes with metadata
    const notesParts = [];
    if (leadData.campaign_id) notesParts.push(`Campaign: ${leadData.campaign_id}`);
    if (leadData.form_id) notesParts.push(`Form: ${leadData.form_id}`);
    if (leadData.gclid || leadData.gcl_id) notesParts.push(`GCLID: ${leadData.gclid || leadData.gcl_id}`);
    if (leadData.is_test) notesParts.push('⚠️ TEST LEAD');

    // Insert the lead
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        email: email.toLowerCase(),
        full_name: name,
        phone: phone,
        industry: company,
        source: 'google_lead_form',
        lead_score: 60, // Higher score since they came from ads
        notes: notesParts.length > 0 ? notesParts.join(' | ') : null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to insert lead:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to save lead', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Lead created successfully:', newLead.id, email);

    return new Response(
      JSON.stringify({ success: true, leadId: newLead.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e) {
    console.error('Google lead webhook error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
