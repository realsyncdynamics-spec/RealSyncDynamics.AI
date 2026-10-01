// browser-execute — Governed Browser Runtime (Deno-Verdrahtung).
//
// POST /functions/v1/browser-execute   Authorization: Bearer <user JWT>
//   { op: 'health',         tenant_id }
//   { op: 'capabilities',   tenant_id }
//   { op: 'session_create', tenant_id, mode?, initial_url? }
//   { op: 'session_get' | 'session_frame' | 'session_close', tenant_id, session_id }
//   { op: 'session_list',   tenant_id }
//   { op: 'act',            tenant_id, session_id, action, approval_id?, initiated_by? }
//   { op: 'approval_status' | 'approval_cancel', tenant_id, approval_id }
//   { op: 'kill_all',       tenant_id }                       (owner/admin)
//   { op: 'plan',           tenant_id, task, current_url? }   (browser_task_planner)
//
// Autoritätskette und Fehlerverhalten: handler.ts. Der Mandant stammt aus
// JWT → memberships; tenant_id im Body wählt nur unter den eigenen
// Mitgliedschaften aus. service_role erst nach bestätigter Mitgliedschaft.
//
// Secrets (nur Function-Env, nie geloggt):
//   PLAYWRIGHT_SCANNER_URL, PLAYWRIGHT_SCANNER_KEY  — Executor (deploy/playwright-scanner)
//   SUPABASE_SERVICE_ROLE_KEY  — (Plattform) Quelle des HMAC-Schlüssels für
//                                Freigabe-Fingerprints, domänengetrennt abgeleitet
// Optional:
//   BROWSER_EXECUTOR_ID                  — Kennung für browser_executor_status (Default 'default')
//   BROWSER_RUNTIME_KILL_SWITCH=on       — globale Notabschaltung (alle Aktionen DENY)
//   BROWSER_PRIVATE_HOST_ALLOWLIST       — administrativ freigegebene private Hosts (host[:port],…)

import { requireUser } from '../_shared/auth.ts';
import { jsonError, jsonResponse } from '../_shared/gateway.ts';
import { AiInvokeError, runAiTool } from '../_shared/ai.ts';
import { MAX_TASK_CHARS, buildPlannerInput, parseBrowserPlan } from '../_shared/browser-plan.ts';
import { hasFeature, loadEntitlementsForTenant } from '../_shared/entitlements.ts';
import { loadSnapshot } from '../_shared/pdp/decide.ts';
import { evaluateSnapshot, type DecisionRequest } from '../_shared/pdp/core.ts';
import { codeForAuthStatus } from '../_shared/browser-runtime/errors.ts';
import { createExecutorClient } from '../_shared/browser-runtime/executor.ts';
import { overlayFromPdpResult } from '../_shared/browser-runtime/policy.ts';
import { actionTarget, deriveFingerprintKey } from '../_shared/browser-runtime/actions.ts';
import { parseAllowlist } from '../_shared/browser-runtime/url.ts';
import { BROWSER_RUNTIME_ENTITLEMENT, createBrowserExecuteHandler, type VerifiedActor } from './handler.ts';
import { createBrowserRuntimeRepo } from './repo.ts';

// deno-lint-ignore no-explicit-any
type Admin = any;
const admins = new WeakMap<VerifiedActor, Admin>();

const scannerUrl = Deno.env.get('PLAYWRIGHT_SCANNER_URL');
const scannerKey = Deno.env.get('PLAYWRIGHT_SCANNER_KEY');
const executor = createExecutorClient(
  scannerUrl && scannerKey
    ? { baseUrl: scannerUrl, apiKey: scannerKey, executorId: Deno.env.get('BROWSER_EXECUTOR_ID') ?? 'default' }
    : null,
  (input, init) => fetch(input, init),
);

