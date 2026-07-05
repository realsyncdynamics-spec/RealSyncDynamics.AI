import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

interface ApiAuditRequest {
  domain?: string;
  module?: string;
  detailed?: boolean;
}

interface ApiAuditResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  status_code?: number;
  timestamp: string;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('OK', { headers: corsHeaders });
  }

  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing or invalid Authorization header. Use: Authorization: Bearer <api_key>',
          timestamp: new Date().toISOString(),
        } as ApiAuditResponse),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const apiKey = authHeader.substring(7);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Validate API key and get tenant
    const { data: tenantId, error: validateErr } = await supabase.rpc(
      'api_key_validate',
      { p_key: apiKey }
    );

    if (validateErr || !tenantId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid API key',
          timestamp: new Date().toISOString(),
        } as ApiAuditResponse),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get tenant subscription tier and check rate limits
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .select('subscription_tier')
      .eq('id', tenantId)
      .single();

    if (tenantErr || !tenantData) {
      throw new Error('Tenant not found');
    }

    // Get API key info for logging
    const { data: apiKeyData } = await supabase
      .from('api_keys')
      .select('id')
      .eq('key_hash', await hashApiKey(apiKey))
      .single();

    // Check rate limit
    const { data: withinLimit } = await supabase.rpc(
      'check_api_rate_limit',
      {
        p_tenant_id: tenantId,
        p_tier: tenantData.subscription_tier || 'free',
      }
    );

    if (!withinLimit) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Rate limit exceeded. Monthly quota for ${tenantData.subscription_tier} plan reached.`,
          timestamp: new Date().toISOString(),
        } as ApiAuditResponse),
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let body: ApiAuditRequest = {};
    if (req.method === 'POST') {
      try {
        body = await req.json();
      } catch {
        // Empty body is OK
      }
    }

    // TODO: Implement audit logic based on domain/module parameters
    // For now, return a placeholder response
    const auditResult = {
      tenant_id: tenantId,
      domain: body.domain || 'all',
      module: body.module || 'general',
      status: 'ready',
      last_checked: new Date().toISOString(),
      compliance_score: 0, // Would be populated by actual audit logic
      findings: [],
    };

    // Log API call
    if (apiKeyData) {
      await supabase.from('api_calls').insert({
        tenant_id: tenantId,
        api_key_id: apiKeyData.id,
        endpoint: '/api-audit',
        method: req.method,
        status_code: 200,
        response_time_ms: 0, // Would be measured
        request_path: req.url,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: auditResult,
        timestamp: new Date().toISOString(),
      } as ApiAuditResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('API audit error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      } as ApiAuditResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper function to hash API key (matches client-side hashing)
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
