const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Firecrawl not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get leads with websites that need enrichment
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const leadsRes = await fetch(`${supabaseUrl}/rest/v1/leads?website=not.is.null&industry=is.null&select=id,website`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` },
    });
    const leads = await leadsRes.json();

    for (const lead of leads.slice(0, 5)) {
      const scrapeRes = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: lead.website, formats: ['markdown'] }),
      });
      const scrapeData = await scrapeRes.json();
      
      if (scrapeData.success) {
        // Simple industry detection from content
        const content = scrapeData.data?.markdown?.toLowerCase() || '';
        let industry = null;
        if (content.includes('real estate') || content.includes('property')) industry = 'Real Estate';
        else if (content.includes('law') || content.includes('legal')) industry = 'Legal';
        else if (content.includes('restaurant') || content.includes('food')) industry = 'Food & Beverage';
        else if (content.includes('construction') || content.includes('contractor')) industry = 'Construction';
        
        if (industry) {
          await fetch(`${supabaseUrl}/rest/v1/leads?id=eq.${lead.id}`, {
            method: 'PATCH',
            headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ industry }),
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, enriched: leads.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