// Fail closed beim Start: ohne Schlüssel keine Freigaben (Top-Level-Await).
const fingerprintKey = await deriveFingerprintKey(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

function adminOf(actor: VerifiedActor): Admin {
  const admin = admins.get(actor);
  if (!admin) throw new Error('actor without verified admin client');
  return admin;
}

Deno.serve(createBrowserExecuteHandler({
  async resolveActor(req, tenantId) {
    const auth = await requireUser(req);
    if (auth instanceof Response) return codeForAuthStatus(auth.status);
    if (!tenantId) return 'TENANT_REQUIRED';
    const { data, error } = await auth.admin
      .from('memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (error) return 'INTERNAL_ERROR';
    if (!data?.role) return 'FORBIDDEN';
    const actor: VerifiedActor = { user: { id: auth.user.id, email: auth.user.email ?? null }, tenantId, role: String(data.role) };
    admins.set(actor, auth.admin);
    return actor;
  },

  repo: (actor) => createBrowserRuntimeRepo(adminOf(actor)),

  executor,

  async entitlement(actor) {
    try {
      const ent = await loadEntitlementsForTenant(adminOf(actor), actor.tenantId);
      return hasFeature(ent, BROWSER_RUNTIME_ENTITLEMENT) ? 'granted' : 'denied';
    } catch {
      return 'unavailable';
    }
  },

  async tenantPolicy(actor, action, pageUrl) {
    try {
      const snapshot = await loadSnapshot(adminOf(actor), actor.tenantId);
      let host: string | undefined;
      try { host = pageUrl ? new URL(pageUrl).hostname : undefined; } catch { host = undefined; }
      const request: DecisionRequest = {
        contract: 'v1',
        tenant_id: actor.tenantId,
        principal: { type: 'user', id: actor.user.id, roles: [actor.role] },
        action: { verb: action.type, channel: 'browser_runtime', event_type: 'browser.action', event_source: 'agent_runtime' },
        target: host ? { vendor: host } : undefined,
        payload: { target: actionTarget(action), page_host: host ?? null },
        context: { feature: 'governed_browser_runtime' },
      };
      return overlayFromPdpResult(evaluateSnapshot(snapshot, request));
    } catch {
      return { status: 'unavailable', error_code: 'PDP_SNAPSHOT_UNAVAILABLE' };
    }
  },

  async tenantPolicyReady(actor) {
    try {
      await loadSnapshot(adminOf(actor), actor.tenantId);
      return true;
    } catch {
      return false;
    }
  },

  async plan(actor, taskRaw, currentUrlRaw) {
    const task = typeof taskRaw === 'string' ? taskRaw.trim() : '';
    if (!task || task.length > MAX_TASK_CHARS) {
      return jsonError(400, 'VALIDATION_FAILED', `task must be 1..${MAX_TASK_CHARS} chars`);
    }
    const currentUrl = typeof currentUrlRaw === 'string' && /^https?:\/\//i.test(currentUrlRaw)
      ? currentUrlRaw.slice(0, 2000)
      : null;
    try {
      const ai = await runAiTool(
        adminOf(actor),
        actor.tenantId,
        actor.user.id,
        'browser_task_planner',
        buildPlannerInput(task, currentUrl),
        { maxInputChars: 4000, metadata: { source: 'browser-execute.plan' } },
      );
      const plan = parseBrowserPlan(ai.output);
      if (plan.kind === 'invalid') {
        return jsonError(502, 'PLAN_INVALID', plan.error, undefined, { run_id: ai.runId });
      }
      return jsonResponse({ ok: true, run_id: ai.runId, ...plan });
    } catch (e) {
      if (e instanceof AiInvokeError) return jsonError(e.status, e.code, e.message, undefined, e.details);
      return jsonError(500, 'INTERNAL_ERROR', 'browser task planning failed');
    }
  },

  killSwitchEngaged: () => ['on', 'true', '1'].includes((Deno.env.get('BROWSER_RUNTIME_KILL_SWITCH') ?? '').toLowerCase()),
  privateHostAllowlist: parseAllowlist(Deno.env.get('BROWSER_PRIVATE_HOST_ALLOWLIST')),
  fingerprintKey,
  now: () => new Date(),
  uuid: () => crypto.randomUUID(),
  randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  log: (entry) => console.log(JSON.stringify(entry)),
}));
