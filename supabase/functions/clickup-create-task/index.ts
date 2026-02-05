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
 
 async function verifyAuthorization(req: Request): Promise<{ authorized: boolean; error?: string; status?: number }> {
   // Check for internal secret header (service-to-service / database trigger calls)
   const internalSecret = req.headers.get('x-internal-secret');
   const expectedSecret = Deno.env.get('INTERNAL_SECRET');
   
   if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
     return { authorized: true };
   }
 
   // Check for service role key (used by database triggers via pg_net)
   const authHeader = req.headers.get('Authorization');
   const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
   if (authHeader && serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
     return { authorized: true };
   }
 
   // Check for JWT auth with admin role (user-initiated calls)
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
 
   const auth = await verifyAuthorization(req);
   if (!auth.authorized) {
     return new Response(JSON.stringify({ error: auth.error }), {
       status: auth.status,
       headers: { ...corsHeaders, 'Content-Type': 'application/json' },
     });
   }
 
   try {
     const leadData: LeadData = await req.json();
     
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