import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const corsHeaders = buildCorsHeaders('GET, POST, OPTIONS');

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;

  try {
    // Governance incidents endpoint
    // Tracks and manages compliance incidents

    const { action, data } = await req.json();

    // Log incident activity
    console.log(`[governance-incidents] Action: ${action}`, data);

    // Store incident record if action is 'create'
    if (action === 'create' && data) {
      const { data: result, error } = await supabase
        .from('governance_incidents')
        .insert([{
          title: data.title,
          description: data.description,
          severity: data.severity || 'medium',
          status: 'open',
          created_at: new Date().toISOString(),
        }])
        .select();

      if (error) throw error;

      return jsonResponse({ success: true, incident: result }, 200, corsHeaders);
    }

    return jsonResponse({
      success: true,
      message: 'Governance incidents handler active',
      action,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Governance incidents error:', error);
    return jsonResponse({ error: (error as Error).message }, 400, corsHeaders);
  }
});
