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
    const content = scrapeData.data?.markdown || scrapeData.markdown || '';

    if (!content) {
      return new Response(JSON.stringify({ success: false, error: 'No content scraped' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Use AI to extract structured data
    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [{ role: 'user', content: `Extract from this website: industry (one word), phone number if found. Return JSON: {"industry": "...", "phone": "..."}

${content.slice(0, 4000)}` }],
        tools: [{
          type: 'function',
          function: {
            name: 'extract_business_data',
            parameters: {
              type: 'object',
              properties: {
                industry: { type: 'string' },
                phone: { type: 'string' },
              },
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'extract_business_data' } },
      }),
    });

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const extracted = toolCall ? JSON.parse(toolCall.function.arguments) : {};

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
