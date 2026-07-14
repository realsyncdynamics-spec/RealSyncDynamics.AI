import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
import { corsHeaders } from '../_shared/cors.ts';

interface LogToolRunRequest {
  tool_key: string;
  status: 'success' | 'error' | 'timeout' | 'quota_exceeded';
  input_tokens?: number;
  output_tokens?: number;
  cached_tokens?: number;
  cost_usd?: number;
  duration_ms?: number;
  error_code?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice(7);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    // Get tenant + user
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant from user's current workspace
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('active_tenant_id')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile?.active_tenant_id) {
      return new Response(JSON.stringify({ error: 'No active tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: LogToolRunRequest = await req.json();

    // Insert into ai_tool_runs
    const { data, error: insertErr } = await supabase
      .from('ai_tool_runs')
      .insert({
        tenant_id: profile.active_tenant_id,
        user_id: user.id,
        tool_key: body.tool_key,
        input_tokens: body.input_tokens ?? 0,
        output_tokens: body.output_tokens ?? 0,
        cached_tokens: body.cached_tokens ?? 0,
        cost_usd: body.cost_usd ?? 0,
        duration_ms: body.duration_ms ?? null,
        status: body.status,
        error_code: body.error_code ?? null,
        error_message: body.error_message ?? null,
        metadata: body.metadata ?? {},
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Insert error:', insertErr);
      return new Response(JSON.stringify({ error: 'Failed to log run' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
