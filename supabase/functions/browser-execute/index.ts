import { jsonError, jsonResponse, handleOptions } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';
import { AiInvokeError, runAiTool } from '../_shared/ai.ts';
import { MAX_TASK_CHARS, buildPlannerInput, parseBrowserPlan } from '../_shared/browser-plan.ts';
import { EVIDENCE_HASH_METHOD, evidenceContentHash } from '../_shared/evidence-hash.ts';

type BrowserAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'extract'; selector?: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'screenshot' };

interface BrowserExecuteBody {
  op?: 'execute' | 'health' | 'plan';
  tenant_id?: string;
  session_id?: string;
  actions?: BrowserAction[];
  approval_id?: string;
  /** op: 'plan' — Freitext-Aufgabe und optional die aktuelle Seite. */
  task?: string;
  current_url?: string;
}

const MUTATING_ACTIONS = new Set<BrowserAction['type']>(['click', 'type', 'select']);

// Deutlich unter dem Wall-Clock-Limit der Edge Function, damit nach einem
// Timeout noch Zeit bleibt, die Reservierung als executor_failed abzuschliessen.
const EXECUTOR_TIMEOUT_MS = 90_000;

type ExecutionEndStatus = 'executed' | 'executed_unrecorded' | 'executor_failed';

interface Reservation {
  outcome: 'reserved' | 'already_used' | 'not_found' | 'not_approved' | 'expired' | 'mismatch';
  execution_id: string | null;
  execution_status: string | null;
  approval_status: string | null;
}

// Freigabe atomar verbrauchen (reserve_browser_execution: Zeilensperre auf der
// Freigabe + UNIQUE(approval_id)). Muss VOR dem Executor-Aufruf stehen — ein
// nachträglicher Evidence-Lookup schützt weder gegen parallele Requests noch
// gegen einen Retry nach gescheiterter Persistenz.
// deno-lint-ignore no-explicit-any
async function reserveExecution(admin: any, tenantId: string, approvalId: string, fingerprint: string): Promise<Reservation> {
  const { data, error } = await admin.rpc('reserve_browser_execution', {
    p_tenant_id: tenantId,
    p_approval_id: approvalId,
    p_fingerprint: fingerprint,
  });
  if (error) throw new Error(`reserve_browser_execution: ${error.message}`);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.outcome) throw new Error('reserve_browser_execution: empty result');
  return row as Reservation;
}

