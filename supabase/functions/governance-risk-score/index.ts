// Governance Risk Score Engine.
//
// POST /functions/v1/governance-risk-score
// Authorization: Bearer <service_role JWT or ingest API key>
// Body shapes:
//   { asset_id: uuid }                            — recompute single asset
//   { tenant_id: uuid, recalculate_all: true }    — recompute all tenant assets
//
// Weighted, transparent scoring (v1):
//
//   ai_act_class == 'high'                +30
//   ai_act_class == 'prohibited'          +50
//   asset_type == 'agent'                 +10
//   per critical event in last 30d        +15 (max +30 from this rule)
//   per high event in last 30d            +8  (max +24 from this rule)
//   any event with policy_action='block'  +20 (once)
//   data_types contains health_data       +15
//   data_types contains applicant_data    +12
//   data_types contains customer_data     +8
//   no events in last 30 days             -10 (inactive penalty inverted)
//   status == 'approved'                  -10
//
// Clamp [0, 100]. Persists new score on governance_assets and
// appends a row to asset_risk_history with reason + contributing
// event ids.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

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

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    if (body.recalculate_all && body.tenant_id) {
      const out = await recalcTenant(admin, body.tenant_id as string);
      return jsonResponse({ ok: true, ...out });
    }
    const asset_id = body.asset_id as string;
    if (!asset_id) return jsonError(400, 'BAD_REQUEST', 'asset_id required (or recalculate_all+tenant_id)');
    const out = await recalcOne(admin, asset_id);
    if (!out) return jsonError(404, 'NOT_FOUND', 'asset not found');
    return jsonResponse({ ok: true, ...out });
  } catch (e) {
    return jsonError(500, 'INTERNAL', (e as Error).message);
  }
});

// deno-lint-ignore no-explicit-any
async function recalcTenant(admin: any, tenantId: string): Promise<{ count: number }> {
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

// deno-lint-ignore no-explicit-any
async function recalcOne(admin: any, assetId: string): Promise<{ score: number; previous: number; delta: number; reason: string } | null> {
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
  if (critPoints > 0) { score += critPoints; breakdown.push({ rule: `critical_events_30d×${criticalEvents.length}`, delta: critPoints }); }
  if (highPoints > 0) { score += highPoints; breakdown.push({ rule: `high_events_30d×${highEvents.length}`, delta: highPoints }); }

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

