// ISO 42001 Controls Library
// Fetch searchable catalog of all ISO 42001 controls with implementation guidance

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') return jsonError(405, 'BAD_REQUEST', 'GET only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });

  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');

  if (!tenantId) {
    return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  }

  try {
    // Get ISO 42001 framework ID
    const { data: framework } = await userClient
      .from('compliance_frameworks')
      .select('id')
      .eq('code', 'iso42001')
      .single();

    if (!framework) {
      return jsonResponse({ controls: [] });
    }

    // Load all ISO 42001 controls
    const { data: controls } = await userClient
      .from('framework_controls')
      .select('id, control_code, control_name, description, guidance, severity, category')
      .eq('framework_id', framework.id)
      .order('control_code', { ascending: true });

    if (!controls) {
      return jsonResponse({ controls: [] });
    }

    // Enrich with implementation status from tenant's implementations
    const { data: implementations } = await userClient
      .from('iso42001_implementations')
      .select('id, control_code, status')
      .eq('tenant_id', tenantId);

    const implementationMap = new Map(
      (implementations || []).map((i) => [i.control_code, i.status])
    );

    const enrichedControls = controls.map((control) => ({
      ...control,
      implementation_status: implementationMap.get(control.control_code) || null,
    }));

    return jsonResponse({ controls: enrichedControls });
  } catch (e) {
    console.error('Error:', e);
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});