// Statuswechsel nur aus 'reserved' (finish_browser_execution). false heisst:
// nicht geschrieben — die Reservierung bleibt stehen (fail-closed).
// deno-lint-ignore no-explicit-any
async function finishExecution(admin: any, executionId: string | null, status: ExecutionEndStatus, detail?: string): Promise<boolean> {
  if (!executionId) return true;
  try {
    const { data, error } = await admin.rpc('finish_browser_execution', {
      p_execution_id: executionId,
      p_status: status,
      p_detail: detail ?? null,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

function reservationError(reservation: Reservation): Response {
  switch (reservation.outcome) {
    case 'not_found':
      return jsonError(404, 'APPROVAL_NOT_FOUND', 'approval not found');
    case 'not_approved':
      return jsonError(409, 'APPROVAL_REQUIRED', `approval is ${reservation.approval_status}`);
    case 'expired':
      return jsonError(409, 'APPROVAL_EXPIRED', 'approval has expired; request a new approval');
    case 'mismatch':
      return jsonError(409, 'APPROVAL_MISMATCH', 'approval does not match this browser action');
    default:
      // Jeder bestehende Status (reserved, executed, executed_unrecorded,
      // executor_failed) heisst für den Client dasselbe: mit dieser Freigabe
      // nicht erneut ausführbar. Der Status geht zur Anzeige mit.
      return jsonError(409, 'APPROVAL_ALREADY_USED', 'approval has already been used; request a new approval', undefined, {
        execution_status: reservation.execution_status,
      });
  }
}

function redactActions(actions: BrowserAction[]): unknown[] {
  return actions.map((action) => {
    if (action.type === 'type') {
      return { ...action, text: `[redacted:${action.text.length} chars]` };
    }
    if (action.type === 'select') {
      return { ...action, value: '[redacted]' };
    }
    return action;
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function latestEvidenceHash(admin: any, tenantId: string): Promise<string | null> {
  const { data, error } = await admin
    .from('governance_evidence')
    .select('content_hash')
    .eq('tenant_id', tenantId)
    .not('content_hash', 'is', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1);
  if (error) throw new Error(`governance_evidence head: ${error.message}`);
  return data?.[0]?.content_hash ?? null;
}

async function appendBrowserEvidence(
  admin: any,
  input: {
    tenantId: string;
    eventId: string;
    sessionId: string;
    approvalId: string | null;
    executionId: string | null;
    actionCount: number;
    risk: 'info' | 'low' | 'medium' | 'high';
    result: unknown;
  },
): Promise<string> {
  // Compare-and-swap on the tenant evidence head. A concurrent writer may
  // advance the chain between read and append; in that case re-read, re-hash
  // (previous_hash is part of the snapshot), and retry.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const previousHash = await latestEvidenceHash(admin, input.tenantId);
    const snapshot: Record<string, unknown> = {
      source: 'browser-execute',
      tenant_id: input.tenantId,
      event_id: input.eventId,
      browser_session_id: input.sessionId,
      browser_approval_id: input.approvalId,
      browser_execution_id: input.executionId,
      browser_execution_consumed: Boolean(input.approvalId),
      action_count: input.actionCount,
      risk: input.risk,
      result: input.result,
      previous_hash: previousHash,
    };
    const contentHash = await evidenceContentHash(snapshot);
    const { data, error } = await admin.rpc('append_governance_evidence', {
      p_row: {
        tenant_id: input.tenantId,
        event_id: input.eventId,
        asset_id: null,
        evidence_type: 'json',
        title: 'Browser execution evidence',
        storage_path: null,
        content_hash: contentHash,
        previous_hash: previousHash,
        metadata: {
          source: 'browser-execute',
          browser_session_id: input.sessionId,
          browser_approval_id: input.approvalId,
          browser_execution_id: input.executionId,
          browser_execution_consumed: Boolean(input.approvalId),
          action_count: input.actionCount,
          risk: input.risk,
          result: input.result,
          snapshot,
          hash_method: EVIDENCE_HASH_METHOD,
        },
      },
      p_expected_previous_hash: previousHash,
    });
    if (error) throw new Error(`append_governance_evidence: ${error.message}`);
    if (typeof data === 'string' && data.length > 0) return data;
  }
  throw new Error('append_governance_evidence: chain head kept moving');
}

async function stableFingerprint(sessionId: string, actions: BrowserAction[]): Promise<string> {
  const digest = await sha256Hex(JSON.stringify({ session_id: sessionId, actions }));
  return `browser:v1:${digest}`;
}

async function sanitizeExecutorPayload(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) {
    return Promise.all(value.map((item) => sanitizeExecutorPayload(item)));
  }
  if (!value || typeof value !== 'object') return value;

  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'screenshot_base64' && typeof item === 'string') {
      out.screenshot = {
        encoding: 'base64',
        length: item.length,
        sha256: await sha256Hex(item),
        persisted_inline: false,
      };
      continue;
    }
    out[key] = await sanitizeExecutorPayload(item);
  }
  return out;
}

function riskFor(actions: BrowserAction[]): 'info' | 'low' | 'medium' | 'high' {
  if (actions.some((action) => MUTATING_ACTIONS.has(action.type))) return 'high';
  if (actions.some((action) => action.type === 'navigate')) return 'low';
  return 'info';
}

function validateActions(actions: BrowserAction[]): string | null {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 25) {
    return 'actions must contain 1..25 items';
  }
  const mutations = actions.filter((action) => MUTATING_ACTIONS.has(action.type)).length;
  if (mutations > 1) return 'at most one mutating browser action is allowed per governed request';

  for (const action of actions) {
    if (!['navigate', 'scroll', 'click', 'type', 'select', 'extract', 'wait', 'screenshot'].includes(action.type)) {
      return `unsupported action: ${String((action as { type?: unknown }).type)}`;
    }
  }
  return null;
}

async function createApproval(
  // deno-lint-ignore no-explicit-any
  admin: any,
  tenantId: string,
  actorEmail: string | undefined,
  sessionId: string,
  actions: BrowserAction[],
) {
  const fingerprint = await stableFingerprint(sessionId, actions);
  const { data: event, error: eventError } = await admin
    .from('governance_events')
    .insert({
      tenant_id: tenantId,
      event_type: 'browser.action.requested',
      event_source: 'agent_runtime',
      title: 'Browser action requires approval',
      summary: 'A mutating browser action requires human approval before execution.',
      risk_level: 'high',
      actor_email: actorEmail ?? null,
      policy_action: 'require_approval',
      payload: { session_id: sessionId, actions: redactActions(actions) },
    })
    .select('id')
    .single();
  if (eventError || !event) throw new Error(eventError?.message ?? 'failed to create governance event');

  const { data: approval, error: approvalError } = await admin
    .from('governance_approvals')
    .insert({
      tenant_id: tenantId,
      event_id: event.id,
      status: 'pending',
      requested_action: fingerprint,
    })
    .select('id')
    .single();
  if (approvalError || !approval) throw new Error(approvalError?.message ?? 'failed to create approval');

  return approval.id as string;
}

Deno.serve(async (req: Request) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonError(405, 'METHOD_NOT_ALLOWED', 'POST only');

  let body: BrowserExecuteBody;
  try { body = await req.json(); }
  catch { return jsonError(400, 'BAD_REQUEST', 'invalid json'); }

  const auth = await requireAuthAndTenant(req, body.tenant_id);
  if (auth instanceof Response) return auth;

  // Freitext → Aktionsplan. Braucht keinen Executor und führt nichts aus;
  // Tarif-Gate, Quota, Residency und Logging (ai_tool_runs) über runAiTool.
  if (body.op === 'plan') {
    const task = typeof body.task === 'string' ? body.task.trim() : '';
    if (!task || task.length > MAX_TASK_CHARS) {
      return jsonError(400, 'BAD_REQUEST', `task must be 1..${MAX_TASK_CHARS} chars`);
    }
    const currentUrl = typeof body.current_url === 'string' && /^https?:\/\//i.test(body.current_url)
      ? body.current_url.slice(0, 2000)
      : null;
    try {
      const ai = await runAiTool(
        auth.admin,
        auth.tenantId,
        auth.user.id,
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
      return jsonError(500, 'PLAN_FAILED', 'browser task planning failed');
    }
  }

  const scannerUrl = Deno.env.get('PLAYWRIGHT_SCANNER_URL');
  const scannerKey = Deno.env.get('PLAYWRIGHT_SCANNER_KEY');
  if (!scannerUrl || !scannerKey) {
    return jsonError(503, 'EXECUTOR_NOT_CONFIGURED', 'browser executor is not configured');
  }
  const scannerBase = scannerUrl.replace(/\/$/, '');

  if (body.op === 'health') {
    try {
      const health = await fetch(`${scannerBase}/health`, {
        headers: { Authorization: `Bearer ${scannerKey}` },
      });
      const payload = await health.json().catch(() => null);
      if (!health.ok) {
        return jsonError(502, 'EXECUTOR_UNHEALTHY', 'browser executor health check failed', undefined, {
          status: health.status,
        });
      }
      return jsonResponse({
        ok: true,
        connected: true,
        capabilities: ['navigate', 'scroll', 'click', 'type', 'select', 'extract', 'wait', 'screenshot'],
        executor: payload,
      });
    } catch {
      return jsonError(502, 'EXECUTOR_UNREACHABLE', 'browser executor is unreachable');
    }
  }

  const sessionId = body.session_id?.trim();
  if (!sessionId || sessionId.length > 200) {
    return jsonError(400, 'BAD_REQUEST', 'valid session_id required');
  }

  const actions = body.actions ?? [];
  const validationError = validateActions(actions);
  if (validationError) return jsonError(400, 'BAD_REQUEST', validationError);

  const fingerprint = await stableFingerprint(sessionId, actions);
  const requiresApproval = actions.some((action) => MUTATING_ACTIONS.has(action.type));
  let executionId: string | null = null;

  if (requiresApproval) {
    if (!body.approval_id) {
      const approvalId = await createApproval(
        auth.admin,
        auth.tenantId,
        auth.user.email,
        sessionId,
        actions,
      );
      return jsonError(409, 'APPROVAL_REQUIRED', 'mutating browser action requires human approval', undefined, {
        approval_id: approvalId,
      });
    }

    let reservation: Reservation;
    try {
      reservation = await reserveExecution(auth.admin, auth.tenantId, body.approval_id, fingerprint);
    } catch {
      return jsonError(503, 'RESERVATION_UNAVAILABLE', 'approval could not be reserved; nothing was executed');
    }
    if (reservation.outcome !== 'reserved') return reservationError(reservation);
    executionId = reservation.execution_id;
    if (!executionId) {
      return jsonError(503, 'RESERVATION_UNAVAILABLE', 'approval could not be reserved; nothing was executed');
    }
  }

  const startedAt = new Date().toISOString();
  let response: Response;
  let payload: unknown;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), EXECUTOR_TIMEOUT_MS);
  try {
    response = await fetch(`${scannerBase}/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${scannerKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: `${auth.tenantId}:${sessionId}`,
        actions,
      }),
      signal: abort.signal,
    });
    payload = await response.json().catch(() => null);
  } catch {
    const timedOut = abort.signal.aborted;
    await finishExecution(auth.admin, executionId, 'executor_failed', timedOut ? 'timeout' : 'unreachable');
    return jsonError(
      timedOut ? 504 : 502,
      timedOut ? 'EXECUTOR_TIMEOUT' : 'EXECUTOR_UNREACHABLE',
      timedOut ? 'browser executor did not answer in time' : 'browser executor is unreachable',
      undefined,
      executionId ? { execution_status: 'executor_failed', approval_consumed: true } : undefined,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    await finishExecution(auth.admin, executionId, 'executor_failed', `http ${response.status}`);
    return jsonError(502, 'EXECUTOR_FAILED', 'browser executor request failed', undefined, {
      status: response.status,
      payload: await sanitizeExecutorPayload(payload),
      ...(executionId ? { execution_status: 'executor_failed', approval_consumed: true } : {}),
    });
  }

  const safePayload = await sanitizeExecutorPayload(payload);
  const safeActions = redactActions(actions);
  const risk = riskFor(actions);

  const { data: event, error: eventError } = await auth.admin
    .from('governance_events')
    .insert({
      tenant_id: auth.tenantId,
      event_type: 'browser.action.executed',
      event_source: 'agent_runtime',
      title: 'Governed browser action executed',
      summary: `${actions.length} browser action(s) executed`,
      risk_level: risk,
      actor_email: auth.user.email ?? null,
      policy_action: requiresApproval ? 'require_approval' : 'log',
      payload: {
        session_id: sessionId,
        actions: safeActions,
        approval_id: body.approval_id ?? null,
        browser_execution_id: executionId,
        executor_result: safePayload,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  // Ab hier ist die Aktion gelaufen. Scheitert der Prüfpfad, wird die
  // Ausführung executed_unrecorded — nie wieder freigegeben, nie ok gemeldet.
  const unrecorded = async (detail: string) => {
    await finishExecution(auth.admin, executionId, 'executed_unrecorded', detail);
    return jsonError(500, 'EVIDENCE_WRITE_FAILED', 'browser action was executed, but governance evidence could not be persisted; manual review required', undefined, {
      execution_status: 'executed_unrecorded',
      action_executed: true,
      approval_consumed: Boolean(executionId),
    });
  };

  if (eventError || !event?.id) return unrecorded('governance event');

  try {
    await appendBrowserEvidence(auth.admin, {
      tenantId: auth.tenantId,
      eventId: event.id,
      sessionId,
      approvalId: body.approval_id ?? null,
      executionId,
      actionCount: actions.length,
      risk,
      result: safePayload,
    });
  } catch {
    return unrecorded('governance evidence');
  }

  // Auch der Abschluss selbst ist Teil des Prüfpfads: gelingt er nicht, bleibt
  // die Reservierung stehen (fail-closed) und der Aufrufer bekommt kein ok.
  if (!(await finishExecution(auth.admin, executionId, 'executed'))) {
    return jsonError(500, 'EVIDENCE_WRITE_FAILED', 'browser action was executed and recorded, but the execution status could not be finalized; manual review required', undefined, {
      execution_status: 'reserved',
      action_executed: true,
      approval_consumed: true,
    });
  }

  return jsonResponse({
    ok: true,
    session_id: sessionId,
    risk,
    approval_id: body.approval_id ?? null,
    execution_id: executionId,
    result: payload,
  });
});
