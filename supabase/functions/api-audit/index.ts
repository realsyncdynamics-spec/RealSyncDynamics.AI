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

    // Check rate limit based on tier
    const tierLimits: Record<string, number> = {
      agency: 1000,
      scale: 10000,
      enterprise: 100000,
      free: 0,
    };

    const limit = tierLimits[tenantData.subscription_tier?.toLowerCase() || 'free'] || 0;

    if (limit === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `API access not available in ${tenantData.subscription_tier || 'free'} plan.`,
          timestamp: new Date().toISOString(),
        } as ApiAuditResponse),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Count calls this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data: callCount, error: countErr } = await supabase
      .from('api_calls')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .gte('called_at', monthStart.toISOString());

    if (countErr) {
      throw countErr;
    }

    const currentCalls = callCount?.length || 0;

    if (currentCalls >= limit) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Rate limit exceeded. Monthly quota (${limit} calls) for ${tenantData.subscription_tier} plan reached.`,
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

    // Implement audit logic based on domain/module parameters
    const domain = body.domain || 'all';
    const module = body.module || 'general';
    const detailed = body.detailed || false;

    // Fetch audit results from governance_audits table
    const { data: auditData, error: auditErr } = await supabase
      .from('governance_audits')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('domain', domain === 'all' ? null : domain, { foreignTable: true })
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get compliance findings for the module
    const { data: findings, error: findingsErr } = await supabase
      .from('compliance_findings')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('module', module)
      .eq('domain', domain === 'all' ? null : domain, { foreignTable: true })
      .eq('resolved', false)
      .order('severity', { ascending: false });

    // Calculate compliance score (0-100)
    let complianceScore = 100;
    if (findings && findings.length > 0) {
      const severityWeights = { critical: 25, high: 15, medium: 8, low: 3 };
      const totalPenalty = findings.reduce((sum, f) => sum + (severityWeights[f.severity as keyof typeof severityWeights] || 0), 0);
      complianceScore = Math.max(0, 100 - totalPenalty);
    }

    const auditResult = {
      tenant_id: tenantId,
      domain: domain,
      module: module,
      status: complianceScore >= 80 ? 'compliant' : 'non-compliant',
      last_checked: auditData?.created_at || new Date().toISOString(),
      compliance_score: complianceScore,
      findings: detailed ? (findings || []).map(f => ({
        id: f.id,
        severity: f.severity,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        detected_at: f.detected_at,
      })) : (findings || []).slice(0, 5).map(f => ({
        id: f.id,
        severity: f.severity,
        title: f.title,
        recommendation: f.recommendation,
      })),
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
