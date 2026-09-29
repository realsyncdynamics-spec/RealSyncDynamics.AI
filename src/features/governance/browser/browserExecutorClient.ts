/**
 * Governed Browser Runtime — Client für die Edge Function browser-execute.
 *
 * Der Browser entscheidet nichts: Modus-Freigaben, Policy, Freigaben,
 * Executor-Status und Evidence kommen ausschließlich aus der Antwort des
 * Servers. Autorität ist das Nutzer-JWT (Supabase-Session) → memberships;
 * tenant_id wählt nur unter den eigenen Mitgliedschaften aus.
 */
import { getSupabase } from '../../../lib/supabase';
import { getSupabaseUrl } from '../../../lib/supabaseUrl';

export type BrowserExecutorAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'submit'; selector: string }
  | { type: 'extract'; selector?: string }
  | { type: 'read_text'; selector?: string }
  | { type: 'read_dom'; selector?: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'screenshot' }
  | { type: 'back' }
  | { type: 'forward' }
  | { type: 'reload' }
  | { type: 'download'; selector: string }
  | { type: 'upload'; selector: string; file_ref: string };

export type BrowserActionType = BrowserExecutorAction['type'];
export type AgentMode = 'assist' | 'copilot' | 'autonomous';
export type ExecutorStatus = 'offline' | 'connecting' | 'ready' | 'busy' | 'degraded' | 'error';
export type SessionStatus = 'creating' | 'ready' | 'executing' | 'awaiting_approval' | 'paused' | 'failed' | 'closed';

export interface ExecutorHealthView {
  executor_id: string;
  status: ExecutorStatus;
  reason_code: string | null;
  checked_at: string;
  last_seen_at: string | null;
  runtime: string | null;
  version: string | null;
  active_sessions: number | null;
  max_sessions: number | null;
  capabilities: string[];
}

export interface ActionAvailability {
  available: boolean;
  reason: string | null;
  requires_approval: boolean;
}

export interface CapabilitiesView {
  tenant: { id: string; verified: boolean; authority: 'membership'; role: string };
  executor: ExecutorHealthView;
  entitlement: { key: string; status: 'granted' | 'denied' | 'unavailable' };
  policy: {
    authority: 'server';
    policy_id: string;
    policy_version: string;
    tenant_policies_loaded: boolean;
    mutation_approval: 'required';
    limits: { approvalTtlMs: number; maxActionsPerSession: number; maxOpenSessionsPerTenant: number };
  };
  evidence: { available: boolean; store: string; chain: string };
  kill_switch: { engaged: boolean };
  can_assist: boolean;
  can_copilot: boolean;
  can_autonomous: boolean;
  reasons: { assist: string[]; copilot: string[]; autonomous: string[] };
  actions: Record<BrowserActionType, ActionAvailability>;
}

export interface SessionView {
  id: string;
  status: SessionStatus;
  mode: AgentMode;
  user_id: string;
  current_url: string | null;
  page_title: string | null;
  action_count: number;
  last_action: { type: string; outcome: string; at: string; verification?: string; evidence_id?: string | null; event_id?: string | null; reason?: string } | null;
  next_action: { action: Record<string, unknown>; approval_id?: string; expires_at?: string } | null;
  last_error_code: string | null;
  executor_version: string | null;
  created_at: string;
  expires_at: string;
}

export interface FrameView {
  mime: string;
  base64: string;
  sha256: string;
  bytes: number;
  captured_at: string;
}

export interface PipelineStep {
  step: 'requested' | 'policy' | 'approval' | 'execution' | 'verification' | 'evidence';
  state: 'done' | 'skipped' | 'blocked' | 'pending' | 'failed';
  detail?: string;
}

export interface PolicySummary {
  decision: 'ALLOW' | 'DENY' | 'REQUIRE_APPROVAL';
  policy_id: string;
  policy_version: string;
  reason: string;
  risk_level: string;
  conditions: string[];
}

export interface ActResponse {
  ok: true;
  correlation_id: string;
  decision: PolicySummary;
  pipeline: PipelineStep[];
  result: {
    ok: boolean;
    url: string | null;
    title: string | null;
    error_code: string | null;
    text?: string;
    dom?: { nodes: Array<Record<string, string | null>>; truncated: boolean };
    download?: { filename: string; bytes: number; sha256: string };
    screenshot?: { base64: string; sha256: string };
  };
  verification: { status: 'passed' | 'failed' | 'not_applicable'; checks: Record<string, unknown> };
  evidence: { id: string; content_hash: string; previous_hash: string | null; event_id: string | null } | null;
  approval_id: string | null;
  session: SessionView | null;
  frame: FrameView | null;
}

export class BrowserExecutorError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
    readonly details?: unknown,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'BrowserExecutorError';
  }
}

async function invokeBrowserExecutor(body: Record<string, unknown>): Promise<unknown> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new BrowserExecutorError('Anmeldung erforderlich', 'AUTH_REQUIRED', 401);
  }

  const url = `${getSupabaseUrl()}/functions/v1/browser-execute`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new BrowserExecutorError('Netzwerkfehler', 'NETWORK', 0);
  }

  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || data.ok === false) {
    const error = (data.error ?? {}) as { code?: string; message?: string; details?: unknown };
    throw new BrowserExecutorError(
      error.message ?? 'Browser-Aktion fehlgeschlagen',
      error.code ?? 'INTERNAL_ERROR',
      response.status,
      error.details,
      typeof data.correlation_id === 'string' ? data.correlation_id : undefined,
    );
  }
  return data;
}

