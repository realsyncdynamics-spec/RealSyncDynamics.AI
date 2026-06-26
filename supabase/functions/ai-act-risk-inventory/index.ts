// ai-act-risk-inventory — CRUD für das Tenant-KI-System-Inventar.
//
// POST /functions/v1/ai-act-risk-inventory   { op, ...payload }
// verify_jwt = true (tenant-scoped)
//
// Operations:
//   - list   { tenant_id }                                → Liste der Einträge des Tenants
//   - get    { id }                                       → Einzeleintrag
//   - create { tenant_id, name, description?, severity, matched_use_cases?,
//             prohibited_triggers?, limited_triggers?, has_prohibited_overlay?,
//             confidence_score?, registry_version?, notes? }
//   - update { id, ...patch }
//   - delete { id }
//
// Jede create-Op loggt zusätzlich in ai_tool_runs (tool_key='ai_act_risk_inventory')
// für die Audit-Spur — analog zum Pflichtfeld aus CLAUDE.md
// ("jeder externe Call wird in ai_tool_runs / workflow_runs geloggt").

import { createClient, SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';

type Severity = 'prohibited' | 'high' | 'limited' | 'minimal';
const SEVERITIES: readonly Severity[] = ['prohibited', 'high', 'limited', 'minimal'] as const;

interface InventoryRow {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  severity: Severity;
  matched_use_cases: unknown;
  prohibited_triggers: unknown;
  limited_triggers: unknown;
  has_prohibited_overlay: boolean;
  confidence_score: number | null;
  registry_version: string | null;
  notes: string | null;
  classified_by: string | null;
  created_at: string;
  updated_at: string;
}

interface BaseRequest {
  op: 'list' | 'get' | 'create' | 'update' | 'delete';
  tenant_id?: string;
  id?: string;
  name?: string;
  description?: string;
  severity?: Severity;
  matched_use_cases?: unknown;
  prohibited_triggers?: unknown;
  limited_triggers?: unknown;
  has_prohibited_overlay?: boolean;
  confidence_score?: number;
  registry_version?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST')    return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');
  }

  let body: BaseRequest;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  if (!body.op) return jsonError(400, 'BAD_REQUEST', 'op is required');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // JWT verifizieren via anon-Client
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  // Für list/get/create brauchen wir tenant_id (bei get/update/delete wird er aus der Row gezogen).
  let tenantIdForCheck: string | null = null;

  if (body.op === 'list' || body.op === 'create') {
    if (!body.tenant_id || !isUuid(body.tenant_id)) {
      return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
    }
    tenantIdForCheck = body.tenant_id;
  } else if (body.op === 'get' || body.op === 'update' || body.op === 'delete') {
    if (!body.id || !isUuid(body.id)) {
      return jsonError(400, 'BAD_REQUEST', 'id required');
    }
    const { data: existing, error: e } = await admin
      .from('ai_act_risk_inventory')
      .select('tenant_id')
      .eq('id', body.id)
      .maybeSingle();
    if (e)            return jsonError(500, 'DB_ERROR', e.message);
    if (!existing)    return jsonError(404, 'NOT_FOUND', 'Eintrag nicht gefunden');
    tenantIdForCheck = (existing as { tenant_id: string }).tenant_id;
  }

  // Membership-Check (für alle Operationen).
  if (tenantIdForCheck) {
    const { data: member, error: mErr } = await userClient
      .from('memberships')
      .select('id')
      .eq('tenant_id', tenantIdForCheck)
      .eq('user_id', userId)
      .maybeSingle();
    if (mErr)     return jsonError(500, 'DB_ERROR', mErr.message);
    if (!member)  return jsonError(403, 'FORBIDDEN', 'not a member of this tenant');
  }

  try {
    switch (body.op) {
      case 'list':   return await opList(admin, tenantIdForCheck!);
      case 'get':    return await opGet(admin, body.id!);
      case 'create': return await opCreate(admin, tenantIdForCheck!, userId, body);
      case 'update': return await opUpdate(admin, body.id!, body);
      case 'delete': return await opDelete(admin, body.id!);
      default:       return jsonError(400, 'BAD_REQUEST', `unknown op: ${String(body.op)}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return jsonError(500, 'INTERNAL_ERROR', msg);
  }
});

async function opList(admin: SupabaseClient, tenantId: string): Promise<Response> {
  const { data, error } = await admin
    .from('ai_act_risk_inventory')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });
  if (error) return jsonError(500, 'DB_ERROR', error.message);
  return jsonResponse({ ok: true, items: data as InventoryRow[] });
}

async function opGet(admin: SupabaseClient, id: string): Promise<Response> {
  const { data, error } = await admin
    .from('ai_act_risk_inventory')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error)  return jsonError(500, 'DB_ERROR', error.message);
  if (!data)  return jsonError(404, 'NOT_FOUND', 'Eintrag nicht gefunden');
  return jsonResponse({ ok: true, item: data as InventoryRow });
}

async function opCreate(
  admin: SupabaseClient,
  tenantId: string,
  userId: string,
  body: BaseRequest,
): Promise<Response> {
  const name = (body.name ?? '').trim();
  if (!name)                            return jsonError(400, 'BAD_REQUEST', 'name required');
  if (name.length > 200)                return jsonError(400, 'BAD_REQUEST', 'name max 200 chars');
  if (!body.severity || !SEVERITIES.includes(body.severity)) {
    return jsonError(400, 'BAD_REQUEST', `severity must be one of: ${SEVERITIES.join(', ')}`);
  }

  const row = {
    tenant_id: tenantId,
    name,
    description: trimOrNull(body.description),
    severity: body.severity,
    matched_use_cases:    body.matched_use_cases    ?? [],
    prohibited_triggers:  body.prohibited_triggers  ?? [],
    limited_triggers:     body.limited_triggers     ?? [],
    has_prohibited_overlay: body.has_prohibited_overlay ?? false,
    confidence_score:     normalizeScore(body.confidence_score),
    registry_version:     trimOrNull(body.registry_version),
    notes:                trimOrNull(body.notes),
    classified_by:        userId,
  };

  const started = Date.now();
  const { data, error } = await admin
    .from('ai_act_risk_inventory')
    .insert(row)
    .select('*')
    .single();

  // Audit-Spur in ai_tool_runs — best-effort, blockiert kein Erfolg.
  await admin.from('ai_tool_runs').insert({
    tenant_id: tenantId,
    tool_key:  'ai_act_risk_inventory',
    user_id:   userId,
    status:    error ? 'error' : 'success',
    duration_ms: Date.now() - started,
    error_code: error ? 'DB_ERROR'        : null,
    error_message: error ? error.message  : null,
    metadata: {
      op: 'create',
      severity: body.severity,
      registry_version: row.registry_version,
      use_case_count: Array.isArray(row.matched_use_cases) ? row.matched_use_cases.length : 0,
    },
  }).then(() => {/* ignore audit-log failures */}, () => {/* swallow */});

  if (error) return jsonError(500, 'DB_ERROR', error.message);
  return jsonResponse({ ok: true, item: data as InventoryRow }, 201);
}

async function opUpdate(admin: SupabaseClient, id: string, body: BaseRequest): Promise<Response> {
  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const n = body.name.trim();
    if (!n || n.length > 200) return jsonError(400, 'BAD_REQUEST', 'invalid name');
    patch.name = n;
  }
  if (body.description !== undefined)            patch.description = trimOrNull(body.description);
  if (body.severity !== undefined) {
    if (!SEVERITIES.includes(body.severity))      return jsonError(400, 'BAD_REQUEST', 'invalid severity');
    patch.severity = body.severity;
  }
  if (body.matched_use_cases !== undefined)      patch.matched_use_cases    = body.matched_use_cases;
  if (body.prohibited_triggers !== undefined)    patch.prohibited_triggers  = body.prohibited_triggers;
  if (body.limited_triggers !== undefined)       patch.limited_triggers     = body.limited_triggers;
  if (body.has_prohibited_overlay !== undefined) patch.has_prohibited_overlay = !!body.has_prohibited_overlay;
  if (body.confidence_score !== undefined)       patch.confidence_score     = normalizeScore(body.confidence_score);
  if (body.registry_version !== undefined)       patch.registry_version     = trimOrNull(body.registry_version);
  if (body.notes !== undefined)                  patch.notes                = trimOrNull(body.notes);

  if (Object.keys(patch).length === 0) {
    return jsonError(400, 'BAD_REQUEST', 'no fields to update');
  }

  const { data, error } = await admin
    .from('ai_act_risk_inventory')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) return jsonError(500, 'DB_ERROR', error.message);
  return jsonResponse({ ok: true, item: data as InventoryRow });
}

async function opDelete(admin: SupabaseClient, id: string): Promise<Response> {
  const { error } = await admin.from('ai_act_risk_inventory').delete().eq('id', id);
  if (error) return jsonError(500, 'DB_ERROR', error.message);
  return jsonResponse({ ok: true });
}

function trimOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length ? t : null;
}

function normalizeScore(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

