import { jsonError, jsonResponse, handleOptions } from '../_shared/gateway.ts';
import { requireAuthAndTenant } from '../_shared/auth.ts';

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
  op?: 'execute' | 'health';
  tenant_id?: string;
  session_id?: string;
  actions?: BrowserAction[];
  approval_id?: string;
}

const MUTATING_ACTIONS = new Set<BrowserAction['type']>(['click', 'type', 'select']);

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

    const { data: approval, error } = await auth.admin
      .from('governance_approvals')
      .select('id, tenant_id, status, requested_action')
      .eq('id', body.approval_id)
      .eq('tenant_id', auth.tenantId)
      .maybeSingle();
    if (error || !approval) return jsonError(404, 'APPROVAL_NOT_FOUND', 'approval not found');
    if (approval.status !== 'approved') {
      return jsonError(409, 'APPROVAL_REQUIRED', `approval is ${approval.status}`);
    }
    if (approval.requested_action !== fingerprint) {
      return jsonError(409, 'APPROVAL_MISMATCH', 'approval does not match this browser action');
    }

    const { data: consumed } = await auth.admin
      .from('governance_evidence')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('evidence_type', 'json')
      .contains('metadata', {
        browser_approval_id: body.approval_id,
        browser_execution_consumed: true,
      })
      .limit(1)
      .maybeSingle();
    if (consumed) {
      return jsonError(409, 'APPROVAL_ALREADY_USED', 'approval has already been consumed');
    }
  }

  const startedAt = new Date().toISOString();
  const response = await fetch(`${scannerBase}/execute`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${scannerKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_id: `${auth.tenantId}:${sessionId}`,
      actions,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return jsonError(502, 'EXECUTOR_FAILED', 'browser executor request failed', undefined, {
      status: response.status,
      payload: await sanitizeExecutorPayload(payload),
    });
  }

  const safePayload = await sanitizeExecutorPayload(payload);
  const safeActions = redactActions(actions);
  const risk = riskFor(actions);

  const { data: event } = await auth.admin
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
        executor_result: safePayload,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      },
    })
    .select('id')
    .single();

  await auth.admin.from('governance_evidence').insert({
    tenant_id: auth.tenantId,
    event_id: event?.id ?? null,
    evidence_type: 'json',
    title: 'Browser execution evidence',
    metadata: {
      browser_session_id: sessionId,
      browser_approval_id: body.approval_id ?? null,
      browser_execution_consumed: Boolean(body.approval_id),
      action_count: actions.length,
      risk,
      result: safePayload,
    },
  });

  return jsonResponse({
    ok: true,
    session_id: sessionId,
    risk,
    approval_id: body.approval_id ?? null,
    result: payload,
  });
});
