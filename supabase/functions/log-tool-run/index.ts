import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';
// _shared/cors.ts existiert nicht — corsHeaders kommt aus gateway.ts.
import { corsHeaders } from '../_shared/gateway.ts';

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

    // Mandant über `memberships` auflösen.
    //
    // Bis zum 2026-09-01 stand hier `profiles.active_tenant_id`. Diese Spalte
    // gibt es nicht — nicht in `profiles` und nirgends sonst im Schema
    // (`information_schema.columns`, gegen das Live-Projekt geprüft; eine
    // Migration von 2026-07 hält denselben Befund für `auth.users` fest).
    // Der Aufruf endete deshalb **immer** mit „No active tenant", seit die
    // Function existiert. Aufgefallen ist das nie, weil der Fehler wie ein
    // fehlender Arbeitsbereich aussah und nicht wie ein Defekt.
    //
    // `memberships` ist die einzige Zuordnung Nutzer→Mandant. Gelesen wird
    // mit dem Nutzer-Token, nicht mit Service-Role: RLS begrenzt die Zeilen
    // ohnehin auf die eigenen Mitgliedschaften.
    const { data: memberships, error: membershipErr } = await supabase
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(2);

    if (membershipErr || !memberships || memberships.length === 0) {
      return new Response(JSON.stringify({ error: 'No active tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Bei mehreren Mandanten wird nicht geraten: Ein Lauf im falschen
    // Arbeitsbereich verfälscht Kosten und Prüfpfad.
    if (memberships.length > 1) {
      return new Response(JSON.stringify({ error: 'Multiple tenants — tenant_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = memberships[0].tenant_id as string;

    // Parse request body
    const body: LogToolRunRequest = await req.json();

    // Insert into ai_tool_runs
    const { data, error: insertErr } = await supabase
      .from('ai_tool_runs')
      .insert({
        tenant_id: tenantId,
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
