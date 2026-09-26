// Request handler for ai-act-auto-classify. index.ts wires in the canonical
// resolver `requireAuthAndTenant` from _shared/auth.ts; tests inject a fake.
// No Deno / jsr imports here, so the handler stays vitest-importable.
//
// Order is security-relevant and pinned by test/edge/ai-act-auto-classify-authz.test.ts:
//   1. reject non-user bearers (missing / anon / service_role)   → 401, no DB
//   2. validate body                                              → 400, no DB
//   3. requireAuthAndTenant(req, tenant claim, owner|admin)       → 401 / 403
//      — only after this the service_role client (auth.admin) exists
//   4. ai_system must belong to auth.tenantId                     → 404
//   5. classify + write, every write scoped to auth.tenantId      → 200

import { handleOptions, jsonResponse, jsonError } from '../_shared/gateway.ts';
import {
  WRITE_ROLES,
  checkSystemOwnership,
  classifySystem,
  isRejection,
  parseClassifyBody,
  rejectNonUserBearer,
  type AiSystemRow,
} from './logic.ts';

/**
 * Structural subset of the service_role SupabaseClient used here. Kept loose
 * on purpose (PostgREST builder types are deep generics); the real client
 * comes from requireAuthAndTenant as `auth.admin`.
 */
// deno-lint-ignore no-explicit-any
export type AdminClient = { from(table: string): any };

export interface VerifiedAuth {
  user: { id: string };
  /** Tenant id AFTER the membership check — the only tenant authority. */
  tenantId: string;
  /** service_role client — exists only after the membership check. */
  admin: AdminClient;
}

export type RequireAuthAndTenant = (
  req: Request,
  clientTenantId: string | null | undefined,
  allowedRoles?: string[],
) => Promise<VerifiedAuth | Response>;

export interface HandlerDeps {
  requireAuthAndTenant: RequireAuthAndTenant;
  now?: () => Date;
}

function reject(r: { status: number; code: string; message: string }): Response {
  return jsonError(r.status, r.code, r.message);
}

export async function handleAutoClassify(req: Request, deps: HandlerDeps): Promise<Response> {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  // 1. Cheap reject in front of the canonical resolver (never grants access).
  const bearer = rejectNonUserBearer(req.headers.get('Authorization'));
  if (bearer) return reject(bearer);

  // 2. Body validation.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError(400, 'BAD_REQUEST', 'invalid json');
  }
  const parsed = parseClassifyBody(raw);
  if (isRejection(parsed)) return reject(parsed);

  // 3. Canonical identity + membership check (401 / 403).
  const auth = await deps.requireAuthAndTenant(req, parsed.tenantIdClaim, [...WRITE_ROLES]);
  if (auth instanceof Response) return auth;
  const tenantId = auth.tenantId;
  const admin = auth.admin;
  const aiSystemId = parsed.aiSystemId;

  // 4. The ai_system must belong to the verified tenant.
  const { data: system, error: sysErr } = await admin
    .from('ai_systems')
    .select('id, tenant_id, purpose, data_types')
    .eq('id', aiSystemId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (sysErr) {
    console.error('[ai-act-auto-classify] ai_systems read failed', sysErr);
    return jsonError(500, 'DB_ERROR', 'failed to load AI system');
  }
  const ownership = checkSystemOwnership(system as AiSystemRow | null, aiSystemId, tenantId);
  if (ownership) return reject(ownership);

  // 5. Classify + persist. Every read/write is scoped to the verified tenant.
  const result = classifySystem(system as AiSystemRow);
  const nowIso = (deps.now ? deps.now() : new Date()).toISOString();

  const fields = {
    indicators: result.indicators,
    overall_risk_score: result.riskScore,
    classification: result.classification,
    recommendation: result.recommendation,
    is_high_risk_annex_iii: result.classification === 'high_risk',
    assessment_date: nowIso,
    assessed_by: auth.user.id,
  };

  // ai_act_assessments has no UNIQUE(ai_system_id), so ON CONFLICT
  // (ai_system_id) cannot work — look up the latest row explicitly instead.
  const { data: existing, error: exErr } = await admin
    .from('ai_act_assessments')
    .select('id')
    .eq('ai_system_id', aiSystemId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (exErr) {
    console.error('[ai-act-auto-classify] ai_act_assessments read failed', exErr);
    return jsonError(500, 'DB_ERROR', 'failed to load assessment');
  }

  const existingId = (existing as { id?: string } | null)?.id;
  const write = existingId
    ? await admin
      .from('ai_act_assessments')
      .update({ ...fields, last_reassessed_at: nowIso, updated_at: nowIso })
      .eq('id', existingId)
      .eq('tenant_id', tenantId)
      .select('id')
      .single()
    : await admin
      .from('ai_act_assessments')
      .insert({ ...fields, ai_system_id: aiSystemId, tenant_id: tenantId })
      .select('id')
      .single();
  const assessment = write.data as { id: string } | null;
  if (write.error || !assessment) {
    console.error('[ai-act-auto-classify] assessment write failed', write.error);
    return jsonError(500, 'DB_ERROR', 'failed to write assessment');
  }

  const { error: linkErr } = await admin
    .from('ai_systems')
    .update({ latest_assessment_id: assessment.id })
    .eq('id', aiSystemId)
    .eq('tenant_id', tenantId);
  if (linkErr) {
    console.error('[ai-act-auto-classify] ai_systems link failed', linkErr);
    return jsonError(500, 'DB_ERROR', 'assessment written, linking to AI system failed');
  }

  return jsonResponse(
    {
      ok: true,
      assessment_id: assessment.id,
      classification: result.classification,
      risk_score: result.riskScore,
      recommendation: result.recommendation,
      indicators: result.indicators,
    },
    200,
  );
}
