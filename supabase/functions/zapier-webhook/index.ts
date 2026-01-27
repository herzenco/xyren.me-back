import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  qualification_status?: string | null;
  engagement_depth?: number | null;
  intent_signals?: Record<string, unknown> | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatInteraction {
  user_message: string | null;
  assistant_message: string | null;
  created_at: string;
  session_id: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchChatHistory(supabase: any, leadId?: string, sessionId?: string): Promise<ChatMessage[]> {
  if (!leadId && !sessionId) return [];

  try {
    let query = supabase
      .from('chat_interactions')
      .select('user_message, assistant_message, created_at, session_id')
      .order('created_at', { ascending: true });

    // Try to find by lead_id first, then by session from notes
    if (leadId) {
      query = query.eq('lead_id', leadId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Error fetching chat history:', error);
      return [];
    }

    if (!data || data.length === 0) return [];

    // Convert to chat messages format
    const messages: ChatMessage[] = [];
    const interactions = data as ChatInteraction[];
    for (const interaction of interactions) {
      if (interaction.user_message) {
        messages.push({
          role: 'user',
          content: interaction.user_message,
          timestamp: interaction.created_at,
        });
      }
      if (interaction.assistant_message) {
        messages.push({
          role: 'assistant',
          content: interaction.assistant_message,
          timestamp: interaction.created_at,
        });
      }
    }

    return messages;
  } catch (e) {
    console.error('Failed to fetch chat history:', e);
    return [];
  }
}

function formatChatHistoryForWhatsApp(messages: ChatMessage[]): string {
  if (messages.length === 0) return 'No chat history available';

  return messages
    .map((msg) => {
      const role = msg.role === 'user' ? '👤 User' : '🤖 Xyren';
      return `${role}: ${msg.content}`;
    })
    .join('\n\n');
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

    // Initialize Supabase client to fetch chat history
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Extract session ID from notes if present (format: "session:xyz")
    let sessionId: string | undefined;
    if (leadData.notes?.startsWith('session:')) {
      sessionId = leadData.notes.replace('session:', '');
    }

    // Fetch chat history
    const chatHistory = await fetchChatHistory(supabase, leadData.id, sessionId);
    const formattedChatHistory = formatChatHistoryForWhatsApp(chatHistory);

    const hasPhone = !!(leadData.phone && leadData.phone !== 'null' && leadData.phone !== 'None');

    const payload = {
      // Top-level fields for easy Zapier mapping (especially for WhatsApp)
      name: leadData.full_name,
      email: leadData.email,
      phone: leadData.phone || null,
      has_phone: hasPhone,
      website: leadData.website || null,
      industry: leadData.industry || null,
      source: leadData.source || 'unknown',
      score: leadData.lead_score || 0,
      
      // Chat history for WhatsApp message
      chat_history: formattedChatHistory,
      chat_message_count: chatHistory.length,
      
      // Contact info group (for backward compatibility)
      contact: {
        phone: leadData.phone || null,
        website: leadData.website || null,
      },
      
      // Lead qualification group
      qualification: {
        score: leadData.lead_score || 0,
        source: leadData.source || 'unknown',
        industry: leadData.industry || null,
        status: leadData.qualification_status || 'cool',
        engagement_depth: leadData.engagement_depth || 0,
        intent_signals: leadData.intent_signals || {},
      },
      
      // Metadata group
      metadata: {
        id: leadData.id,
        notes: leadData.notes || null,
        timestamp: new Date().toISOString(),
        created_at: leadData.created_at || new Date().toISOString(),
      },

      // Pre-formatted WhatsApp message for convenience
      whatsapp_message: `🔔 *New Lead Alert!*

*Name:* ${leadData.full_name}
*Email:* ${leadData.email}
*Phone:* ${leadData.phone || 'Not provided'}
*Website:* ${leadData.website || 'Not provided'}
*Industry:* ${leadData.industry || 'Unknown'}
*Source:* ${leadData.source || 'Unknown'}
*Score:* ${leadData.lead_score || 0}/100

📝 *Chat History:*
${formattedChatHistory}

⏰ Captured: ${new Date().toLocaleString()}`,
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

    console.log('Lead sent to Zapier successfully:', leadData.email, 'has_phone:', hasPhone);
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
