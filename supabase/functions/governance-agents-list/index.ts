// Governance Agents Discovery API
//
// GET /functions/v1/governance-agents-list?tenant_id=...&status=active&capability=...&runtime=...
//
// Auth (F-05 remediation):
//   - Requires valid user JWT (platform verify_jwt = true + in-function check)
//   - tenant_id must belong to a membership of the caller
//   - No string interpolation into PostgREST filter grammar

import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';

interface AgentListRow {
  id: string;
  agent_name: string;
  description: string | null;
  version: string;
  status: string;
  capabilities: string[];
  runtime: string | null;
  metadata: Record<string, unknown>;
  tenant_id: string | null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'GET') {
    return jsonError(405, 'METHOD_NOT_ALLOWED', 'GET only');
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    const status = url.searchParams.get('status') || 'active';
    const capabilities = url.searchParams.get('capability')?.split(',').filter(Boolean) || [];
    const runtime = url.searchParams.get('runtime') || undefined;

    const auth = await requireAuthAndTenant(req, tenantId);
    if (auth instanceof Response) return auth;

    // Two separate, fully parameterized queries — never interpolate into .or()
    const baseSelect = 'id, agent_name, description, version, status, capabilities, runtime, metadata, tenant_id';

    let tenantQuery = auth.admin
      .from('governance_agent_registry')
      .select(baseSelect)
      .eq('status', status)
      .eq('tenant_id', auth.tenantId);

    let globalQuery = auth.admin
      .from('governance_agent_registry')
      .select(baseSelect)
      .eq('status', status)
      .is('tenant_id', null);

    if (runtime) {
      tenantQuery = tenantQuery.eq('runtime', runtime);
      globalQuery = globalQuery.eq('runtime', runtime);
    }

    const [tenantRes, globalRes] = await Promise.all([tenantQuery, globalQuery]);

    if (tenantRes.error) throw new Error(`Tenant query failed: ${tenantRes.error.message}`);
    if (globalRes.error) throw new Error(`Global query failed: ${globalRes.error.message}`);

    let rows = [
      ...((tenantRes.data || []) as AgentListRow[]),
      ...((globalRes.data || []) as AgentListRow[]),
    ];

    if (capabilities.length > 0) {
      rows = rows.filter((row) =>
        capabilities.some((cap) => row.capabilities?.includes(cap)),
      );
    }

    return jsonResponse({ agents: rows, count: rows.length });
  } catch (error) {
    console.error('Failed to list agents:', error);
    return jsonError(
      500,
      'INTERNAL',
      `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
});
