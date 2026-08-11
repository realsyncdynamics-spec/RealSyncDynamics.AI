// Enterprise AI OS — list unapproved (pending) AI systems.
//
// GET /functions/v1/enterprise-ai-os-discovery-pending?tenantId=...&limit=50
//
// Auth (F-05 remediation):
//   - Requires valid user JWT
//   - tenantId is mandatory and must match a membership of the caller
//   - No global dump across tenants is possible any more

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { buildCorsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';

const corsHeaders = buildCorsHeaders('GET, OPTIONS');

Deno.serve(async (req) => {
  const preflight = handleOptions(req, corsHeaders);
  if (preflight) return preflight;
  if (req.method !== 'GET') return jsonError(405, 'METHOD_NOT_ALLOWED', 'GET only', corsHeaders);

  const parsedUrl = new URL(req.url);
  const tenantId = parsedUrl.searchParams.get('tenantId');
  const limitParam = Number.parseInt(parsedUrl.searchParams.get('limit') ?? '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitParam) ? limitParam : 50, 1), 200);

  const auth = await requireAuthAndTenant(req, tenantId);
  if (auth instanceof Response) return auth;

  const { data, error } = await auth.admin
    .from('enterprise_ai_system_registry')
    .select('id, tenant_id, name, provider, model, usage_context, department, risk_level, contains_personal_data, contains_sensitive_data, external_usage, intake_source, created_at')
    .eq('approved', false)
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return jsonError(500, 'INTERNAL', error.message, corsHeaders);

  return jsonResponse({ pending: data ?? [] }, 200, corsHeaders);
});
