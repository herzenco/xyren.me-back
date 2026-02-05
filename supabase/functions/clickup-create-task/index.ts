 import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
 
 const corsHeaders = {
   'Access-Control-Allow-Origin': '*',
   'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
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
   qualification_status?: string | null;
 }
 
 function formatSource(source: string | null | undefined): string {
   const sourceMap: Record<string, string> = {
     hero_modal: 'Hero Form',
     project_plan_modal: 'Project Plan',
     chatbot: 'Chatbot',
   };
   return sourceMap[source || ''] || source || 'Unknown';
 }
 
 Deno.serve(async (req) => {
   if (req.method === 'OPTIONS') {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
    const body = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
     const clickupApiKey = Deno.env.get('CLICKUP_API_KEY');
     const clickupListId = Deno.env.get('CLICKUP_LIST_ID');
     
     if (!clickupApiKey) {
       console.error('CLICKUP_API_KEY not configured');
       return new Response(
         JSON.stringify({ success: false, error: 'CLICKUP_API_KEY not configured' }), 
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
     
     if (!clickupListId) {
       console.error('CLICKUP_LIST_ID not configured');
       return new Response(
         JSON.stringify({ success: false, error: 'CLICKUP_LIST_ID not configured' }), 
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
    // Fetch lead data from database using service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const leadId = body.id;
    if (!leadId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead ID required' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: leadData, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchError || !leadData) {
      console.error('Failed to fetch lead:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Lead not found' }), 
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if already synced to ClickUp
    if (leadData.clickup_task_id) {
      console.log('Lead already synced to ClickUp:', leadData.email, leadData.clickup_task_id);
      return new Response(
        JSON.stringify({ success: true, skipped: true, taskId: leadData.clickup_task_id }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

     console.log('Creating ClickUp task for lead:', leadData.email, leadData.full_name);
 
     // Build task description with all lead details
     const descriptionParts = [
       `**Email:** ${leadData.email}`,
       leadData.phone ? `**Phone:** ${leadData.phone}` : null,
       leadData.website ? `**Website:** ${leadData.website}` : null,
       leadData.industry ? `**Industry:** ${leadData.industry}` : null,
       `**Source:** ${formatSource(leadData.source)}`,
       `**Lead Score:** ${leadData.lead_score || 0}`,
       leadData.qualification_status ? `**Status:** ${leadData.qualification_status}` : null,
       leadData.notes ? `\n**Notes:**\n${leadData.notes}` : null,
       leadData.created_at ? `\n_Submitted: ${new Date(leadData.created_at).toLocaleString()}_` : null,
     ].filter(Boolean);
 
     const taskPayload = {
       name: `New Lead: ${leadData.full_name}`,
       description: descriptionParts.join('\n'),
       priority: leadData.lead_score && leadData.lead_score >= 70 ? 1 : 
                 leadData.lead_score && leadData.lead_score >= 40 ? 2 : 3,
     };
 
     const response = await fetch(`https://api.clickup.com/api/v2/list/${clickupListId}/task`, {
       method: 'POST',
       headers: {
         'Authorization': clickupApiKey,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify(taskPayload),
     });
 
     if (!response.ok) {
       const errorText = await response.text();
       console.error('ClickUp API error:', response.status, errorText);
       return new Response(
         JSON.stringify({ success: false, error: `ClickUp returned ${response.status}: ${errorText}` }), 
         { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
       );
     }
 
     const taskData = await response.json();
     console.log('ClickUp task created successfully:', taskData.id, 'for lead:', leadData.email);
     
    // Update lead with ClickUp task info
    await supabase
      .from('leads')
      .update({
        clickup_task_id: taskData.id,
        clickup_task_url: taskData.url,
        clickup_synced_at: new Date().toISOString(),
      })
      .eq('id', leadId);

     return new Response(
       JSON.stringify({ success: true, taskId: taskData.id, taskUrl: taskData.url }), 
       { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   } catch (e) {
     console.error('ClickUp create task error:', e);
     const message = e instanceof Error ? e.message : 'Unknown error';
     return new Response(
       JSON.stringify({ error: message }), 
       { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
     );
   }
 });