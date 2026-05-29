import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

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
      
      return new Response(
        JSON.stringify({ success: true, incident: result }),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        },
      );
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Governance incidents handler active',
        action,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  } catch (error) {
    console.error('Governance incidents error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  }
});
