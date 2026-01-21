import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const text = await req.text();
    if (!text) {
      return new Response(JSON.stringify({ error: 'Request body required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const { leadId, url } = JSON.parse(text);
    if (!leadId || !url) return new Response(JSON.stringify({ error: 'leadId and url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Scrape website
    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http')) formattedUrl = `https://${formattedUrl}`;

    console.log('Scraping for enrichment:', formattedUrl);

    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: formattedUrl, formats: ['markdown'], onlyMainContent: true }),
    });
    const scrapeData = await scrapeRes.json();
    const scrapedContent = scrapeData.data?.markdown || scrapeData.markdown || '';

    if (!scrapedContent) {
      return new Response(JSON.stringify({ success: false, error: 'No content scraped' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Scraped content length:', scrapedContent.length);
    console.log('Content preview:', scrapedContent.slice(0, 500));

    // Use AI to extract structured data
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{
          role: 'user',
          content: `Analyze this business website content and extract:
1. The primary industry (single word like "Technology", "Healthcare", "Retail", "Marketing", "Finance", etc.)
2. Any phone number found on the page

Website content:
${scrapedContent.slice(0, 4000)}

Respond using the extract_business_data function.`
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_business_data',
            parameters: {
              type: 'object',
              properties: {
                industry: { type: 'string', description: 'Primary industry of the business' },
                phone: { type: 'string', description: 'Phone number if found' },
              },
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_business_data' } },
      }),
    });

    const aiData = await aiRes.json();
    console.log('AI response status:', aiRes.status);
    console.log('AI response:', JSON.stringify(aiData));

    // Try tool call first, then fallback to content parsing
    let extracted: { industry?: string; phone?: string } = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extracted = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.log('Failed to parse tool call arguments:', e);
      }
    }
    
    // Fallback: try to parse from message content
    if (!extracted.industry && !extracted.phone) {
      const msgContent = aiData.choices?.[0]?.message?.content;
      if (msgContent) {
        const jsonMatch = msgContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            extracted = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.log('Failed to parse content JSON:', e);
          }
        }
      }
    }

    console.log('Extracted data:', extracted);

    // Update lead
    const updates: Record<string, string> = {};
    if (extracted.industry) updates.industry = extracted.industry;
    if (extracted.phone) updates.phone = extracted.phone;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('leads').update(updates).eq('id', leadId);
      if (error) {
        console.error('Database update error:', error);
        return new Response(JSON.stringify({ success: false, error: 'Failed to update lead' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    return new Response(JSON.stringify({ success: true, extracted }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('Enrich error:', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
