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
  tenant_id?: string;
  session_id?: string;
  actions?: BrowserAction[];
  approval_id?: string;
}

function stableFingerprint(sessionId: string, actions: BrowserAction[]): string {
  const canonical = JSON.stringify(actions);
  return `browser:${sessionId}:${canonical}`.slice(0, 2000);
}

function riskFor(actions: BrowserAction[]): 'info' | 'low' | 'medium' | 'high' {
  if (actions.some((action) => action.type === 'click')) return 'high';
  if (actions.some((action) => action.type === 'type' || action.type === 'select')) return 'medium';
  if (actions.some((action) => action.type === 'navigate')) return 'low';
  return 'info';
}

function validateActions(actions: BrowserAction[]): string | null {
  if (!Array.isArray(actions) || actions.length === 0 || actions.length > 25) return 'actions must contain 1..25 items';
  const clicks = actions.filter((action) => action.type === 'click').length;
  if (clicks > 1) return 'at most one click action is allowed per governed request';
  for (const action of actions) {
    if (!['navigate','scroll','click','type','select','extract','wait','screenshot'].includes(action.type)) {
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
  const fingerprint = stableFingerprint(sessionId, actions);
  const { data: event, error: eventError } = await admin
    .from('governance_events')
    .insert({
      tenant_id: tenantId,
      event_type: 'browser.action.requested',
      event_source: 'agent_runtime',
      title: 'Browser action requires approval',
      summary: 'A browser click can cause an external write and requires human approval.',
      risk_level: 'high',
      actor_email: actorEmail ?? null,
      policy_action: 'require_approval',
      payload: { session_id: sessionId, actions },
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

  const sessionId = body.session_id?.trim();
  if (!sessionId || sessionId.length > 200) return jsonError(400, 'BAD_REQUEST', 'valid session_id required');
  const actions = body.actions ?? [];
  const validationError = validateActions(actions);
  if (validationError) return jsonError(400, 'BAD_REQUEST', validationError);

  const fingerprint = stableFingerprint(sessionId, actions);
  const requiresApproval = actions.some((action) => action.type === 'click');

  if (requiresApproval) {
    if (!body.approval_id) {
      const approvalId = await createApproval(auth.admin, auth.tenantId, auth.user.email, sessionId, actions);
      return jsonError(409, 'APPROVAL_REQUIRED', 'browser click requires human approval', undefined, {
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
    if (approval.status !== 'approved') return jsonError(409, 'APPROVAL_REQUIRED', `approval is ${approval.status}`);
    if (approval.requested_action !== fingerprint) return jsonError(409, 'APPROVAL_MISMATCH', 'approval does not match this browser action');

    const { data: consumed } = await auth.admin
      .from('governance_evidence')
      .select('id')
      .eq('tenant_id', auth.tenantId)
      .eq('evidence_type', 'json')
      .contains('metadata', { browser_approval_id: body.approval_id, browser_execution_consumed: true })
      .limit(1)
      .maybeSingle();
    if (consumed) return jsonError(409, 'APPROVAL_ALREADY_USED', 'approval has already been consumed');
  }

  const scannerUrl = Deno.env.get('PLAYWRIGHT_SCANNER_URL');
  const scannerKey = Deno.env.get('PLAYWRIGHT_SCANNER_KEY');
  if (!scannerUrl || !scannerKey) {
    return jsonError(503, 'EXECUTOR_NOT_CONFIGURED', 'browser executor is not configured');
  }

  const startedAt = new Date().toISOString();
  const response = await fetch(`${scannerUrl.replace(/\/$/, '')}/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${scannerKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: sessionId, actions }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return jsonError(502, 'EXECUTOR_FAILED', 'browser executor request failed', undefined, {
      status: response.status,
      payload,
    });
  }

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
        actions,
        approval_id: body.approval_id ?? null,
        executor_result: payload,
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
      result: payload,
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
