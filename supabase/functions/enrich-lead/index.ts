const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACTION_PROMPT = `Analyze the following website content and extract structured information. Return a JSON object with these fields:

- phone: string | null - Any phone number found (format as digits with dashes)
- industry: string | null - The business industry/category (e.g., "Real Estate", "Legal", "Healthcare", "Construction", "Food & Beverage", "Technology", "Retail", "Finance", "Education", "Other")
- company_name: string | null - The company or business name
- company_description: string | null - A brief 1-2 sentence description of what the company does
- services: string[] - List of main services/products offered (max 5)
- location: string | null - City/State or address if found

Only include fields where you have confident data. Return null for fields without clear information.

Website content:
`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { markdown, url } = await req.json();

    if (!markdown) {
      return new Response(
        JSON.stringify({ success: false, error: 'Website content (markdown) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Enriching lead from URL:', url);

    // Truncate content to avoid token limits
    const truncatedContent = markdown.slice(0, 8000);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'user', content: EXTRACTION_PROMPT + truncatedContent }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_lead_info',
              description: 'Extract structured lead information from website content',
              parameters: {
                type: 'object',
                properties: {
                  phone: { type: 'string', description: 'Phone number found on the website' },
                  industry: { type: 'string', description: 'Business industry/category' },
                  company_name: { type: 'string', description: 'Company or business name' },
                  company_description: { type: 'string', description: 'Brief description of the company' },
                  services: { type: 'array', items: { type: 'string' }, description: 'Main services offered' },
                  location: { type: 'string', description: 'Business location' },
                },
                required: [],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'extract_lead_info' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI service error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    let extractedData = {};
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    console.log('Extracted data:', extractedData);

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Enrich error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
