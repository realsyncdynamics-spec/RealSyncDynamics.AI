// Hermes Governance-Brief Runner — Persistenz-Schicht für die Edge-Function.
//
// Erzeugt pro Tenant einen tagesaktuellen Governance-Brief: sammelt den
// Status (offene Pflichten, Sentinel-Beobachtungen, KPI-Abdeckung), ruft den
// LLM über ai-gateway (Provider-Kette LM-Studio EU-lokal zuerst), validiert
// die Antwort und schreibt sie idempotent nach hermes_daily_briefs.
//
// EU-Souveränität: Aufruf läuft über ai-gateway (kein direkter US-Routing-
// Pfad). Quota wird respektiert (1 Aufruf/Tag/Tenant; Skip bei Limit).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { checkTenantQuota, recordChatHistory, type AdminLike } from '../llm-quota.ts';
import {
  buildBriefPrompt,
  validateBriefPayload,
  type BriefContext,
  type BriefPayload,
} from './governanceBrief.ts';

const AGENT = 'hermes';
const GENERATED_BY = 'hermes-governance-agent';

export interface BriefResult {
  id: string;
  skipped?: 'exists' | 'quota';
}

export async function generateGovernanceBriefForTenant(
  admin: SupabaseClient,
  tenantId: string,
  now: Date,
): Promise<BriefResult | null> {
  const briefDate = now.toISOString().slice(0, 10);

  // 1. Idempotenz: existiert heute bereits ein Brief mit Narrativ? → Skip (kein LLM-Call).
  const existing = await admin
    .from('hermes_daily_briefs')
    .select('id,narrative_de')
    .eq('tenant_id', tenantId)
    .eq('brief_date', briefDate)
    .limit(1);
  const existingRow = existing.data?.[0] as { id: string; narrative_de: string | null } | undefined;
  if (existingRow && existingRow.narrative_de) {
    return { id: existingRow.id, skipped: 'exists' };
  }

  // 2. Quota respektieren (1 LLM-Aufruf/Tag/Tenant).
  const quota = await checkTenantQuota(admin as unknown as AdminLike, tenantId);
  if (!quota.allowed) return null;

  // 3. Kontext sammeln.
  const ctx = await gatherContext(admin, tenantId, briefDate);

  // 4. LLM über ai-gateway.
  const { system, user } = buildBriefPrompt(ctx);
  const { payload, provider, model, usage } = await callGateway(system, user);

  // 5. Upsert (idempotent über UNIQUE(tenant_id, brief_date)).
  const { data: upserted, error: upErr } = await admin
    .from('hermes_daily_briefs')
    .upsert(
      {
        tenant_id: tenantId,
        brief_date: briefDate,
        narrative_de: payload.narrative_de,
        top_3_risks: payload.top_3_risks,
        recommended_actions_today: payload.recommended_actions_today,
        generated_by: GENERATED_BY,
      },
      { onConflict: 'tenant_id,brief_date' },
    )
    .select('id')
    .single();
  if (upErr) throw new Error(`brief upsert: ${upErr.message}`);
  const briefId = (upserted as { id: string }).id;

  // 6. Substrat-Audit (wie der Sentinel: append-only agent_events).
  await admin.from('agent_events').insert({
    tenant_id: tenantId,
    event_type: 'brief.created',
    subject_type: 'brief',
    subject_id: briefId,
    agent: AGENT,
    payload: { brief_date: briefDate, provider, model, risks: payload.top_3_risks.length },
  });

  // 7. LLM-Verlauf (best-effort; zählt gegen das Monatslimit).
  await recordChatHistory(admin as unknown as AdminLike, {
    tenant_id: tenantId,
    user_id: null,
    session_id: null,
    op: 'chat',
    provider,
    model,
    query_text: system.slice(0, 4000),
    response_summary: payload.narrative_de.slice(0, 280),
    input_tokens: usage.input_tokens ?? null,
    output_tokens: usage.output_tokens ?? null,
    correlation_id: briefId,
  });

  return { id: briefId };
}

async function gatherContext(admin: SupabaseClient, tenantId: string, briefDate: string): Promise<BriefContext> {
  const nowIso = new Date().toISOString();
  const [
    tenantRes,
    incRes,
    dpiaRes,
    dsrRes,
    vendorRes,
    apprRes,
    obsRes,
    kpiRes,
  ] = await Promise.all([
    admin.from('tenants').select('name').eq('id', tenantId).limit(1),
    admin.from('incidents').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).not('status', 'in', '("resolved","reported_to_authority")'),
    admin.from('dpias').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('status', ['draft', 'in_review']),
    admin.from('dsr_requests').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('status', ['received', 'in_progress', 'pending_verification', 'overdue'])
      .lt('deadline_at', nowIso),
    admin.from('vendors').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).in('dpa_status', ['none', 'requested', 'expired']),
    admin.from('governance_approvals').select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId).eq('status', 'pending'),
    admin.from('agent_observations').select('severity,title')
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
    admin.rpc('governance_kpi_latest_snapshot', { p_tenant_id: tenantId }),
  ]);

  const kpi = (Array.isArray(kpiRes.data) ? kpiRes.data[0] : kpiRes.data) as
    | { assets_with_mappings_percent?: number; assets_with_evidence_percent?: number; policies_enabled_percent?: number }
    | null
    | undefined;

  return {
    tenant_name: (tenantRes.data?.[0] as { name?: string } | undefined)?.name ?? null,
    brief_date: briefDate,
    open_incidents: incRes.count ?? 0,
    overdue_dsr: dsrRes.count ?? 0,
    open_dpias: dpiaRes.count ?? 0,
    vendors_no_dpa: vendorRes.count ?? 0,
    pending_approvals: apprRes.count ?? 0,
    mappings_percent: kpi?.assets_with_mappings_percent ?? null,
    evidence_percent: kpi?.assets_with_evidence_percent ?? null,
    policies_enabled_percent: kpi?.policies_enabled_percent ?? null,
    observations: (obsRes.data ?? []).map((o) => ({
      severity: String((o as { severity?: string }).severity ?? 'info'),
      title: String((o as { title?: string }).title ?? ''),
    })),
  };
}

interface GatewayResult {
  payload: BriefPayload;
  provider: string;
  model: string;
  usage: { input_tokens?: number; output_tokens?: number };
}

// Aufruf des internen ai-gateway (Muster aus remediation-agent): anon-Key +
// apikey-Header, op 'extract_json' mit strict-json-Profil für verlässliches JSON.
async function callGateway(system: string, user: string): Promise<GatewayResult> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-gateway`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${ANON}`,
      'apikey': ANON,
    },
    body: JSON.stringify({
      op: 'extract_json',
      feature: 'governance_brief_daily',
      task_type: 'governance_reasoning',
      model_profile: 'strict-json',
      input: { system, user },
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`ai-gateway ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const json = await resp.json() as {
    ok?: boolean;
    output?: unknown;
    provider?: string;
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { message?: string };
  };
  if (!json.ok) throw new Error(json.error?.message ?? 'ai-gateway returned not-ok');

  let parsed: unknown = json.output;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { throw new Error('ai-gateway output is not valid JSON'); }
  }

  return {
    payload: validateBriefPayload(parsed),
    provider: json.provider ?? 'unknown',
    model: json.model ?? 'unknown',
    usage: json.usage ?? {},
  };
}
