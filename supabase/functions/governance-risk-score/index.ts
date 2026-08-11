// Governance Risk Score Engine.
//
// POST /functions/v1/governance-risk-score
// Authorization: Bearer <user JWT>
// Body shapes:
//   { asset_id: uuid }                            — recompute single asset
//   { tenant_id: uuid, recalculate_all: true }    — recompute all tenant assets
//
// Auth (F-04 remediation):
//   - Real JWT validation via auth.getUser()
//   - Membership check before any service_role write
//   - tenant_id from body is never trusted without membership verification

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import { requireUser, requireTenantMembership } from '../_shared/auth.ts';

interface SupabaseAdminClient {
  from(table: string): {
    select(columns: string): {
      eq(col: string, val: unknown): SelectChain;
      gte(col: string, val: unknown): Promise<{ data: unknown; error: unknown }>;
    };
    update(obj: Record<string, unknown>): {
      eq(col: string, val: unknown): Promise<{ error: unknown }>;
    };
    insert(obj: Record<string, unknown>): {
      select(): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

interface SelectChain {
  eq(col: string, val: unknown): SelectChain;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
}

interface AssetRow {
  id: string;
  tenant_id: string | null;
  asset_type: string;
  ai_act_class: string;
  data_types: string[] | null;
  status: string;
  risk_score: number;
}

interface EventRow {
  id: string;
  risk_level: string;
  policy_action: string | null;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    if (body.recalculate_all && body.tenant_id) {
      const tenantId = body.tenant_id as string;
      const member = await requireTenantMembership(auth.admin, auth.user.id, tenantId);
      if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of the requested tenant');

      const out = await recalcTenant(auth.admin as unknown as SupabaseAdminClient, tenantId);
      return jsonResponse({ ok: true, ...out });
    }

    const asset_id = body.asset_id as string;
    if (!asset_id) return jsonError(400, 'BAD_REQUEST', 'asset_id required (or recalculate_all+tenant_id)');

    // Load asset first so we can verify membership against its real tenant_id
    const { data: assetPreview, error: previewErr } = await auth.admin
      .from('governance_assets')
      .select('id, tenant_id')
      .eq('id', asset_id)
      .maybeSingle();

    if (previewErr) throw previewErr;
    if (!assetPreview) return jsonError(404, 'NOT_FOUND', 'asset not found');

    const assetTenantId = (assetPreview as { tenant_id: string | null }).tenant_id;
    if (!assetTenantId) return jsonError(400, 'BAD_REQUEST', 'asset has no tenant');

    const member = await requireTenantMembership(auth.admin, auth.user.id, assetTenantId);
    if (!member) return jsonError(403, 'FORBIDDEN', 'not a member of the asset tenant');

    const out = await recalcOne(auth.admin as unknown as SupabaseAdminClient, asset_id);
    if (!out) return jsonError(404, 'NOT_FOUND', 'asset not found');
    return jsonResponse({ ok: true, ...out });
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

async function recalcTenant(admin: SupabaseAdminClient, tenantId: string): Promise<{ count: number }> {
  const { data: assets, error } = await admin
    .from('governance_assets').select('id').eq('tenant_id', tenantId);
  if (error) throw error;
  let count = 0;
  for (const a of assets ?? []) {
    const r = await recalcOne(admin, a.id);
    if (r) count++;
  }
  return { count };
}

async function recalcOne(admin: SupabaseAdminClient, assetId: string): Promise<{ score: number; previous: number; delta: number; reason: string } | null> {
  const { data: asset, error: aErr } = await admin
    .from('governance_assets')
    .select('id, tenant_id, asset_type, ai_act_class, data_types, status, risk_score')
    .eq('id', assetId).maybeSingle();
  if (aErr) throw aErr;
  if (!asset) return null;
  const A = asset as AssetRow;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: events, error: eErr } = await admin
    .from('governance_events')
    .select('id, risk_level, policy_action')
    .eq('asset_id', assetId)
    .gte('created_at', thirtyDaysAgo);
  if (eErr) throw eErr;
  const E = (events ?? []) as EventRow[];

  const breakdown: Array<{ rule: string; delta: number }> = [];
  let score = 0;

  if (A.ai_act_class === 'high')        { score += 30; breakdown.push({ rule: 'ai_act_class=high', delta: 30 }); }
  if (A.ai_act_class === 'prohibited')  { score += 50; breakdown.push({ rule: 'ai_act_class=prohibited', delta: 50 }); }
  if (A.asset_type === 'agent')         { score += 10; breakdown.push({ rule: 'asset_type=agent', delta: 10 }); }

  const criticalEvents = E.filter((x) => x.risk_level === 'critical');
  const highEvents = E.filter((x) => x.risk_level === 'high');
  const critPoints = Math.min(criticalEvents.length * 15, 30);
  const highPoints = Math.min(highEvents.length * 8, 24);
  if (critPoints > 0) { score += critPoints; breakdown.push({ rule: `critical_events_30d\u00d7${criticalEvents.length}`, delta: critPoints }); }
  if (highPoints > 0) { score += highPoints; breakdown.push({ rule: `high_events_30d\u00d7${highEvents.length}`, delta: highPoints }); }

  const blockEvent = E.find((x) => x.policy_action === 'block');
  if (blockEvent) { score += 20; breakdown.push({ rule: 'policy_action=block triggered', delta: 20 }); }

  const dt = A.data_types ?? [];
  if (dt.includes('health_data'))    { score += 15; breakdown.push({ rule: 'data_types:health_data', delta: 15 }); }
  if (dt.includes('applicant_data')) { score += 12; breakdown.push({ rule: 'data_types:applicant_data', delta: 12 }); }
  if (dt.includes('customer_data'))  { score += 8;  breakdown.push({ rule: 'data_types:customer_data',  delta: 8 }); }

  if (E.length === 0) { score -= 10; breakdown.push({ rule: 'no_events_30d (inactive)', delta: -10 }); }
  if (A.status === 'approved') { score -= 10; breakdown.push({ rule: 'status=approved', delta: -10 }); }

  score = Math.min(100, Math.max(0, score));

  const reason = breakdown
    .map((b) => `${b.delta > 0 ? '+' : ''}${b.delta} ${b.rule}`)
    .join('; ');

  const contributingEvents = [
    ...criticalEvents.map((x) => x.id),
    ...highEvents.map((x) => x.id),
    ...(blockEvent ? [blockEvent.id] : []),
  ];

  const previous = A.risk_score ?? 0;

  if (score !== previous) {
    const { error: upErr } = await admin
      .from('governance_assets').update({ risk_score: score }).eq('id', assetId);
    if (upErr) throw upErr;
  }

  await admin.from('asset_risk_history').insert({
    asset_id: assetId,
    tenant_id: A.tenant_id,
    risk_score: score,
    previous_score: previous,
    reason: reason || 'no contributing factors',
    contributing_events: contributingEvents,
  });

  return { score, previous, delta: score - previous, reason };
}