export async function getBrowserExecutorHealth(input: { tenantId: string }): Promise<{ executor: ExecutorHealthView }> {
  return invokeBrowserExecutor({ op: 'health', tenant_id: input.tenantId }) as Promise<{ executor: ExecutorHealthView }>;
}

export async function getBrowserRuntimeCapabilities(input: { tenantId: string }): Promise<CapabilitiesView> {
  return invokeBrowserExecutor({ op: 'capabilities', tenant_id: input.tenantId }) as Promise<CapabilitiesView>;
}

export async function createBrowserSession(input: {
  tenantId: string;
  mode: AgentMode;
  initialUrl?: string | null;
}): Promise<{ session: SessionView; frame: FrameView | null; initial_navigation: (ActResponse | { ok: false; error: { code: string; message: string; details?: unknown } }) | null }> {
  return invokeBrowserExecutor({
    op: 'session_create',
    tenant_id: input.tenantId,
    mode: input.mode,
    ...(input.initialUrl ? { initial_url: input.initialUrl } : {}),
  }) as Promise<{ session: SessionView; frame: FrameView | null; initial_navigation: ActResponse | null }>;
}

export async function listBrowserSessions(input: { tenantId: string }): Promise<{ sessions: SessionView[] }> {
  return invokeBrowserExecutor({ op: 'session_list', tenant_id: input.tenantId }) as Promise<{ sessions: SessionView[] }>;
}

export async function getBrowserSessionFrame(input: { tenantId: string; sessionId: string }): Promise<{
  frame: FrameView;
  page: { url: string; title: string; loading: boolean } | null;
  session_status: SessionStatus;
}> {
  return invokeBrowserExecutor({ op: 'session_frame', tenant_id: input.tenantId, session_id: input.sessionId }) as Promise<{
    frame: FrameView;
    page: { url: string; title: string; loading: boolean } | null;
    session_status: SessionStatus;
  }>;
}

export async function getBrowserSession(input: { tenantId: string; sessionId: string }): Promise<{ session: SessionView }> {
  return invokeBrowserExecutor({ op: 'session_get', tenant_id: input.tenantId, session_id: input.sessionId }) as Promise<{ session: SessionView }>;
}

export async function closeBrowserSession(input: { tenantId: string; sessionId: string }): Promise<{ session: SessionView | null }> {
  return invokeBrowserExecutor({ op: 'session_close', tenant_id: input.tenantId, session_id: input.sessionId }) as Promise<{ session: SessionView | null }>;
}

export async function runGovernedAction(input: {
  tenantId: string;
  sessionId: string;
  action: BrowserExecutorAction;
  approvalId?: string | null;
  initiatedBy?: 'human' | 'planner';
}): Promise<ActResponse> {
  return invokeBrowserExecutor({
    op: 'act',
    tenant_id: input.tenantId,
    session_id: input.sessionId,
    action: input.action,
    ...(input.approvalId ? { approval_id: input.approvalId } : {}),
    initiated_by: input.initiatedBy ?? 'human',
  }) as Promise<ActResponse>;
}

export async function getApprovalStatus(input: { tenantId: string; approvalId: string }): Promise<{
  approval: { id: string; status: string; expires_at: string; resolved_at: string | null; consumed_at: string | null; executed_at: string | null; event_id: string };
}> {
  return invokeBrowserExecutor({ op: 'approval_status', tenant_id: input.tenantId, approval_id: input.approvalId }) as Promise<{
    approval: { id: string; status: string; expires_at: string; resolved_at: string | null; consumed_at: string | null; executed_at: string | null; event_id: string };
  }>;
}

export async function cancelApproval(input: { tenantId: string; approvalId: string }): Promise<{ cancelled: boolean }> {
  return invokeBrowserExecutor({ op: 'approval_cancel', tenant_id: input.tenantId, approval_id: input.approvalId }) as Promise<{ cancelled: boolean }>;
}

export async function killAllBrowserSessions(input: { tenantId: string }): Promise<{ closed_sessions: number; cancelled_approvals: number }> {
  return invokeBrowserExecutor({ op: 'kill_all', tenant_id: input.tenantId }) as Promise<{ closed_sessions: number; cancelled_approvals: number }>;
}

export interface BrowserPlanStep {
  action: BrowserExecutorAction;
  reason: string;
}

export type BrowserPlanResponse =
  | { ok: true; kind: 'plan'; run_id: string | null; summary: string; steps: BrowserPlanStep[] }
  | { ok: true; kind: 'refused'; run_id: string | null; reason: string };

/**
 * Freitext → geprüfter Aktionsplan (browser_task_planner). Führt nichts aus;
 * jeder Schritt geht danach einzeln über `runGovernedAction` (Policy, Freigabe, Evidence).
 */
export async function planBrowserTask(input: {
  tenantId: string;
  task: string;
  currentUrl?: string | null;
}): Promise<BrowserPlanResponse> {
  return invokeBrowserExecutor({
    op: 'plan',
    tenant_id: input.tenantId,
    task: input.task,
    current_url: input.currentUrl ?? undefined,
  }) as Promise<BrowserPlanResponse>;
}
