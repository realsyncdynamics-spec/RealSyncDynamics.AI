// Governance Remediate — Template-driven code-snippet generator.
//
// POST /functions/v1/governance-remediate
// Authorization: Bearer <user JWT>
// op: list (tenant_id) | generate (tenant_id, asset_id, pattern, params)
//   | mark_applied (id, applied_by) | reject (id) | supersede (id)
//
// Generates copy-paste-ready remediation snippets for 5 patterns:
//   - csp_header_block       Content-Security-Policy block for a tracker host
//   - consent_wrapper        Wrap a <script> tag with a CMP gate
//   - font_self_host         Replace Google Fonts <link> with self-hosted
//   - tracker_dom_remove     Tiny JS that strips a tracker tag from the DOM
//   - dsgvo_footer_block     AVV + DSB-Kontakt-Block for footers
//
// Never auto-applies. Operator copies snippet from the UI and applies
// in their codebase, then clicks "Mark applied".

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { audit } from '../_shared/auditLog.ts';
import { renderTemplate, KNOWN_PATTERNS, type Pattern } from '../_shared/remediation-templates.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonError(405, 'BAD_REQUEST', 'POST only');

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonError(401, 'UNAUTHORIZED', 'missing bearer token');

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userResp.user) return jsonError(401, 'UNAUTHORIZED', 'invalid token');
  const userId = userResp.user.id;
  const userEmail = userResp.user.email ?? null;

  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  try {
    switch (body.op) {
      case 'list':         return await handleList(admin, userId, body);
      case 'generate':     return await handleGenerate(admin, userId, userEmail, body);
      case 'mark_applied': return await handleMarkApplied(admin, userId, userEmail, body);
      case 'reject':       return await handleReject(admin, userId, userEmail, body);
      case 'supersede':    return await handleSupersede(admin, userId, userEmail, body);
      default:             return jsonError(400, 'BAD_REQUEST', 'unknown op');
    }
  } catch (e) { return jsonError(500, 'INTERNAL', (e as Error).message); }
});

// deno-lint-ignore no-explicit-any
async function handleList(admin: any, userId: string, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!(await isMember(admin, userId, tenant_id))) return jsonError(403, 'FORBIDDEN', 'no membership in this tenant');

  let q = admin.from('remediation_snippets')
    .select('*, asset:governance_assets(id, name, asset_type)')
    .eq('tenant_id', tenant_id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (body.status) q = q.eq('status', body.status);
  if (body.asset_id) q = q.eq('asset_id', body.asset_id);
  const { data, error } = await q;
  if (error) throw error;
  return json({ ok: true, snippets: data ?? [] });
}

// deno-lint-ignore no-explicit-any
async function handleGenerate(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const tenant_id = body.tenant_id as string;
  const pattern = body.pattern as Pattern;
  const params = (body.params as Record<string, string> | undefined) ?? {};

  if (!tenant_id) return jsonError(400, 'BAD_REQUEST', 'tenant_id required');
  if (!KNOWN_PATTERNS.includes(pattern)) {
    return jsonError(400, 'BAD_REQUEST', `pattern must be one of ${KNOWN_PATTERNS.join('|')}`);
  }
  if (!(await isOwnerOrAdmin(admin, userId, tenant_id))) {
    return jsonError(403, 'FORBIDDEN', 'must be owner or admin');
  }

  // Cross-tenant guard for asset_id.
  const asset_id = body.asset_id as string | undefined;
  if (asset_id) {
    const { data: asset } = await admin.from('governance_assets').select('tenant_id').eq('id', asset_id).maybeSingle();
    if (!asset) return jsonError(404, 'NOT_FOUND', 'asset not found');
    if (asset.tenant_id !== tenant_id) return jsonError(403, 'CROSS_TENANT', 'asset belongs to another tenant');
  }
  const event_id = body.event_id as string | undefined;
  if (event_id) {
    const { data: ev } = await admin.from('governance_events').select('tenant_id').eq('id', event_id).maybeSingle();
    if (!ev) return jsonError(404, 'NOT_FOUND', 'event not found');
    if (ev.tenant_id !== tenant_id) return jsonError(403, 'CROSS_TENANT', 'event belongs to another tenant');
  }

  let rendered;
  try {
    rendered = renderTemplate(pattern, params);
  } catch (e) {
    return jsonError(400, 'BAD_TEMPLATE_PARAMS', (e as Error).message);
  }

  const { data, error } = await admin.from('remediation_snippets').insert({
    tenant_id,
    asset_id: asset_id ?? null,
    event_id: event_id ?? null,
    pattern,
    target_lang: rendered.target_lang,
    title: rendered.title,
    rationale: rendered.rationale,
    snippet: rendered.snippet,
    applies_to: rendered.applies_to ?? null,
    regulation_refs: rendered.references ?? [],
    status: 'suggested',
    metadata: { params },
  }).select('*').single();
  if (error) throw error;

  await audit(admin, {
    tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'remediation.generate', target_type: 'remediation_snippet', target_id: data.id,
    payload: { pattern, asset_id, event_id },
  });
  return json({ ok: true, snippet: data });
}

// deno-lint-ignore no-explicit-any
async function handleMarkApplied(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('remediation_snippets').select('tenant_id').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'snippet not found');
  if (!(await isMember(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'no membership');
  const appliedBy = (body.applied_by as string) ?? userEmail ?? userId;
  const { error } = await admin.from('remediation_snippets')
    .update({ status: 'applied', applied_at: new Date().toISOString(), applied_by: appliedBy })
    .eq('id', id);
  if (error) throw error;
  await audit(admin, {
    tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'remediation.mark_applied', target_type: 'remediation_snippet', target_id: id,
    payload: { applied_by: appliedBy },
  });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function handleReject(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('remediation_snippets').select('tenant_id').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'snippet not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'owner/admin only');
  const { error } = await admin.from('remediation_snippets').update({ status: 'rejected' }).eq('id', id);
  if (error) throw error;
  await audit(admin, {
    tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'remediation.reject', target_type: 'remediation_snippet', target_id: id,
    payload: { reason: body.reason ?? null },
  });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function handleSupersede(admin: any, userId: string, userEmail: string | null, body: Record<string, unknown>) {
  const id = body.id as string;
  if (!id) return jsonError(400, 'BAD_REQUEST', 'id required');
  const { data: row } = await admin.from('remediation_snippets').select('tenant_id').eq('id', id).maybeSingle();
  if (!row) return jsonError(404, 'NOT_FOUND', 'snippet not found');
  if (!(await isOwnerOrAdmin(admin, userId, row.tenant_id))) return jsonError(403, 'FORBIDDEN', 'owner/admin only');
  const { error } = await admin.from('remediation_snippets').update({ status: 'superseded' }).eq('id', id);
  if (error) throw error;
  await audit(admin, {
    tenant_id: row.tenant_id, actor_user_id: userId, actor_email: userEmail,
    action: 'remediation.supersede', target_type: 'remediation_snippet', target_id: id,
    payload: {},
  });
  return json({ ok: true });
}

// deno-lint-ignore no-explicit-any
async function isMember(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return !!data;
}

// deno-lint-ignore no-explicit-any
async function isOwnerOrAdmin(admin: any, userId: string, tenantId: string): Promise<boolean> {
  const { data } = await admin.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
  return data?.role === 'owner' || data?.role === 'admin';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'content-type': 'application/json' } });
}
function jsonError(status: number, code: string, message: string): Response {
  return json({ ok: false, error: { code, message } }, status);
}
