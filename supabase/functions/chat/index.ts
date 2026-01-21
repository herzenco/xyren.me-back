import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Extract email from text
function extractEmail(text: string): string | null {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const match = text.match(emailRegex);
  return match ? match[0].toLowerCase() : null;
}

// Extract URL/website from text
function extractWebsite(text: string): string | null {
  const urlRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i;
  const match = text.match(urlRegex);
  if (match) {
    const domain = match[0];
    return domain.startsWith('http') ? domain : `https://${domain}`;
  }
  return null;
}

// Extract potential name (simple heuristic - capitalized words, 2-4 words)
function extractName(messages: Array<{ role: string; content: string }>): string | null {
  for (const msg of messages) {
    if (msg.role !== 'user') continue;
    const content = msg.content.trim();
    // Check if it's a short response (likely a name)
    if (content.split(' ').length <= 4 && content.length < 50) {
      // Check if it starts with capital letter and doesn't look like a URL or email
      if (/^[A-Z][a-z]/.test(content) && !content.includes('@') && !content.includes('.com')) {
        return content;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { messages, sessionId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Check all user messages for lead data
    const userMessages = messages.filter((m: { role: string }) => m.role === 'user');
    let detectedEmail: string | null = null;
    let detectedWebsite: string | null = null;
    let detectedName: string | null = null;

    for (const msg of userMessages) {
      const content = msg.content;
      if (!detectedEmail) detectedEmail = extractEmail(content);
      if (!detectedWebsite) detectedWebsite = extractWebsite(content);
    }
    
    if (!detectedName) detectedName = extractName(userMessages);

    // If we have an email, create/update the lead
    if (detectedEmail) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Check if lead already exists
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id')
          .eq('email', detectedEmail)
          .maybeSingle();

        if (!existingLead) {
          // Create new lead
          const leadData: Record<string, unknown> = {
            email: detectedEmail,
            full_name: detectedName || 'Unknown',
            source: 'chatbot',
            lead_score: 30, // Base score for chatbot leads
          };

          if (detectedWebsite) {
            leadData.website = detectedWebsite;
            leadData.lead_score = 50; // Higher score if they shared website
          }

          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert(leadData)
            .select('id')
            .single();

          if (insertError) {
            console.error('Lead insert error:', insertError);
          } else {
            console.log('Lead created:', newLead?.id, detectedEmail);
            
            // Trigger enrichment if website provided
            if (detectedWebsite && newLead?.id) {
              fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-lead`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({ leadId: newLead.id, url: detectedWebsite }),
              }).catch(e => console.error('Enrichment trigger failed:', e));
            }
          }
        } else {
          console.log('Lead already exists:', detectedEmail);
        }
      } catch (dbError) {
        console.error('Database error:', dbError);
      }
    }

    // Stream AI response
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: `You are Xyren, a friendly AI assistant for a web development agency. Keep responses concise and actionable.

When chatting with potential clients:
- If they haven't shared their name, ask for it naturally
- If they haven't shared their website or business, ask about it
- If they haven't shared their email, ask for it to send more info or schedule a call
- Be helpful and conversational, not pushy` 
          },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (status === 402) return new Response(JSON.stringify({ error: 'Payment required' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error('AI gateway error');
    }

    return new Response(response.body, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });
  } catch (e) {
    console.error('chat error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
