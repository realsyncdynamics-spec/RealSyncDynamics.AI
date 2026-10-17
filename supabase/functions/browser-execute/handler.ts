// browser-execute — Governed Browser Runtime, Deno-freier Handler.
//
// Autoritätskette je Request (in dieser Reihenfolge, fail closed):
//   Request → Identity (JWT) → Tenant (memberships) → Entitlement → Policy
//   → Risk → Approval → Execution → Verification → Evidence
//
// Alle Abhängigkeiten (Auth, Repo, Executor, Entitlements, Mandanten-Policy,
// Planner) werden injiziert; index.ts verdrahtet sie für Deno. Dadurch ist
// jeder Pfad in test/browser-runtime/*.test.ts mit Fakes verhaltensgetestet.

import { buildCorsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
import {
  BrowserRuntimeError,
  isBrowserRuntimeError,
  safeErrorCode,
  type BrowserRuntimeErrorCode,
} from '../_shared/browser-runtime/errors.ts';
import {
  actionClass,
  actionTarget,
  approvalFingerprint,
  parseBrowserAction,
  redactAction,
  type BrowserAction,
} from '../_shared/browser-runtime/actions.ts';
import { decideWithEvidence, type ApprovalDecisionRepo } from '../_shared/browser-runtime/approval-decision.ts';
import { checkNavigationUrl, recordableUrl } from '../_shared/browser-runtime/url.ts';
import {
  APPROVER_ROLES,
  BASELINE_POLICY_ID,
  BASELINE_POLICY_VERSION,
  EXECUTION_LIMITS,
  OPERATOR_ROLES,
  evaluateBrowserAction,
  type AgentMode,
  type BrowserPolicyDecision,
  type TenantPolicyOverlay,
} from '../_shared/browser-runtime/policy.ts';
import { computeCapabilities, type CapabilityReport } from '../_shared/browser-runtime/capabilities.ts';
import {
  OPEN_STATUSES,
  assertSessionActionable,
  isExpired,
  newExecutorSessionId,
  nextExpiry,
  type SessionRow,
  type SessionStatus,
} from '../_shared/browser-runtime/session.ts';
import {
  appendChainedEvidence,
  browserActionSnapshot,
  type ChainedEvidence,
  type EvidenceRepo,
} from '../_shared/browser-runtime/evidence.ts';
import type {
  ExecutorClient,
  ExecutorFrame,
  ExecutorHealth,
  ExecutorPage,
} from '../_shared/browser-runtime/executor.ts';

const corsHeaders = buildCorsHeaders('POST, OPTIONS');

export const BROWSER_RUNTIME_ENTITLEMENT = 'ai.tool.automations';

// ─── Abhängigkeiten ──────────────────────────────────────────────────────────

export interface VerifiedActor {
  user: { id: string; email?: string | null };
  tenantId: string;
  role: string;
}

/** Ergebnis von reserve_browser_execution (#1728). */
export interface Reservation {
  outcome: 'reserved' | 'already_used' | 'not_found' | 'not_approved' | 'expired' | 'mismatch';
  execution_id: string | null;
  execution_status: string | null;
  approval_status: string | null;
}

/** Endstatus in browser_executions — keiner gibt die Freigabe wieder frei. */
export type ExecutionEndStatus = 'executed' | 'executed_unrecorded' | 'executor_failed';

export interface ApprovalExecution {
  id: string;
  status: 'reserved' | ExecutionEndStatus;
  reserved_at: string;
  finished_at: string | null;
  detail: string | null;
}

export interface ApprovalRow {
  id: string;
  tenant_id: string;
  status: string;
  expires_at: string;
  requested_by: string | null;
  browser_session_id: string | null;
  resolved_at: string | null;
  event_id: string;
  /** Verbrauch aus browser_executions; null = nie reserviert. */
  execution: ApprovalExecution | null;
}

export interface BrowserRuntimeRepo extends EvidenceRepo, ApprovalDecisionRepo {
  countOpenSessions(tenantId: string, nowIso: string): Promise<number>;
  insertSession(row: Omit<SessionRow, 'id' | 'created_at'> & { id: string; created_at: string }): Promise<SessionRow>;
  getSession(tenantId: string, sessionId: string): Promise<SessionRow | null>;
  /** Bedingtes Update: nur wenn status ∈ expected; sonst null (Optimistic Locking). */
  updateSession(
    tenantId: string,
    sessionId: string,
    patch: Record<string, unknown>,
    expected?: readonly SessionStatus[],
  ): Promise<SessionRow | null>;
  listOpenSessions(tenantId: string): Promise<SessionRow[]>;
  insertEvent(row: Record<string, unknown>): Promise<{ id: string }>;
  insertApproval(row: Record<string, unknown>): Promise<{ id: string; expires_at: string }>;
  getApproval(tenantId: string, approvalId: string): Promise<ApprovalRow | null>;
  /** Kompensation (pending → cancelled), wenn der Nachweis der Anforderung scheiterte. */
  cancelApproval(tenantId: string, approvalId: string): Promise<boolean>;
  /** Offene Freigaben geschlossener Sessions → cancelled; liefert die IDs. */
  cancelPendingSessionApprovals(tenantId: string, sessionIds: string[]): Promise<string[]>;
  /** reserve_browser_execution: Zeilensperre + UNIQUE(approval_id), Ablauf nach DB-Uhr. */
  reserveExecution(tenantId: string, approvalId: string, fingerprint: string): Promise<Reservation>;
  /** finish_browser_execution: nur aus 'reserved'; false = nichts geschrieben. */
  finishExecution(executionId: string, status: ExecutionEndStatus, detail: string | null): Promise<boolean>;
  insertActionLog(row: Record<string, unknown>): Promise<{ id: string }>;
  updateActionLog(id: string, patch: Record<string, unknown>): Promise<void>;
  getExecutorLastSeen(executorId: string): Promise<string | null>;
  upsertExecutorStatus(health: ExecutorHealth, lastSeenAt: string | null): Promise<void>;
}

export interface BrowserExecuteDeps {
  /** JWT → auth.getUser() → memberships(user, tenantId). Fehler als Runtime-Code. */
  resolveActor(req: Request, tenantId: string | null): Promise<VerifiedActor | BrowserRuntimeErrorCode>;
  repo(actor: VerifiedActor): BrowserRuntimeRepo;
  executor: ExecutorClient;
  entitlement(actor: VerifiedActor): Promise<'granted' | 'denied' | 'unavailable'>;
  /** PDP v2 (Mandanten-Policies) für diese Aktion; Fehler → { status: 'unavailable' }. */
  tenantPolicy(actor: VerifiedActor, action: BrowserAction, pageUrl: string | null): Promise<TenantPolicyOverlay>;
  /** Lädt der Mandanten-Snapshot? (Capability „Policy Engine aktiv"). */
  tenantPolicyReady(actor: VerifiedActor): Promise<boolean>;
  /** Freitext-Planung (runAiTool); liefert fertige Response. */
  plan?(actor: VerifiedActor, task: unknown, currentUrl: unknown): Promise<Response>;
  killSwitchEngaged(): boolean;
  privateHostAllowlist: readonly string[];
  /** HMAC-Schlüssel für Freigabe-Fingerprints (deriveFingerprintKey, ≥ 32 Byte). */
  fingerprintKey: Uint8Array;
  now(): Date;
  uuid(): string;
  randomBytes(n: number): Uint8Array;
  log(entry: Record<string, unknown>): void;
}

// ─── Antworten ───────────────────────────────────────────────────────────────

function ok(body: Record<string, unknown>, correlationId: string, status = 200): Response {
  return jsonResponse({ ok: true, correlation_id: correlationId, ...body }, status, corsHeaders);
}

function fail(error: BrowserRuntimeError, correlationId: string): Response {
  return jsonResponse(
    {
      ok: false,
      correlation_id: correlationId,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    error.status,
    corsHeaders,
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new BrowserRuntimeError('VALIDATION_FAILED', `${field} must be a UUID`);
  }
  return value.toLowerCase();
}

type PipelineStepName = 'requested' | 'policy' | 'approval' | 'execution' | 'verification' | 'evidence';
type PipelineStepState = 'done' | 'skipped' | 'blocked' | 'pending' | 'failed';
interface PipelineStep { step: PipelineStepName; state: PipelineStepState; detail?: string }

function publicSession(s: SessionRow & Record<string, unknown>): Record<string, unknown> {
  return {
    id: s.id,
    status: s.status,
    mode: s.mode,
    user_id: s.user_id,
    current_url: s.current_url,
    page_title: s.page_title,
    action_count: s.action_count,
    last_action: (s as Record<string, unknown>).last_action ?? null,
    next_action: (s as Record<string, unknown>).next_action ?? null,
    last_error_code: (s as Record<string, unknown>).last_error_code ?? null,
    executor_version: (s as Record<string, unknown>).executor_version ?? null,
    created_at: s.created_at,
    expires_at: s.expires_at,
  };
}

function framePayload(frame: ExecutorFrame | null): Record<string, unknown> | null {
  if (!frame) return null;
  return { mime: frame.mime, base64: frame.base64, sha256: frame.sha256, bytes: frame.bytes, captured_at: frame.captured_at };
}

async function textDigest(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Die Freigabe, auf die eine wartende Session wartet (next_action.approval_id). */
function pendingApprovalOf(session: SessionRow): string | null {
  const next = (session as SessionRow & { next_action?: { approval_id?: unknown } | null }).next_action;
  return typeof next?.approval_id === 'string' ? next.approval_id : null;
}

function reservationErrorCode(reservation: Reservation): BrowserRuntimeErrorCode {
  switch (reservation.outcome) {
    case 'not_found':
      return 'APPROVAL_NOT_FOUND';
    case 'expired':
      return 'APPROVAL_EXPIRED';
    case 'mismatch':
      return 'APPROVAL_MISMATCH';
    case 'already_used':
      return 'APPROVAL_ALREADY_USED';
    case 'not_approved':
      if (reservation.approval_status === 'rejected' || reservation.approval_status === 'cancelled') return 'APPROVAL_DENIED';
      if (reservation.approval_status === 'expired') return 'APPROVAL_EXPIRED';
      return 'APPROVAL_PENDING';
    default:
      return 'RESERVATION_UNAVAILABLE';
  }
}

/**
 * Verifikations-Checks des Executors für Evidence und Antwort: nur Zahlen,
 * Wahrheitswerte, kurze Strings und kleine String-Listen. `error`/`message`
 * nur als Code — Freitext (z. B. Playwright-Meldungen mit der Eingabe im
 * Call-Log) wird nie übernommen.
 */
export function sanitizeChecks(checks: unknown): Record<string, unknown> {
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(checks as Record<string, unknown>).slice(0, 30)) {
    if (!/^[a-z0-9_]{1,40}$/i.test(key)) continue;
    if (key === 'error' || key === 'message') {
      out[key] = safeErrorCode(value, 'ACTION_FAILED');
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[key] = value;
    } else if (typeof value === 'string') {
      if (value.length <= 2048) out[key] = value;
    } else if (Array.isArray(value)) {
      out[key] = value.filter((v) => typeof v === 'string' && v.length <= 200).slice(0, 20);
    }
  }
  return out;
}

/**
 * Statische Gegenprobe einer gemeldeten Seiten-URL: nur http(s) mit nicht-
 * öffentlichem Host. about:blank, Chromiums Fehlerseite (fehlgeschlagene oder
 * blockierte Navigation) und data:/blob: sind kein Ziel im Netz — die
 * DNS-genaue Prüfung macht der Executor (LANDED_ON_BLOCKED_URL).
 */
export function isNonPublicHttpUrl(url: string | null | undefined, allowlist: readonly string[]): boolean {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  const check = checkNavigationUrl(url, allowlist);
  return !check.ok && check.reason === 'PRIVATE_NETWORK_BLOCKED';
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export function createBrowserExecuteHandler(deps: BrowserExecuteDeps) {
  async function probeExecutor(repo: BrowserRuntimeRepo | null): Promise<ExecutorHealth & { last_seen_at: string | null }> {
    const health = await deps.executor.health();
    const reachable = health.status === 'ready' || health.status === 'busy' || health.status === 'degraded';
    let lastSeen: string | null = reachable ? health.checked_at : null;
    if (repo) {
      try {
        if (!reachable) lastSeen = await repo.getExecutorLastSeen(health.executor_id);
        await repo.upsertExecutorStatus(health, lastSeen);
      } catch {
        deps.log({ level: 'warn', scope: 'browser-execute', event: 'executor_status_persist_failed' });
      }
    }
    return { ...health, last_seen_at: lastSeen };
  }

  async function evidenceAvailable(repo: BrowserRuntimeRepo, tenantId: string): Promise<boolean> {
    try {
      await repo.latestEvidenceHash(tenantId);
      return true;
    } catch {
      return false;
    }
  }

  async function capabilitiesFor(actor: VerifiedActor, repo: BrowserRuntimeRepo) {
    const [executor, entitlement, policyReady, evidence] = await Promise.all([
      probeExecutor(repo),
      deps.entitlement(actor).catch(() => 'unavailable' as const),
      deps.tenantPolicyReady(actor).catch(() => false),
      evidenceAvailable(repo, actor.tenantId),
    ]);
    const report: CapabilityReport = computeCapabilities({
      tenantVerified: true,
      role: actor.role,
      entitlement: { key: BROWSER_RUNTIME_ENTITLEMENT, status: entitlement },
      killSwitch: { engaged: deps.killSwitchEngaged(), available: true },
      executor,
      policyEngine: { baselineActive: true, tenantSnapshotLoaded: policyReady },
      evidenceStore: { available: evidence },
      autonomyPolicyDefined: false,
      executionLimitsDefined: true,
      uploadSourceConfigured: false,
    });
    return { executor, entitlement, policyReady, evidence, report };
  }

  async function requireEntitlement(actor: VerifiedActor): Promise<void> {
    const status = await deps.entitlement(actor).catch(() => 'unavailable' as const);
    if (status === 'denied') {
      throw new BrowserRuntimeError('ENTITLEMENT_REQUIRED', `plan does not include ${BROWSER_RUNTIME_ENTITLEMENT}`, {
        entitlement: BROWSER_RUNTIME_ENTITLEMENT,
      });
    }
    if (status === 'unavailable') {
      throw new BrowserRuntimeError('INTERNAL_ERROR', 'entitlements could not be resolved');
    }
  }

  function requireOperator(actor: VerifiedActor): void {
    if (!OPERATOR_ROLES.has(actor.role)) {
      throw new BrowserRuntimeError('FORBIDDEN', `role ${actor.role} cannot operate the browser runtime`);
    }
  }

  function requireKillSwitchOff(): void {
    if (deps.killSwitchEngaged()) {
      throw new BrowserRuntimeError('KILL_SWITCH_ENGAGED', 'browser runtime is stopped by the kill switch');
    }
  }

  async function loadOwnedSession(repo: BrowserRuntimeRepo, actor: VerifiedActor, sessionId: string): Promise<SessionRow> {
    const session = await repo.getSession(actor.tenantId, sessionId);
    if (!session) throw new BrowserRuntimeError('SESSION_NOT_FOUND', 'session not found');
    if (session.user_id !== actor.user.id) throw new BrowserRuntimeError('FORBIDDEN', 'session belongs to another user');
    return session;
  }

  async function markSessionLost(repo: BrowserRuntimeRepo, session: SessionRow, now: Date, code = 'EXECUTOR_SESSION_LOST'): Promise<void> {
    await repo.updateSession(session.tenant_id, session.id, {
      status: 'failed',
      last_error_code: code,
      ...(code === 'LANDED_ON_NON_PUBLIC_URL' ? { current_url: 'about:blank', page_title: null } : {}),
      next_action: null,
      closed_at: now.toISOString(),
      updated_at: now.toISOString(),
    });
  }

  // ── op: session_create ────────────────────────────────────────────────────
  async function sessionCreate(actor: VerifiedActor, body: Record<string, unknown>, correlationId: string): Promise<Response> {
    requireKillSwitchOff();
    requireOperator(actor);
    await requireEntitlement(actor);
    const repo = deps.repo(actor);

    const mode = (body.mode ?? 'assist') as AgentMode;
    if (mode !== 'assist' && mode !== 'copilot' && mode !== 'autonomous') {
      throw new BrowserRuntimeError('VALIDATION_FAILED', 'mode must be assist|copilot|autonomous');
    }
    const caps = await capabilitiesFor(actor, repo);
    if (mode === 'copilot' && !caps.report.can_copilot) {
      throw new BrowserRuntimeError('FORBIDDEN', 'copilot mode is not available', { reasons: caps.report.reasons.copilot });
    }
    if (mode === 'autonomous' && !caps.report.can_autonomous) {
      throw new BrowserRuntimeError('FORBIDDEN', 'autonomous mode is not available', { reasons: caps.report.reasons.autonomous });
    }
    if (caps.executor.status !== 'ready' && caps.executor.status !== 'busy') {
      throw new BrowserRuntimeError('EXECUTOR_OFFLINE', 'browser executor is not available', {
        executor_status: caps.executor.status,
        reason: caps.executor.reason_code,
      });
    }
    if (!caps.evidence) throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', 'evidence store unavailable');

    const now = deps.now();
    const open = await repo.countOpenSessions(actor.tenantId, now.toISOString());
    if (open >= EXECUTION_LIMITS.maxOpenSessionsPerTenant) {
      throw new BrowserRuntimeError('SESSION_LIMIT_REACHED', `at most ${EXECUTION_LIMITS.maxOpenSessionsPerTenant} open sessions per tenant`);
    }

    const sessionId = deps.uuid();
    const executorSessionId = newExecutorSessionId(deps.randomBytes);
    let session = await repo.insertSession({
      id: sessionId,
      tenant_id: actor.tenantId,
      user_id: actor.user.id,
      executor_session_id: executorSessionId,
      mode,
      status: 'creating',
      current_url: null,
      page_title: null,
      action_count: 0,
      created_at: now.toISOString(),
      expires_at: nextExpiry(now, now).toISOString(),
    });

    let opened: { page: ExecutorPage | null; frame: ExecutorFrame | null; version: string | null };
    try {
      opened = await deps.executor.openSession(executorSessionId);
    } catch (error) {
      const code = isBrowserRuntimeError(error) ? error.code : 'EXECUTION_FAILED';
      await repo.updateSession(actor.tenantId, sessionId, {
        status: 'failed', last_error_code: code, closed_at: deps.now().toISOString(), updated_at: deps.now().toISOString(),
      });
      throw isBrowserRuntimeError(error) ? error : new BrowserRuntimeError('EXECUTION_FAILED', 'executor session could not be opened');
    }

    // Evidence für die Session-Eröffnung — fail closed: ohne Nachweis keine Session.
    let evidence: ChainedEvidence;
    try {
      evidence = await appendChainedEvidence(repo, {
        id: deps.uuid(),
        tenantId: actor.tenantId,
        eventId: null,
        evidenceType: 'log',
        title: 'Browser-Session eröffnet',
        source: 'browser-execute',
        snapshot: browserActionSnapshot({
          kind: 'browser.session.opened',
          tenantId: actor.tenantId,
          actor: { user_id: actor.user.id, role: actor.role },
          browserSessionId: sessionId,
          correlationId,
          timestamp: deps.now().toISOString(),
          action: { type: 'session_open', mode },
          target: null,
          policy: null,
          approvalId: null,
          result: { executor_version: opened.version },
          verification: null,
          artifacts: [],
        }),
      });
    } catch (error) {
      await deps.executor.closeSession(executorSessionId).catch(() => undefined);
      await repo.updateSession(actor.tenantId, sessionId, {
        status: 'failed', last_error_code: 'EVIDENCE_WRITE_FAILED', closed_at: deps.now().toISOString(), updated_at: deps.now().toISOString(),
      });
      throw error;
    }

    const readyAt = deps.now();
    session = (await repo.updateSession(actor.tenantId, sessionId, {
      status: 'ready',
      current_url: opened.page?.url ?? null,
      page_title: opened.page?.title ?? null,
      executor_version: opened.version,
      last_frame_sha256: opened.frame?.sha256 ?? null,
      last_frame_at: opened.frame ? readyAt.toISOString() : null,
      updated_at: readyAt.toISOString(),
    }, ['creating'])) ?? session;

    await repo.insertActionLog({
      tenant_id: actor.tenantId,
      actor_id: actor.user.id,
      session_id: sessionId,
      browser_session_id: sessionId,
      browser_action: 'session_open',
      status: 'completed',
      tool_name: 'governed-browser-runtime',
      started_at: now.toISOString(),
      completed_at: readyAt.toISOString(),
      duration_ms: readyAt.getTime() - now.getTime(),
      evidence_id: evidence.id,
      evidence_hash: evidence.content_hash,
      correlation_id: correlationId,
      metadata: { mode },
    }).catch(() => undefined);

    let initial: Record<string, unknown> | null = null;
    if (typeof body.initial_url === 'string' && body.initial_url.trim().length > 0) {
      try {
        const res = await act(actor, {
          session_id: sessionId,
          action: { type: 'navigate', url: body.initial_url },
          initiated_by: 'human',
        }, correlationId);
        initial = await res.json() as Record<string, unknown>;
      } catch (error) {
        // Die Session steht; nur die erste Navigation wurde abgelehnt/ist gescheitert.
        const e = isBrowserRuntimeError(error) ? error : new BrowserRuntimeError('INTERNAL_ERROR', 'initial navigation failed');
        initial = { ok: false, error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } };
      }
      const refreshed = await repo.getSession(actor.tenantId, sessionId);
      if (refreshed) session = refreshed;
    }

    return ok({
      session: publicSession(session as SessionRow & Record<string, unknown>),
      frame: framePayload(opened.frame),
      evidence: { id: evidence.id, content_hash: evidence.content_hash },
      initial_navigation: initial,
    }, correlationId, 201);
  }

  // ── op: act (Governed Action) ─────────────────────────────────────────────
  async function act(actor: VerifiedActor, body: Record<string, unknown>, correlationId: string): Promise<Response> {
    const pipeline: PipelineStep[] = [{ step: 'requested', state: 'done' }];
    const repo = deps.repo(actor);
    const startedAt = deps.now();

    const sessionId = requireUuid(body.session_id, 'session_id');
    const parsed = parseBrowserAction(body.action);
    if (!parsed.ok) throw new BrowserRuntimeError(parsed.code, parsed.message);
    let action = parsed.action;
    const approvalId = body.approval_id === undefined || body.approval_id === null
      ? null
      : requireUuid(body.approval_id, 'approval_id');
    // Nur Beschriftung für Event und Log: der Wert stammt vom Client. Die
    // Freigabepflicht hängt nicht davon ab, sondern allein von der Policy.
    const initiatedBy = body.initiated_by === 'planner' ? 'planner' : 'human';

    if (action.type === 'upload') {
      throw new BrowserRuntimeError('ACTION_NOT_SUPPORTED', 'governed upload needs a tenant-bound file source (not configured)', {
        reason: 'FILE_SOURCE_NOT_CONFIGURED',
      });
    }

    await requireEntitlement(actor);
    let session = await repo.getSession(actor.tenantId, sessionId);
    if (!session) throw new BrowserRuntimeError('SESSION_NOT_FOUND', 'session not found');
    const now = deps.now();

    // Wartet die Session auf eine Freigabe, darf nur GENAU diese eingelöst
    // werden. Eine beliebige andere approval_id entsperrt nichts (Review 09-29).
    const pendingApprovalId = pendingApprovalOf(session);
    if (session.status === 'awaiting_approval') {
      const pending = pendingApprovalId ? await repo.getApproval(actor.tenantId, pendingApprovalId) : null;
      const stillOpen = pending !== null
        && pending.execution === null
        && (pending.status === 'pending' || pending.status === 'approved')
        && Date.parse(pending.expires_at) > now.getTime();
      // Entschieden, abgelaufen oder verbraucht (und nicht gerade eingelöst): Session wieder frei.
      if (!stillOpen && approvalId !== pendingApprovalId) {
        session = (await repo.updateSession(actor.tenantId, session.id, {
          status: 'ready', next_action: null, updated_at: now.toISOString(),
        }, ['awaiting_approval'])) ?? session;
      }
    }
    if (isExpired(session, now) && OPEN_STATUSES.has(session.status)) {
      await repo.updateSession(actor.tenantId, session.id, { status: 'closed', closed_at: now.toISOString(), updated_at: now.toISOString(), last_error_code: 'SESSION_EXPIRED' });
      await deps.executor.closeSession(session.executor_session_id).catch(() => undefined);
    }
    const redeemsPending = approvalId !== null && approvalId === pendingApprovalId;
    assertSessionActionable(session, { user_id: actor.user.id }, action.type, now, redeemsPending);

    const urlCheck = action.type === 'navigate' ? checkNavigationUrl(action.url, deps.privateHostAllowlist) : undefined;
    if (urlCheck && urlCheck.ok && action.type === 'navigate') action = { type: 'navigate', url: urlCheck.url };

    const tenantPolicy = await deps.tenantPolicy(actor, action, session.current_url)
      .catch((): TenantPolicyOverlay => ({ status: 'unavailable', error_code: 'PDP_ERROR' }));

    const decision: BrowserPolicyDecision = evaluateBrowserAction({
      actor: { user_id: actor.user.id, role: actor.role },
      tenant: { id: actor.tenantId, verified: true },
      capability: { mode: session.mode, mode_allowed: session.mode !== 'autonomous', initiated_by: initiatedBy },
      target: { page_url: session.current_url },
      action,
      risk_context: {
        session_action_count: session.action_count,
        session_age_ms: now.getTime() - Date.parse(session.created_at),
        kill_switch_engaged: deps.killSwitchEngaged(),
        url_check: urlCheck,
      },
      tenant_policy: tenantPolicy,
    });
    pipeline.push({ step: 'policy', state: decision.decision === 'DENY' ? 'blocked' : 'done', detail: decision.reason });

    // Aufgezeichnet wird eine nicht freigegebene Roh-URL nur ohne Zugangsdaten,
    // Query und Fragment (Review 10-01): Ereignis und Nachweis sind für alle
    // Mitglieder lesbar, die Kette ist nicht löschbar.
    const recordAction: BrowserAction = action.type === 'navigate' && !urlCheck?.ok
      ? { type: 'navigate', url: recordableUrl(action.url) }
      : action;
    const redacted = redactAction(recordAction);
    const target = actionTarget(recordAction);
    const policySummary = {
      decision: decision.decision,
      policy_id: decision.policy_id,
      policy_version: decision.policy_version,
      reason: decision.reason,
      risk_level: decision.risk_level,
      conditions: decision.conditions,
    };
    const eventPayload = {
      browser_session_id: session.id,
      action: redacted,
      target,
      page_url: session.current_url,
      policy: policySummary,
      correlation_id: correlationId,
      initiated_by: initiatedBy,
    };

    // ── DENY ──────────────────────────────────────────────────────────────
    if (decision.decision === 'DENY') {
      let eventId: string | null = null;
      let evidence: ChainedEvidence | null = null;
      try {
        eventId = (await repo.insertEvent({
          tenant_id: actor.tenantId,
          event_type: 'browser.action.denied',
          event_source: 'agent_runtime',
          title: `Browser-Aktion abgelehnt: ${action.type}`,
          summary: decision.reason_text.slice(0, 1000),
          risk_level: decision.risk_level,
          actor_email: actor.user.email ?? null,
          policy_action: 'block',
          payload: eventPayload,
        })).id;
        evidence = await appendChainedEvidence(repo, {
          id: deps.uuid(),
          tenantId: actor.tenantId,
          eventId,
          evidenceType: 'json',
          title: `Browser-Aktion abgelehnt: ${action.type}`,
          source: 'browser-execute',
          snapshot: browserActionSnapshot({
            kind: 'browser.action.denied',
            tenantId: actor.tenantId,
            actor: { user_id: actor.user.id, role: actor.role },
            browserSessionId: session.id,
            correlationId,
            timestamp: now.toISOString(),
            action: redacted,
            target,
            policy: policySummary,
            approvalId,
            result: null,
            verification: null,
            artifacts: [],
          }),
        });
      } catch {
        deps.log({ level: 'error', scope: 'browser-execute', event: 'deny_evidence_failed', correlation_id: correlationId, tenant_id: actor.tenantId });
      }
      await repo.insertActionLog({
        tenant_id: actor.tenantId,
        actor_id: actor.user.id,
        session_id: session.id,
        browser_session_id: session.id,
        browser_action: action.type,
        status: 'denied',
        url: recordAction.type === 'navigate' ? recordAction.url.slice(0, 2048) : session.current_url,
        tool_name: 'governed-browser-runtime',
        policy_decision: 'deny',
        policy_id: decision.policy_id,
        policy_version: decision.policy_version,
        risk_level: decision.risk_level,
        governance_event_id: eventId,
        evidence_id: evidence?.id ?? null,
        evidence_hash: evidence?.content_hash ?? null,
        correlation_id: correlationId,
        error_code: safeErrorCode(decision.reason, 'POLICY_DENIED'),
        started_at: now.toISOString(),
        completed_at: deps.now().toISOString(),
        metadata: { action: redacted },
      }).catch(() => undefined);
      await repo.updateSession(actor.tenantId, session.id, {
        last_action: { type: action.type, outcome: 'denied', reason: decision.reason, at: now.toISOString() },
        updated_at: now.toISOString(),
      });
      const code: BrowserRuntimeErrorCode = decision.reason === 'URL_BLOCKED' ? 'URL_BLOCKED'
        : decision.reason === 'KILL_SWITCH_ENGAGED' ? 'KILL_SWITCH_ENGAGED'
          : decision.reason === 'POLICY_UNAVAILABLE' ? 'POLICY_UNAVAILABLE'
            : 'POLICY_DENIED';
      throw new BrowserRuntimeError(code, decision.reason_text, {
        policy: policySummary,
        event_id: eventId,
        evidence_id: evidence?.id ?? null,
        pipeline,
      });
    }

    // Eine approval_id gehört nur zu freigabepflichtigen Aktionen. Sonst würde
    // sie ungeprüft mitgeschickt und könnte eine wartende Session entsperren.
    if (approvalId !== null && decision.decision !== 'REQUIRE_APPROVAL') {
      throw new BrowserRuntimeError('VALIDATION_FAILED', 'approval_id is only valid for actions that require approval', {
        policy: policySummary,
      });
    }

    // ── REQUIRE_APPROVAL ohne Freigabe: Freigabe anlegen, nichts ausführen ─
    if (decision.decision === 'REQUIRE_APPROVAL' && approvalId === null) {
      if (session.status === 'awaiting_approval') {
        throw new BrowserRuntimeError('APPROVAL_PENDING', 'an approval is already pending in this session');
      }
      const fingerprint = await approvalFingerprint({
        tenantId: actor.tenantId,
        browserSessionId: session.id,
        executorSessionId: session.executor_session_id,
        pageUrl: session.current_url,
        action,
      }, deps.fingerprintKey);
      const expiresAt = new Date(now.getTime() + EXECUTION_LIMITS.approvalTtlMs).toISOString();
      const event = await repo.insertEvent({
        tenant_id: actor.tenantId,
        event_type: 'browser.action.requested',
        event_source: 'agent_runtime',
        title: `Browser-Aktion wartet auf Freigabe: ${action.type}`,
        summary: decision.reason_text.slice(0, 1000),
        risk_level: decision.risk_level,
        actor_email: actor.user.email ?? null,
        policy_action: 'require_approval',
        payload: eventPayload,
      });
      // requested_action = HMAC-Fingerprint; reserve_browser_execution (#1728)
      // vergleicht genau diesen Wert beim Einlösen.
      const approval = await repo.insertApproval({
        tenant_id: actor.tenantId,
        event_id: event.id,
        status: 'pending',
        requested_action: fingerprint,
        requested_by: actor.user.id,
        browser_session_id: session.id,
        expires_at: expiresAt,
      });
      let evidence: ChainedEvidence;
      try {
        evidence = await appendChainedEvidence(repo, {
          id: deps.uuid(),
          tenantId: actor.tenantId,
          eventId: event.id,
          evidenceType: 'json',
          title: `Freigabe angefordert: ${action.type}`,
          source: 'browser-execute',
          snapshot: browserActionSnapshot({
            kind: 'browser.action.intent',
            tenantId: actor.tenantId,
            actor: { user_id: actor.user.id, role: actor.role },
            browserSessionId: session.id,
            correlationId,
            timestamp: now.toISOString(),
            action: redacted,
            target,
            policy: policySummary,
            approvalId: approval.id,
            result: { status: 'awaiting_approval', expires_at: expiresAt, page_url: session.current_url },
            verification: null,
            artifacts: [],
          }),
        });
      } catch (error) {
        await repo.cancelApproval(actor.tenantId, approval.id).catch(() => false);
        throw error;
      }
      await repo.insertActionLog({
        tenant_id: actor.tenantId,
        actor_id: actor.user.id,
        session_id: session.id,
        browser_session_id: session.id,
        browser_action: action.type,
        status: 'awaiting_approval',
        url: session.current_url,
        tool_name: 'governed-browser-runtime',
        policy_decision: 'require_approval',
        policy_id: decision.policy_id,
        policy_version: decision.policy_version,
        risk_level: decision.risk_level,
        approval_id: approval.id,
        governance_event_id: event.id,
        evidence_id: evidence.id,
        evidence_hash: evidence.content_hash,
        correlation_id: correlationId,
        started_at: now.toISOString(),
        metadata: { action: redacted },
      }).catch(() => undefined);
      await repo.updateSession(actor.tenantId, session.id, {
        status: 'awaiting_approval',
        next_action: { action: redacted, approval_id: approval.id, expires_at: expiresAt },
        updated_at: now.toISOString(),
      }, ['ready']);
      pipeline.push({ step: 'approval', state: 'pending', detail: approval.id });
      throw new BrowserRuntimeError('APPROVAL_REQUIRED', 'this action requires human approval', {
        approval_id: approval.id,
        expires_at: expiresAt,
        policy: policySummary,
        event_id: event.id,
        evidence_id: evidence.id,
        pipeline,
      });
    }

    // ── Freigabe einlösen: atomar reservieren, VOR dem Executor (#1728) ────
    let executionId: string | null = null;
    if (decision.decision === 'REQUIRE_APPROVAL' && approvalId !== null) {
      const fingerprint = await approvalFingerprint({
        tenantId: actor.tenantId,
        browserSessionId: session.id,
        executorSessionId: session.executor_session_id,
        pageUrl: session.current_url,
        action,
      }, deps.fingerprintKey);
      let reservation: Reservation;
      try {
        reservation = await repo.reserveExecution(actor.tenantId, approvalId, fingerprint);
      } catch {
        throw new BrowserRuntimeError('RESERVATION_UNAVAILABLE', 'approval could not be reserved; nothing was executed', {
          approval_id: approvalId,
        });
      }
      if (reservation.outcome !== 'reserved' || !reservation.execution_id) {
        const code = reservationErrorCode(reservation);
        const released = reservation.outcome === 'expired'
          || (reservation.outcome === 'not_approved' && ['rejected', 'cancelled', 'expired'].includes(reservation.approval_status ?? ''));
        if (released && session.status === 'awaiting_approval') {
          await repo.updateSession(actor.tenantId, session.id, { status: 'ready', next_action: null, updated_at: now.toISOString() }, ['awaiting_approval']);
        }
        throw new BrowserRuntimeError(code, `approval ${reservation.outcome}`, {
          approval_id: approvalId,
          approval_status: reservation.approval_status,
          ...(reservation.outcome === 'already_used'
            ? { execution_status: reservation.execution_status, approval_consumed: true }
            : {}),
        });
      }
      executionId = reservation.execution_id;
      pipeline.push({ step: 'approval', state: 'done', detail: approvalId });
    } else {
      pipeline.push({ step: 'approval', state: 'skipped', detail: 'not required by policy' });
    }

    const cls = actionClass(action.type);
    // Ab hier ist eine Freigabe verbraucht. Jeder Ausgang wird festgeschrieben;
    // keiner gibt sie wieder frei (#1728). Ein neuer Versuch braucht eine neue.
    const finish = async (status: ExecutionEndStatus, detail: string | null): Promise<boolean> => {
      if (!executionId) return true;
      return await repo.finishExecution(executionId, status, detail).catch(() => false);
    };
    const consumedDetails = executionId ? { approval_consumed: true, execution_id: executionId } : {};

    // ── Evidence-Vorbedingung (fail closed) ───────────────────────────────
    let intentEvidence: ChainedEvidence | null = null;
    if (cls !== 'read_only') {
      try {
        intentEvidence = await appendChainedEvidence(repo, {
          id: deps.uuid(),
          tenantId: actor.tenantId,
          eventId: null,
          evidenceType: 'json',
          title: `Browser-Aktion freigegeben, Ausführung beginnt: ${action.type}`,
          source: 'browser-execute',
          snapshot: browserActionSnapshot({
            kind: 'browser.action.intent',
            tenantId: actor.tenantId,
            actor: { user_id: actor.user.id, role: actor.role },
            browserSessionId: session.id,
            correlationId,
            timestamp: now.toISOString(),
            action: redacted,
            target,
            policy: policySummary,
            approvalId,
            result: { status: 'executing', page_url: session.current_url, browser_execution_id: executionId },
            verification: null,
            artifacts: [],
          }),
        });
      } catch (error) {
        await finish('executor_failed', 'not_executed:evidence_unavailable');
        if (session.status === 'awaiting_approval') {
          await repo.updateSession(actor.tenantId, session.id, { status: 'ready', next_action: null, updated_at: deps.now().toISOString() }, ['awaiting_approval']);
        }
        pipeline.push({ step: 'execution', state: 'skipped', detail: 'evidence precondition failed' });
        throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', isBrowserRuntimeError(error) ? error.message : 'evidence could not be persisted', {
          pipeline, action_executed: false, ...consumedDetails,
        });
      }
    } else if (!(await evidenceAvailable(repo, actor.tenantId))) {
      pipeline.push({ step: 'execution', state: 'skipped', detail: 'evidence store unavailable' });
      throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', 'evidence store unavailable', { pipeline, action_executed: false });
    }

    // ── Ausführung ────────────────────────────────────────────────────────
    const logRow = await repo.insertActionLog({
      tenant_id: actor.tenantId,
      actor_id: actor.user.id,
      session_id: session.id,
      browser_session_id: session.id,
      browser_action: action.type,
      status: 'started',
      url: recordAction.type === 'navigate' ? recordAction.url.slice(0, 2048) : session.current_url,
      tool_name: 'governed-browser-runtime',
      policy_decision: decision.decision === 'ALLOW' ? 'allow' : 'require_approval',
      policy_id: decision.policy_id,
      policy_version: decision.policy_version,
      risk_level: decision.risk_level,
      approval_id: approvalId,
      browser_execution_id: executionId,
      correlation_id: correlationId,
      started_at: now.toISOString(),
      metadata: { action: redacted, initiated_by: initiatedBy },
    }).catch(() => null);

    // Lesende Aktion während einer offenen Freigabe: Freigabe-Zustand bleibt stehen.
    const keepAwaiting = session.status === 'awaiting_approval' && executionId === null;
    const locked = await repo.updateSession(actor.tenantId, session.id, {
      status: 'executing',
      ...(keepAwaiting ? {} : { next_action: executionId ? null : { action: redacted } }),
      updated_at: now.toISOString(),
    }, session.status === 'awaiting_approval' ? ['awaiting_approval'] : ['ready']);
    if (!locked) {
      await finish('executor_failed', 'not_executed:session_busy');
      if (logRow) await repo.updateActionLog(logRow.id, { status: 'failed', error_code: 'SESSION_BUSY', completed_at: deps.now().toISOString() }).catch(() => undefined);
      throw new BrowserRuntimeError('SESSION_BUSY', 'another action is running in this session', { action_executed: false, ...consumedDetails });
    }

    let execution: Awaited<ReturnType<ExecutorClient['execute']>> | null = null;
    let executionError: BrowserRuntimeError | null = null;
    try {
      // Freigabe gebunden an die Seite, die der Freigebende gesehen hat: der
      // Executor prüft die LIVE-Seite vor der Mutation (Review 09-29).
      execution = await deps.executor.execute(session.executor_session_id, action, {
        expectedUrl: executionId ? session.current_url : null,
      });
    } catch (error) {
      executionError = isBrowserRuntimeError(error) ? error : new BrowserRuntimeError('EXECUTION_FAILED', 'executor request failed');
    }
    const finishedAt = deps.now();
    const result = execution?.result ?? null;
    const executedOk = Boolean(result?.ok) && !executionError;
    const pageChanged = executionError?.code === 'PAGE_CHANGED';
    // Vor der Aktion stand die Seite schon auf einer gesperrten Adresse: der
    // Executor hat zurückgesetzt und nichts ausgeführt.
    const landingPrecheck = executionError?.code === 'URL_BLOCKED'
      && executionError.details?.executor_code === 'LANDED_ON_BLOCKED_URL';
    const notExecuted = pageChanged || landingPrecheck;
    pipeline.push({
      step: 'execution',
      state: executedOk ? 'done' : notExecuted ? 'skipped' : 'failed',
      detail: executionError?.code ?? (result?.ok === false ? safeErrorCode(result.error, 'ACTION_FAILED') : undefined),
    });

    // Gelandet auf einer nicht-öffentlichen Adresse (Redirect-Hop,
    // selbstständige Navigation)? Der Executor prüft das DNS-genau und meldet
    // LANDED_ON_BLOCKED_URL (Seite schon auf about:blank zurückgesetzt) — vor
    // der Aktion als Fehler (nichts ausgeführt), danach im Ergebnis. Hier
    // zusätzlich die statische Gegenprobe beider gemeldeter URLs.
    const page = execution?.page ?? null;
    const landedBlocked = landingPrecheck
      || result?.error === 'LANDED_ON_BLOCKED_URL'
      || isNonPublicHttpUrl(page?.url, deps.privateHostAllowlist)
      || isNonPublicHttpUrl(result?.url, deps.privateHostAllowlist);
    const landedUrl = landedBlocked ? 'about:blank' : (page?.url ?? result?.url ?? null);

    const verificationStatus: 'passed' | 'failed' | 'not_applicable' = !executedOk || landedBlocked
      ? 'failed'
      : (result?.verification?.status ?? 'not_applicable');
    pipeline.push({
      step: 'verification',
      state: verificationStatus === 'passed' ? 'done' : verificationStatus === 'failed' ? 'failed' : 'skipped',
      detail: landedBlocked ? 'LANDED_ON_NON_PUBLIC_URL' : verificationStatus,
    });

    // ── Ergebnis-Evidence ─────────────────────────────────────────────────
    const artifacts: Array<{ kind: string; sha256: string; bytes?: number }> = [];
    if (execution?.frame) artifacts.push({ kind: 'frame', sha256: execution.frame.sha256, bytes: execution.frame.bytes });
    if (result?.screenshot?.sha256) artifacts.push({ kind: 'screenshot', sha256: result.screenshot.sha256, bytes: result.screenshot.bytes });
    if (result?.download?.sha256) artifacts.push({ kind: 'download', sha256: result.download.sha256, bytes: result.download.bytes });
    const textSha = typeof result?.text === 'string' ? await textDigest(result.text) : null;
    if (textSha) artifacts.push({ kind: 'text', sha256: textSha, bytes: new TextEncoder().encode(result!.text!).length });

    const errorCode = executionError
      ? executionError.code
      : landedBlocked
        ? 'URL_BLOCKED'
        : (result?.ok === false ? safeErrorCode(result.error, 'ACTION_FAILED') : null);
    const blockedOrigin = landedBlocked
      ? (typeof executionError?.details?.blocked_origin === 'string'
        ? executionError.details.blocked_origin
        : typeof result?.verification?.checks?.blocked_origin === 'string'
          ? result.verification.checks.blocked_origin
          : null)
      : null;
    // Lief die Aktion? Auch wenn die Seite danach gesperrt landete — der
    // Nachweis darf die mögliche Nebenwirkung nicht als Fehlschlag tarnen.
    const ran = executedOk || (!executionError && result?.error === 'LANDED_ON_BLOCKED_URL');
    const outcomeTitle = ran
      ? (landedBlocked ? 'ausgeführt, danach gesperrt gelandet' : 'ausgeführt')
      : notExecuted ? 'nicht ausgeführt' : 'fehlgeschlagen';
    const resultSummary = {
      ok: executedOk && !landedBlocked,
      action_executed: ran,
      url: landedUrl,
      // Nichts von einer gesperrten Seite (auch nicht ihr Titel) in den Nachweis.
      title: landedBlocked ? null : (result?.title ?? page?.title ?? null),
      error_code: errorCode,
      text_chars: !landedBlocked && typeof result?.text === 'string' ? result.text.length : null,
      download: result?.download ? { filename: result.download.filename, bytes: result.download.bytes, mime: result.download.mime } : null,
      browser_execution_id: executionId,
      ...(landedBlocked ? { blocked_origin: blockedOrigin } : {}),
    };
    const checks = sanitizeChecks(result?.verification?.checks);

    let resultEvidence: ChainedEvidence | null = null;
    let resultEventId: string | null = null;
    let evidenceError = false;
    try {
      resultEventId = (await repo.insertEvent({
        tenant_id: actor.tenantId,
        event_type: ran ? 'browser.action.executed' : 'browser.action.failed',
        event_source: 'agent_runtime',
        title: `Browser-Aktion ${outcomeTitle}: ${action.type}`,
        summary: `${action.type}${target ? ` · ${target.slice(0, 200)}` : ''}`,
        risk_level: decision.risk_level,
        actor_email: actor.user.email ?? null,
        policy_action: decision.decision === 'ALLOW' ? 'allow' : 'require_approval',
        payload: {
          ...eventPayload,
          approval_id: approvalId,
          browser_execution_id: executionId,
          result: resultSummary,
          verification: verificationStatus,
        },
      })).id;
      resultEvidence = await appendChainedEvidence(repo, {
        id: deps.uuid(),
        tenantId: actor.tenantId,
        eventId: resultEventId,
        evidenceType: action.type === 'screenshot' ? 'screenshot' : 'json',
        title: `Browser-Aktion ${outcomeTitle}: ${action.type}`,
        source: 'browser-execute',
        snapshot: browserActionSnapshot({
          kind: 'browser.action.result',
          tenantId: actor.tenantId,
          actor: { user_id: actor.user.id, role: actor.role },
          browserSessionId: session.id,
          correlationId,
          timestamp: finishedAt.toISOString(),
          action: redacted,
          target,
          policy: policySummary,
          approvalId,
          result: { ...resultSummary, intent_evidence_id: intentEvidence?.id ?? null },
          verification: { status: verificationStatus, checks },
          artifacts,
        }),
      });
    } catch {
      evidenceError = true;
      deps.log({ level: 'error', scope: 'browser-execute', event: 'result_evidence_failed', correlation_id: correlationId, tenant_id: actor.tenantId, browser_execution_id: executionId });
    }
    pipeline.push({ step: 'evidence', state: resultEvidence ? 'done' : 'failed', detail: resultEvidence?.id });

    // ── Verbrauch festschreiben ───────────────────────────────────────────
    let finishOk = true;
    if (executionId) {
      if (executionError || !result) {
        finishOk = await finish('executor_failed', pageChanged
          ? 'not_executed:page_changed'
          : landingPrecheck
            ? 'not_executed:landed_on_blocked_url'
            : safeErrorCode(executionError?.code, 'EXECUTION_FAILED'));
      } else if (result.error === 'LANDED_ON_BLOCKED_URL') {
        // Die Aktion lief (Nebenwirkung möglich), erst danach landete die Seite
        // auf einer gesperrten Adresse — als ausgeführt festhalten, nicht als
        // Fehlschlag, damit der Nachweis die Nebenwirkung nicht verschweigt.
        finishOk = await finish(evidenceError ? 'executed_unrecorded' : 'executed', 'landed_on_blocked_url');
      } else if (!executedOk) {
        finishOk = await finish('executor_failed', safeErrorCode(result.error, 'ACTION_FAILED'));
      } else if (evidenceError) {
        finishOk = await finish('executed_unrecorded', 'governance evidence');
      } else {
        finishOk = await finish('executed', null);
      }
    }

    // ── Zustand nachführen ────────────────────────────────────────────────
    const sessionLost = executionError?.code === 'SESSION_NOT_FOUND';
    if (landedBlocked) await deps.executor.closeSession(session.executor_session_id).catch(() => undefined);
    const nextStatus: SessionStatus = sessionLost || landedBlocked
      ? 'failed'
      : evidenceError && cls !== 'read_only'
        ? 'paused' // Mutation ausgeführt, Nachweis fehlt: Mensch muss prüfen.
        : keepAwaiting
          ? 'awaiting_approval'
          : 'ready';
    const livePageUrl = pageChanged && typeof executionError?.details?.current_url === 'string'
      ? executionError.details.current_url
      : null;
    const updated = await repo.updateSession(actor.tenantId, session.id, {
      status: nextStatus,
      current_url: landedBlocked
        ? 'about:blank'
        : (livePageUrl ?? page?.url ?? result?.url ?? session.current_url)?.slice(0, 2048) ?? null,
      page_title: landedBlocked ? null : (page?.title ?? result?.title ?? session.page_title)?.slice(0, 500) ?? null,
      last_action: {
        type: action.type,
        outcome: ran ? 'executed' : notExecuted ? 'not_executed' : 'failed',
        verification: verificationStatus,
        at: finishedAt.toISOString(),
        evidence_id: resultEvidence?.id ?? null,
        event_id: resultEventId,
      },
      ...(keepAwaiting ? {} : { next_action: null }),
      last_error_code: errorCode ? safeErrorCode(errorCode) : null,
      last_frame_sha256: execution?.frame?.sha256 ?? null,
      last_frame_at: execution?.frame ? finishedAt.toISOString() : null,
      action_count: session.action_count + 1,
      expires_at: nextExpiry(finishedAt, new Date(session.created_at)).toISOString(),
      updated_at: finishedAt.toISOString(),
      ...(sessionLost || landedBlocked ? { closed_at: finishedAt.toISOString() } : {}),
    }, ['executing']).catch(() => null);
    if (logRow) {
      await repo.updateActionLog(logRow.id, {
        status: executedOk && !landedBlocked ? 'completed' : 'failed',
        completed_at: finishedAt.toISOString(),
        duration_ms: finishedAt.getTime() - startedAt.getTime(),
        verification: verificationStatus,
        governance_event_id: resultEventId,
        evidence_id: resultEvidence?.id ?? null,
        evidence_hash: resultEvidence?.content_hash ?? null,
        error_code: errorCode ? safeErrorCode(errorCode) : null,
        url: resultSummary.url?.slice(0, 2048) ?? null,
      }).catch(() => undefined);
    }

    if (executionError) {
      throw new BrowserRuntimeError(executionError.code, executionError.message, {
        ...(executionError.details ?? {}),
        pipeline,
        evidence_id: resultEvidence?.id ?? null,
        action_executed: notExecuted ? false : undefined,
        ...(landingPrecheck ? { session_status: nextStatus } : {}),
        ...consumedDetails,
      });
    }
    if (landedBlocked) {
      throw new BrowserRuntimeError('URL_BLOCKED', 'the page ended up on a non-public address; session closed', {
        reason: 'LANDED_ON_NON_PUBLIC_URL',
        action_executed: true,
        blocked_origin: blockedOrigin,
        pipeline,
        evidence_id: resultEvidence?.id ?? null,
        ...consumedDetails,
      });
    }
    if (evidenceError) {
      throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', 'action ran but its evidence could not be persisted', {
        pipeline,
        action_executed: executedOk,
        execution_status: executionId ? 'executed_unrecorded' : null,
        session_status: nextStatus,
        ...consumedDetails,
      });
    }
    if (!finishOk) {
      // ok erst nach geschriebenem Abschluss (#1728): sonst bleibt die
      // Reservierung stehen und der Aufrufer bekommt kein ok.
      throw new BrowserRuntimeError('EVIDENCE_WRITE_FAILED', 'action ran and was recorded, but its execution status could not be finalized', {
        pipeline,
        action_executed: executedOk,
        execution_status: 'reserved',
        evidence_id: resultEvidence?.id ?? null,
        ...consumedDetails,
      });
    }

    return ok({
      decision: policySummary,
      pipeline,
      result: {
        ok: executedOk,
        url: resultSummary.url,
        title: resultSummary.title,
        error_code: resultSummary.error_code,
        ...(typeof result?.text === 'string' ? { text: result.text } : {}),
        ...(result?.dom !== undefined ? { dom: result.dom } : {}),
        ...(result?.download ? { download: result.download } : {}),
        ...(result?.screenshot?.base64 ? { screenshot: { base64: result.screenshot.base64, sha256: result.screenshot.sha256 } } : {}),
      },
      verification: { status: verificationStatus, checks },
      evidence: resultEvidence
        ? { id: resultEvidence.id, content_hash: resultEvidence.content_hash, previous_hash: resultEvidence.previous_hash, event_id: resultEventId }
        : null,
      approval_id: approvalId,
      execution_id: executionId,
      session: updated ? publicSession(updated as SessionRow & Record<string, unknown>) : null,
      frame: framePayload(execution?.frame ?? null),
    }, correlationId);
  }

  // ── Router ───────────────────────────────────────────────────────────────
  return async function handle(req: Request): Promise<Response> {
    const preflight = handleOptions(req, corsHeaders);
    if (preflight) return preflight;
    const correlationId = deps.uuid();
    if (req.method !== 'POST') return fail(new BrowserRuntimeError('VALIDATION_FAILED', 'POST only'), correlationId);

    let body: Record<string, unknown>;
    try {
      const raw = await req.json();
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('not an object');
      body = raw as Record<string, unknown>;
    } catch {
      return fail(new BrowserRuntimeError('VALIDATION_FAILED', 'invalid JSON body'), correlationId);
    }

    const op = typeof body.op === 'string' ? body.op : '';
    const tenantHint = typeof body.tenant_id === 'string' && UUID_RE.test(body.tenant_id) ? body.tenant_id.toLowerCase() : null;
    const resolved = await deps.resolveActor(req, tenantHint);
    if (typeof resolved === 'string') {
      return fail(new BrowserRuntimeError(resolved, resolved === 'TENANT_REQUIRED' ? 'tenant_id is required' : 'not authorized'), correlationId);
    }
    const actor = resolved;

    try {
      switch (op) {
        case 'health': {
          const executor = await probeExecutor(deps.repo(actor));
          return ok({ executor }, correlationId);
        }
        case 'capabilities': {
          const repo = deps.repo(actor);
          const caps = await capabilitiesFor(actor, repo);
          return ok({
            tenant: { id: actor.tenantId, verified: true, authority: 'membership', role: actor.role },
            executor: caps.executor,
            entitlement: { key: BROWSER_RUNTIME_ENTITLEMENT, status: caps.entitlement },
            policy: {
              authority: 'server',
              policy_id: BASELINE_POLICY_ID,
              policy_version: BASELINE_POLICY_VERSION,
              tenant_policies_loaded: caps.policyReady,
              mutation_approval: 'required',
              limits: EXECUTION_LIMITS,
            },
            evidence: { available: caps.evidence, store: 'governance_evidence', chain: 'append_governance_evidence' },
            kill_switch: { engaged: deps.killSwitchEngaged() },
            ...caps.report,
          }, correlationId);
        }
        case 'session_create':
          return await sessionCreate(actor, body, correlationId);
        case 'session_get': {
          const repo = deps.repo(actor);
          const session = await repo.getSession(actor.tenantId, requireUuid(body.session_id, 'session_id'));
          if (!session) throw new BrowserRuntimeError('SESSION_NOT_FOUND', 'session not found');
          return ok({ session: publicSession(session as SessionRow & Record<string, unknown>) }, correlationId);
        }
        case 'session_list': {
          const sessions = await deps.repo(actor).listOpenSessions(actor.tenantId);
          return ok({ sessions: sessions.map((s) => publicSession(s as SessionRow & Record<string, unknown>)) }, correlationId);
        }
        case 'session_frame': {
          const repo = deps.repo(actor);
          const session = await loadOwnedSession(repo, actor, requireUuid(body.session_id, 'session_id'));
          if (!OPEN_STATUSES.has(session.status)) throw new BrowserRuntimeError('SESSION_NOT_FOUND', `session is ${session.status}`);
          if (isExpired(session, deps.now())) throw new BrowserRuntimeError('SESSION_EXPIRED', 'session expired');
          try {
            const { page, frame } = await deps.executor.frame(session.executor_session_id);
            const seenAt = deps.now();
            // Zuschauen ist Aktivität der Eigentümerin: Idle-Frist verlängern
            // (gedeckelt durch das Höchstalter), Seite nachführen.
            const refreshed = await repo.updateSession(actor.tenantId, session.id, {
              ...(page ? { current_url: page.url.slice(0, 2048), page_title: page.title.slice(0, 500) } : {}),
              last_frame_sha256: frame.sha256,
              last_frame_at: seenAt.toISOString(),
              expires_at: nextExpiry(seenAt, new Date(session.created_at)).toISOString(),
              updated_at: seenAt.toISOString(),
            }).catch(() => null);
            return ok({
              frame: framePayload(frame),
              page,
              session_status: session.status,
              expires_at: refreshed?.expires_at ?? session.expires_at,
            }, correlationId);
          } catch (error) {
            if (isBrowserRuntimeError(error) && error.code === 'SESSION_NOT_FOUND') await markSessionLost(repo, session, deps.now());
            if (isBrowserRuntimeError(error) && error.code === 'URL_BLOCKED') {
              // Die Seite stand beim Zuschauen auf einer gesperrten Adresse
              // (z. B. selbstständiger Redirect): kein Bild, Session zu,
              // offene Freigaben dieser Session hinfällig.
              await deps.executor.closeSession(session.executor_session_id).catch(() => undefined);
              await markSessionLost(repo, session, deps.now(), 'LANDED_ON_NON_PUBLIC_URL');
              await repo.cancelPendingSessionApprovals(actor.tenantId, [session.id]).catch(() => [] as string[]);
              deps.log({ level: 'warn', scope: 'browser-execute', event: 'frame_landing_blocked', tenant_id: actor.tenantId, correlation_id: correlationId });
            }
            throw error;
          }
        }
        case 'session_close': {
          const repo = deps.repo(actor);
          const session = await repo.getSession(actor.tenantId, requireUuid(body.session_id, 'session_id'));
          if (!session) throw new BrowserRuntimeError('SESSION_NOT_FOUND', 'session not found');
          if (session.user_id !== actor.user.id && !APPROVER_ROLES.has(actor.role)) {
            throw new BrowserRuntimeError('FORBIDDEN', 'only the session owner or an owner/admin can close it');
          }
          await deps.executor.closeSession(session.executor_session_id).catch(() => undefined);
          const now = deps.now();
          const cancelledApprovals = await repo.cancelPendingSessionApprovals(actor.tenantId, [session.id]).catch(() => [] as string[]);
          const closed = await repo.updateSession(actor.tenantId, session.id, {
            status: 'closed', closed_at: now.toISOString(), next_action: null, updated_at: now.toISOString(),
          });
          await repo.insertActionLog({
            tenant_id: actor.tenantId, actor_id: actor.user.id, session_id: session.id, browser_session_id: session.id,
            browser_action: 'session_close', status: 'completed', tool_name: 'governed-browser-runtime',
            started_at: now.toISOString(), completed_at: now.toISOString(), correlation_id: correlationId, metadata: {},
          }).catch(() => undefined);
          await appendChainedEvidence(repo, {
            id: deps.uuid(), tenantId: actor.tenantId, eventId: null, evidenceType: 'log',
            title: 'Browser-Session geschlossen', source: 'browser-execute',
            snapshot: browserActionSnapshot({
              kind: 'browser.session.closed', tenantId: actor.tenantId,
              actor: { user_id: actor.user.id, role: actor.role }, browserSessionId: session.id,
              correlationId, timestamp: now.toISOString(), action: { type: 'session_close' }, target: null,
              policy: null, approvalId: null, result: { action_count: session.action_count, cancelled_approvals: cancelledApprovals }, verification: null, artifacts: [],
            }),
          }).catch(() => deps.log({ level: 'error', scope: 'browser-execute', event: 'close_evidence_failed', correlation_id: correlationId }));
          return ok({ session: closed ? publicSession(closed as SessionRow & Record<string, unknown>) : null }, correlationId);
        }
        case 'act':
          return await act(actor, body, correlationId);
        case 'execute': {
          // Alt-Client (vor 2026-09-29): Session-ID aus localStorage, Aktions-Array.
          if (!Array.isArray(body.actions) || body.actions.length !== 1 || typeof body.session_id !== 'string' || !UUID_RE.test(body.session_id)) {
            throw new BrowserRuntimeError('SESSION_NOT_FOUND', 'legacy execute without a server session is no longer supported; reload the dashboard');
          }
          return await act(actor, { session_id: body.session_id, action: body.actions[0], approval_id: body.approval_id }, correlationId);
        }
        case 'approval_status': {
          const approval = await deps.repo(actor).getApproval(actor.tenantId, requireUuid(body.approval_id, 'approval_id'));
          if (!approval) throw new BrowserRuntimeError('APPROVAL_NOT_FOUND', 'approval not found');
          const openStatus = approval.status === 'pending' || approval.status === 'approved';
          const expired = openStatus && approval.execution === null && Date.parse(approval.expires_at) <= deps.now().getTime();
          return ok({
            approval: {
              id: approval.id,
              status: expired ? 'expired' : approval.status,
              expires_at: approval.expires_at,
              resolved_at: approval.resolved_at,
              event_id: approval.event_id,
              // Verbrauch aus browser_executions (#1728): reserved | executed |
              // executed_unrecorded | executor_failed — null = nie eingelöst.
              execution: approval.execution
                ? {
                  status: approval.execution.status,
                  reserved_at: approval.execution.reserved_at,
                  finished_at: approval.execution.finished_at,
                  detail: approval.execution.detail,
                }
                : null,
            },
          }, correlationId);
        }
        case 'approval_cancel': {
          // Zurückziehen bis zur Einlösung: offen ODER freigegeben-und-unbenutzt.
          // Status + gekettete Evidence atomar (decide_governance_approval).
          const repo = deps.repo(actor);
          const approval = await repo.getApproval(actor.tenantId, requireUuid(body.approval_id, 'approval_id'));
          if (!approval) throw new BrowserRuntimeError('APPROVAL_NOT_FOUND', 'approval not found');
          if (approval.requested_by !== actor.user.id && !APPROVER_ROLES.has(actor.role)) {
            throw new BrowserRuntimeError('FORBIDDEN', 'only the requester or an owner/admin can cancel');
          }
          const decidedAt = deps.now().toISOString();
          const decision = await decideWithEvidence(repo, {
            approvalId: approval.id,
            tenantId: actor.tenantId,
            decidedBy: actor.user.id,
            target: 'cancelled',
            reason: approval.requested_by === actor.user.id ? 'withdrawn by requester' : 'withdrawn by owner/admin',
            decidedAt,
            evidence: {
              id: deps.uuid(),
              eventId: approval.event_id,
              evidenceType: 'approval',
              title: 'Approval withdrawn',
              source: 'browser-execute',
              snapshot: {
                kind: 'approval.decision',
                approval_id: approval.id,
                decision: 'cancelled',
                resolved_by_user_id: actor.user.id,
                resolved_at: decidedAt,
                requested_by: approval.requested_by,
                browser_session_id: approval.browser_session_id,
                correlation_id: correlationId,
              },
            },
          });
          const cancelled = decision.outcome === 'decided';
          if ((cancelled || decision.outcome === 'expired') && approval.browser_session_id) {
            await repo.updateSession(actor.tenantId, approval.browser_session_id, {
              status: 'ready', next_action: null, updated_at: decidedAt,
            }, ['awaiting_approval']);
          }
          return ok({
            cancelled,
            outcome: decision.outcome,
            approval_status: decision.approval_status,
            evidence_id: decision.evidence_id,
          }, correlationId);
        }
        case 'kill_all': {
          if (!APPROVER_ROLES.has(actor.role)) throw new BrowserRuntimeError('FORBIDDEN', 'owner or admin required');
          const repo = deps.repo(actor);
          const open = await repo.listOpenSessions(actor.tenantId);
          const now = deps.now();
          for (const s of open) {
            await deps.executor.closeSession(s.executor_session_id).catch(() => undefined);
            await repo.updateSession(actor.tenantId, s.id, {
              status: 'closed', closed_at: now.toISOString(), next_action: null, last_error_code: 'KILLED', updated_at: now.toISOString(),
            });
          }
          const cancelled = await repo.cancelPendingSessionApprovals(actor.tenantId, open.map((s) => s.id)).catch(() => [] as string[]);
          deps.log({ level: 'warn', scope: 'browser-execute', event: 'kill_all', tenant_id: actor.tenantId, correlation_id: correlationId, sessions: open.length });
          return ok({ closed_sessions: open.length, cancelled_approvals: cancelled.length }, correlationId);
        }
        case 'plan': {
          if (!deps.plan) throw new BrowserRuntimeError('INTERNAL_ERROR', 'planner not configured');
          return await deps.plan(actor, body.task, body.current_url);
        }
        default:
          throw new BrowserRuntimeError('VALIDATION_FAILED', 'unknown op');
      }
    } catch (error) {
      if (isBrowserRuntimeError(error)) {
        deps.log({ level: error.status >= 500 ? 'error' : 'info', scope: 'browser-execute', op, code: error.code, correlation_id: correlationId, tenant_id: actor.tenantId });
        return fail(error, correlationId);
      }
      deps.log({ level: 'error', scope: 'browser-execute', op, code: 'INTERNAL_ERROR', correlation_id: correlationId, tenant_id: actor.tenantId, message: (error as Error)?.message?.slice(0, 200) ?? 'unknown' });
      return fail(new BrowserRuntimeError('INTERNAL_ERROR', 'internal error'), correlationId);
    }
  };
}
