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
    // Exclude common email domains
    if (/gmail|yahoo|hotmail|outlook/i.test(domain)) return null;
    return domain.startsWith('http') ? domain : `https://${domain}`;
  }
  return null;
}

// Extract phone number from text
function extractPhone(text: string): string | null {
  // Match various phone formats: (xxx) xxx-xxxx, xxx-xxx-xxxx, xxxxxxxxxx, +1xxxxxxxxxx
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/;
  const match = text.match(phoneRegex);
  if (match) {
    // Clean the phone number
    const cleaned = match[0].replace(/[^\d+]/g, '');
    if (cleaned.length >= 10) return cleaned;
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
      // Check if it starts with capital letter and doesn't look like a URL, email, or phone
      if (/^[A-Z][a-z]/.test(content) && 
          !content.includes('@') && 
          !content.includes('.com') &&
          !content.includes('.co') &&
          !/^\d+$/.test(content) &&
          !/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(content)) {
        return content;
      }
    }
  }
  return null;
}

// Calculate lead score based on available data
function calculateLeadScore(data: { name?: boolean; email?: boolean; website?: boolean; phone?: boolean }): number {
  let score = 0;
  if (data.name) score += 20;      // Name = +20
  if (data.email) score += 30;     // Email = +30 (most valuable for contact)
  if (data.website) score += 25;   // Website = +25 (shows business intent)
  if (data.phone) score += 15;     // Phone = +15
  return score;
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
    let detectedPhone: string | null = null;

    for (const msg of userMessages) {
      const content = msg.content;
      if (!detectedEmail) detectedEmail = extractEmail(content);
      if (!detectedWebsite) detectedWebsite = extractWebsite(content);
      if (!detectedPhone) detectedPhone = extractPhone(content);
    }
    
    if (!detectedName) detectedName = extractName(userMessages);

    // Create/update lead as soon as we have a name (don't wait for email)
    if (detectedName && sessionId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Calculate score based on all available data
        const leadScore = calculateLeadScore({
          name: !!detectedName,
          email: !!detectedEmail,
          website: !!detectedWebsite,
          phone: !!detectedPhone,
        });

        // Check if lead already exists by email (if we have one) or by session
        let existingLead = null;
        
        if (detectedEmail) {
          const { data } = await supabase
            .from('leads')
            .select('id, lead_score, website, email, phone')
            .eq('email', detectedEmail)
            .maybeSingle();
          existingLead = data;
        }

        if (!existingLead) {
          // Check if we have a lead by session in metadata (for leads without email yet)
          const { data } = await supabase
            .from('leads')
            .select('id, lead_score, website, email')
            .eq('source', 'chatbot')
            .eq('notes', `session:${sessionId}`)
            .maybeSingle();
          existingLead = data;
        }

        if (existingLead) {
          // Update existing lead if we have new info or higher score
          const updates: Record<string, unknown> = {};
          
          if (detectedEmail && !existingLead.email) updates.email = detectedEmail;
          if (detectedWebsite && !existingLead.website) updates.website = detectedWebsite;
          if (detectedPhone) updates.phone = detectedPhone;
          if (leadScore > (existingLead.lead_score || 0)) updates.lead_score = leadScore;

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabase
              .from('leads')
              .update(updates)
              .eq('id', existingLead.id);

            if (updateError) {
              console.error('Lead update error:', updateError);
            } else {
              console.log('Lead updated:', existingLead.id, 'score:', leadScore, updates);
              
              // Trigger enrichment if website was just added
              if (updates.website) {
                fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-lead`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                  },
                  body: JSON.stringify({ leadId: existingLead.id, url: detectedWebsite }),
                }).catch(e => console.error('Enrichment trigger failed:', e));
              }
            }
          }
        } else {
          // Create new lead - use placeholder email if we don't have one yet
          const placeholderEmail = detectedEmail || `pending_${sessionId}@chatbot.temp`;
          
          const leadData: Record<string, unknown> = {
            email: placeholderEmail,
            full_name: detectedName,
            source: 'chatbot',
            lead_score: leadScore,
            notes: `session:${sessionId}`, // Track session for updates
          };

          if (detectedWebsite) leadData.website = detectedWebsite;
          if (detectedPhone) leadData.phone = detectedPhone;

          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert(leadData)
            .select('id')
            .single();

          if (insertError) {
            console.error('Lead insert error:', insertError);
          } else {
            console.log('Lead created:', newLead?.id, 'name:', detectedName, 'score:', leadScore);
            
            // Trigger Zapier webhook for new lead
            fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/zapier-webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: leadData.email,
                full_name: detectedName,
                website: detectedWebsite,
                phone: detectedPhone,
                source: 'chatbot',
                lead_score: leadScore,
              }),
            }).catch(e => console.error('Zapier webhook failed:', e));
            
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
- If they haven't shared their name, ask for it naturally first
- If they haven't shared their website or business, ask about it
- If they haven't shared their email, ask for it to send more info or schedule a call
- If they haven't shared their phone, you can ask for it as an alternative contact method
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
