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
    // Governance connectors endpoint
    // Handles integration with external compliance frameworks

    const { action, data } = await req.json();

    // Log connector activity
    console.log(`[governance-connectors] Action: ${action}`, data);

    return jsonResponse({
      success: true,
      message: 'Governance connector active',
      action,
    }, 200, corsHeaders);
  } catch (error) {
    console.error('Governance connectors error:', error);
    return jsonResponse({ error: (error as Error).message }, 400, corsHeaders);
  }
});
