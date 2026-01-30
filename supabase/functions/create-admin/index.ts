import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

async function verifyAuthorization(req: Request): Promise<{ authorized: boolean; error?: string; status?: number }> {
  // Check for internal secret header first (service-to-service calls)
  const internalSecret = req.headers.get('x-internal-secret');
  const expectedSecret = Deno.env.get('INTERNAL_SECRET');
  
  if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
    return { authorized: true };
  }

  // Check for JWT auth with admin role
  const authHeader = req.headers.get('Authorization');
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

  // Check if user has admin role
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify authorization
  const auth = await verifyAuthorization(req);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { email, password } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Create user
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError) {
      console.error('User creation error:', userError);
      return new Response(JSON.stringify({ success: false, error: userError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Grant admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({ user_id: userData.user.id, role: 'admin' });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      return new Response(JSON.stringify({ success: false, error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      user: { id: userData.user.id, email: userData.user.email } 
    }), {
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
