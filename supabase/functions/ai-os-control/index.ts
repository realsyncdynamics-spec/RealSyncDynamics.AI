// ai-os-control — serverseitiges Gateway des internen AI-OS (/admin/ai-os).
//
// POST /functions/v1/ai-os-control
// Authorization: Bearer <user JWT>   (verify_jwt = true)
// Body: { op: string, confirmed?: boolean, ...params }
//
// Ablauf je Anfrage:
//   1. Nutzer aus dem JWT, Plattform-Rolle über is_platform_operator() mit dem
//      Nutzer-JWT (ADR 0011 D5) — nie aus Body, URL oder Browser-Speicher.
//   2. Operation → registrierte Tool-Aktion → authorizeAction() aus
//      packages/ai-os-core (Default-Deny, kritisch nie, Schreiben nur mit AAL2
//      + Bestätigung, Agent-Positivliste).
//   3. Schreibaktionen: Protokolleintrag `requested` in ai_os_action_log
//      VOR der Ausführung. Scheitert das Protokoll, wird nicht ausgeführt
//      (fail-closed). Danach `succeeded` bzw. `failed`.
//   4. GitHub-Zugriff nur mit AI_OS_GITHUB_TOKEN (Function-Secret) und einem
//      Aufrufbudget je Operation. Der Token verlässt die Function nie.
//
// Service-Role wird nur für Kosten-Aggregate, die Operator-Anzahl und das
// Protokoll genutzt — nie für Entscheidungen über Berechtigungen.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleOptions, jsonResponse } from '../_shared/gateway.ts';
import { decodeAalFromJwt } from '../_shared/requireAal2.ts';
import { authorizeAction, getToolAction } from '../../../packages/ai-os-core/src/index.ts';
import { makeGithubFactory, OPERATIONS } from './ops.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

const DENY_STATUS: Record<string, number> = {
  unknown_action: 400,
  not_operator: 403,
  not_executable_here: 403,
  not_live: 403,
  agent_not_allowed: 403,
  critical_requires_release: 403,
  mfa_required: 403,
  confirmation_required: 428,
};

interface LogRow {
  request_id: string;
  actor_user_id: string;
  action_id: string;
  agent_id: string | null;
  action_class: 'read' | 'write';
  phase: 'requested' | 'succeeded' | 'failed' | 'denied';
  target: string | null;
  detail: Record<string, unknown>;
}

async function writeLog(admin: Db, row: LogRow): Promise<boolean> {
  const { error } = await admin.from('ai_os_action_log').insert(row);
  if (error) {
    console.error(JSON.stringify({ level: 'error', scope: 'ai_os_log_failed', action: row.action_id, phase: row.phase, error: error.message }));
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return jsonResponse({ error: 'missing_authorization' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
  const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const user = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: userResp, error: userErr } = await user.auth.getUser();
  if (userErr || !userResp.user) return jsonResponse({ error: 'invalid_token' }, 401);
  const actor = userResp.user;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return jsonResponse({ error: 'invalid_body' }, 400);

  const { data: isOperator, error: opErr } = await user.rpc('is_platform_operator');
  if (opErr) return jsonResponse({ error: 'role_check_failed' }, 503);
  const aal = decodeAalFromJwt(auth);
  const principal = { isOperator: isOperator === true, aal };

  const op = typeof body.op === 'string' ? body.op : '';

  // Sitzungsstatus: was das UI anzeigen darf, ohne eine Aktion auszulösen.
  if (op === 'session') {
    if (!principal.isOperator) return jsonResponse({ operator: false }, 403);
    return jsonResponse({
      operator: true,
      aal,
      githubConfigured: !!Deno.env.get('AI_OS_GITHUB_TOKEN'),
      repo: Deno.env.get('AI_OS_GITHUB_REPO') ?? 'realsyncdynamics-spec/RealSyncDynamics.AI',
    });
  }

  const spec = OPERATIONS[op];
  if (!spec) return jsonResponse({ error: 'unknown_op' }, 400);

  const agentId = spec.agentFor?.(body);
  const decision = authorizeAction(principal, { actionId: spec.actionId, agentId, confirmed: body.confirmed === true });
  const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });
  const requestId = crypto.randomUUID();

  if (!decision.allow) {
    // Abgelehnte Schreibversuche eines Operators protokollieren (best effort);
    // Nicht-Operatoren erzeugen keine Einträge (kein Log-Flooding).
    if (principal.isOperator && getToolAction(spec.actionId)?.class === 'write') {
      await writeLog(admin, {
        request_id: requestId, actor_user_id: actor.id, action_id: spec.actionId, agent_id: agentId ?? null,
        action_class: 'write', phase: 'denied', target: null, detail: { reason: decision.reason },
      });
    }
    return jsonResponse({ error: 'denied', reason: decision.reason, message: decision.message }, DENY_STATUS[decision.reason] ?? 403);
  }

  const actionClass = decision.action.class === 'write' ? 'write' : 'read';
  const base = {
    request_id: requestId,
    actor_user_id: actor.id,
    action_id: decision.action.id,
    agent_id: agentId ?? null,
    action_class: actionClass,
  } as const;

  if (decision.mustAudit) {
    const logged = await writeLog(admin, { ...base, phase: 'requested', target: null, detail: { op } });
    if (!logged) {
      return jsonResponse({
        error: 'audit_unavailable',
        message: 'Aktionsprotokoll nicht verfügbar — Schreibaktion wurde nicht ausgeführt.',
      }, 503);
    }
  }

  const ctx = { user, admin, params: body, github: makeGithubFactory(spec.maxGithubCalls), now: new Date() };
  try {
    const result = await spec.run(ctx);
    if (decision.mustAudit) {
      const ok = (result.status ?? 200) < 400;
      await writeLog(admin, {
        ...base,
        phase: ok ? 'succeeded' : 'failed',
        target: result.target ?? null,
        detail: ok ? (result.auditDetail ?? {}) : { status: result.status, error: result.body.error ?? null },
      });
    }
    console.log(JSON.stringify({ scope: 'ai_os_control', op, action: decision.action.id, request_id: requestId, status: result.status ?? 200 }));
    return jsonResponse({ ...result.body, requestId }, result.status ?? 200);
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : 'unbekannter Fehler';
    if (decision.mustAudit) {
      await writeLog(admin, { ...base, phase: 'failed', target: null, detail: { error: message.slice(0, 300) } });
    }
    console.error(JSON.stringify({ level: 'error', scope: 'ai_os_control', op, request_id: requestId, error: message }));
    return jsonResponse({ error: 'operation_failed', message, requestId }, 502);
  }
});
