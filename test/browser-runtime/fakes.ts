/**
 * In-Memory-Fakes für browser-execute (handler.ts).
 *
 * Der Repo-Fake bildet die SQL-Semantik der Migration
 * 20260929100000_browser_runtime_governed_sessions.sql nach:
 *   - append_governance_evidence: Compare-and-Swap auf den Kettenkopf
 *   - consume_browser_approval: gleiche Prüfreihenfolge und Rückgabecodes
 *   - finish_browser_approval: nur verbrauchte, freigegebene Freigaben
 *   - bedingte Session-Updates (status ∈ expected)
 * Die echte Datenbanksemantik prüft test/runtime/db/browser-runtime-sessions.db.test.ts.
 */
import type {
  ApprovalConsumeCode,
  ApprovalRow,
  BrowserExecuteDeps,
  BrowserRuntimeRepo,
  VerifiedActor,
} from '../../supabase/functions/browser-execute/handler';
import type { SessionRow, SessionStatus } from '../../supabase/functions/_shared/browser-runtime/session';
import type { EvidenceRow } from '../../supabase/functions/_shared/browser-runtime/evidence';
import type {
  ExecutorClient,
  ExecutorExecuteResult,
  ExecutorHealth,
} from '../../supabase/functions/_shared/browser-runtime/executor';
import { BrowserRuntimeError } from '../../supabase/functions/_shared/browser-runtime/errors';
import type { BrowserAction } from '../../supabase/functions/_shared/browser-runtime/actions';
import type { TenantPolicyOverlay } from '../../supabase/functions/_shared/browser-runtime/policy';

export const TENANT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const TENANT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const USER_1 = '11111111-1111-4111-8111-111111111111';
export const USER_2 = '22222222-2222-4222-8222-222222222222';

type Row = Record<string, unknown>;

export class FakeDb {
  sessions: Array<SessionRow & Row> = [];
  events: Row[] = [];
  approvals: Array<ApprovalRow & Row> = [];
  bindings: Row[] = [];
  evidence: EvidenceRow[] = [];
  actionLog: Array<Row & { id: string }> = [];
  executorStatus = new Map<string, Row>();
  failEvidence = false;
  failEvidenceRead = false;
  now: () => Date;
  private seq = 0;
  constructor(now: () => Date) { this.now = now; }
  id(): string {
    this.seq += 1;
    return `00000000-0000-4000-8000-${this.seq.toString().padStart(12, '0')}`;
  }

  repo(tenantScope: string): BrowserRuntimeRepo {
    const db = this;
    const scoped = <T extends { tenant_id?: unknown }>(rows: T[]) => rows.filter((r) => r.tenant_id === tenantScope);
    return {
      async latestEvidenceHash(tenantId) {
        if (db.failEvidenceRead) throw new Error('evidence read failed');
        const rows = db.evidence.filter((e) => e.tenant_id === tenantId && e.content_hash);
        return rows.length ? rows[rows.length - 1].content_hash : null;
      },
      async appendEvidence(row: EvidenceRow, expected) {
        if (db.failEvidence) throw new Error('append_governance_evidence: 42501');
        const rows = db.evidence.filter((e) => e.tenant_id === row.tenant_id && e.content_hash);
        const head = rows.length ? rows[rows.length - 1].content_hash : null;
        if (row.previous_hash !== expected) throw new Error('22023');
        if (head !== expected) return 'conflict';
        db.evidence.push({ ...row });
        return { id: row.id };
      },
      async countOpenSessions(tenantId, nowIso) {
        return db.sessions.filter((s) => s.tenant_id === tenantId
          && ['creating', 'ready', 'executing', 'awaiting_approval', 'paused'].includes(s.status)
          && s.expires_at > nowIso).length;
      },
      async insertSession(row) {
        const s = { ...row, last_action: null, next_action: null, last_error_code: null } as SessionRow & Row;
        db.sessions.push(s);
        return { ...s };
      },
      async getSession(tenantId, sessionId) {
        const s = scoped(db.sessions).find((x) => x.tenant_id === tenantId && x.id === sessionId);
        return s ? { ...s } : null;
      },
      async updateSession(tenantId, sessionId, patch, expected?: readonly SessionStatus[]) {
        const s = scoped(db.sessions).find((x) => x.tenant_id === tenantId && x.id === sessionId);
        if (!s) return null;
        if (expected && expected.length > 0 && !expected.includes(s.status)) return null;
        Object.assign(s, patch);
        return { ...s };
      },
      async listOpenSessions(tenantId) {
        return db.sessions.filter((s) => s.tenant_id === tenantId && ['creating', 'ready', 'executing', 'awaiting_approval', 'paused'].includes(s.status)).map((s) => ({ ...s }));
      },
      async insertEvent(row) {
        const e = { id: db.id(), ...row };
        db.events.push(e);
        return { id: e.id as string };
      },
      async insertApproval(row) {
        const a = { id: db.id(), resolved_at: null, consumed_at: null, executed_at: null, consumed_by: null, ...row } as unknown as ApprovalRow & Row;
        db.approvals.push(a);
        return { id: a.id, expires_at: a.expires_at };
      },
      async insertApprovalBinding(row) {
        db.bindings.push({ ...row });
      },
      async getApproval(tenantId, approvalId) {
        const a = db.approvals.find((x) => x.tenant_id === tenantId && x.id === approvalId);
        return a ? { ...a } : null;
      },
      async cancelApproval(tenantId, approvalId) {
        const a = db.approvals.find((x) => x.tenant_id === tenantId && x.id === approvalId && x.status === 'pending');
        if (!a) return false;
        a.status = 'cancelled';
        return true;
      },
      async cancelPendingSessionApprovals(tenantId, sessionIds) {
        let n = 0;
        for (const a of db.approvals) {
          if (a.tenant_id === tenantId && a.browser_session_id && sessionIds.includes(a.browser_session_id)
            && ['pending', 'approved'].includes(a.status) && !a.consumed_at) {
            a.status = 'cancelled';
            n += 1;
          }
        }
        return n;
      },
      async consumeApproval(approvalId, tenantId, sessionId, fingerprint, consumer): Promise<ApprovalConsumeCode> {
        const a = db.approvals.find((x) => x.id === approvalId && x.tenant_id === tenantId);
        if (!a) return 'not_found';
        const b = db.bindings.find((x) => x.approval_id === approvalId);
        if (a.consumed_at || a.status === 'executed' || a.status === 'failed') return 'already_used';
        if ((a.status === 'pending' || a.status === 'approved') && Date.parse(a.expires_at) <= db.now().getTime()) {
          a.status = 'expired';
          return 'expired';
        }
        if (a.status === 'pending') return 'pending';
        if (a.status === 'rejected') return 'rejected';
        if (a.status === 'cancelled') return 'cancelled';
        if (a.status === 'expired') return 'expired';
        if (!b || b.browser_session_id !== sessionId || b.fingerprint !== fingerprint) return 'mismatch';
        a.consumed_at = db.now().toISOString();
        (a as Row).consumed_by = consumer;
        return 'consumed';
      },
      async finishApproval(approvalId, tenantId, outcome) {
        const a = db.approvals.find((x) => x.id === approvalId && x.tenant_id === tenantId && x.status === 'approved' && x.consumed_at);
        if (!a) return false;
        a.status = outcome;
        a.executed_at = db.now().toISOString();
        return true;
      },
      async insertActionLog(row) {
        const r = { id: db.id(), ...row };
        db.actionLog.push(r);
        return { id: r.id };
      },
      async updateActionLog(id, patch) {
        const r = db.actionLog.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      },
      async getExecutorLastSeen(executorId) {
        return (db.executorStatus.get(executorId)?.last_seen_at as string | null) ?? null;
      },
      async upsertExecutorStatus(health, lastSeenAt) {
        db.executorStatus.set(health.executor_id, { ...health, last_seen_at: lastSeenAt });
      },
    };
  }

  /** Simuliert governance-approvals op=approve (owner/admin). */
  approve(approvalId: string): void {
    const a = this.approvals.find((x) => x.id === approvalId);
    if (!a) throw new Error('no approval');
    a.status = 'approved';
    a.resolved_at = this.now().toISOString();
  }

  reject(approvalId: string): void {
    const a = this.approvals.find((x) => x.id === approvalId);
    if (!a) throw new Error('no approval');
    a.status = 'rejected';
  }
}

export interface FakeExecutor extends ExecutorClient {
  healthValue: ExecutorHealth;
  calls: Array<{ op: string; session?: string; action?: BrowserAction }>;
  pageUrl: string;
  failNext: BrowserRuntimeError | null;
  openSessions: Set<string>;
}

const FRAME = { mime: 'image/jpeg' as const, base64: 'AAAA', sha256: 'f'.repeat(64), bytes: 3, captured_at: '2026-09-29T00:00:00.000Z' };

export function readyHealth(): ExecutorHealth {
  return {
    executor_id: 'default',
    status: 'ready',
    reason_code: null,
    checked_at: '2026-09-29T00:00:00.000Z',
    runtime: 'playwright-chromium',
    version: '2026.09.1',
    browser_version: '141.0',
    active_sessions: 0,
    max_sessions: 20,
    capabilities: ['sessions', 'frame', 'navigate', 'scroll', 'click', 'type', 'select', 'submit', 'wait', 'read_text', 'read_dom', 'screenshot', 'back', 'forward', 'reload', 'download'],
  };
}

export function createFakeExecutor(): FakeExecutor {
  const ex: FakeExecutor = {
    configured: true,
    executorId: 'default',
    healthValue: readyHealth(),
    calls: [],
    pageUrl: 'about:blank',
    failNext: null,
    openSessions: new Set(),
    async health() { return { ...ex.healthValue }; },
    async openSession(id) {
      ex.calls.push({ op: 'open', session: id });
      if (ex.failNext) { const e = ex.failNext; ex.failNext = null; throw e; }
      ex.openSessions.add(id);
      return { page: { url: 'about:blank', title: '', loading: false }, frame: FRAME, version: '2026.09.1' };
    },
    async frame(id) {
      ex.calls.push({ op: 'frame', session: id });
      if (!ex.openSessions.has(id)) throw new BrowserRuntimeError('SESSION_NOT_FOUND', 'executor session not found');
      return { page: { url: ex.pageUrl, title: 'T', loading: false }, frame: FRAME };
    },
    async closeSession(id) {
      ex.calls.push({ op: 'close', session: id });
      ex.openSessions.delete(id);
    },
    async execute(id, action): Promise<ExecutorExecuteResult> {
      ex.calls.push({ op: 'execute', session: id, action });
      if (ex.failNext) { const e = ex.failNext; ex.failNext = null; throw e; }
      if (!ex.openSessions.has(id)) throw new BrowserRuntimeError('SESSION_NOT_FOUND', 'executor session not found');
      if (action.type === 'navigate') ex.pageUrl = action.url;
      return {
        result: {
          type: action.type,
          ok: true,
          url: ex.pageUrl,
          title: 'Seite',
          ...(action.type === 'read_text' || action.type === 'extract' ? { text: 'Hallo Welt' } : {}),
          verification: { status: action.type === 'wait' ? 'not_applicable' : 'passed', checks: {} },
        },
        page: { url: ex.pageUrl, title: 'Seite', loading: false },
        frame: FRAME,
      };
    },
  };
  return ex;
}

export interface Harness {
  db: FakeDb;
  executor: FakeExecutor;
  deps: BrowserExecuteDeps;
  clock: { t: number };
  actors: Map<string, VerifiedActor>;
  logs: Array<Record<string, unknown>>;
  entitlement: { value: 'granted' | 'denied' | 'unavailable' };
  tenantPolicy: { value: TenantPolicyOverlay };
  killSwitch: { on: boolean };
}

/** Token → Aktor. Unbekannte Tokens = 401, fremder Mandant = 403. */
export function createHarness(): Harness {
  const clock = { t: Date.parse('2026-09-29T10:00:00.000Z') };
  const now = () => new Date(clock.t);
  const db = new FakeDb(now);
  const executor = createFakeExecutor();
  const logs: Array<Record<string, unknown>> = [];
  const entitlement = { value: 'granted' as 'granted' | 'denied' | 'unavailable' };
  const tenantPolicy: { value: TenantPolicyOverlay } = {
    value: { status: 'evaluated', decision: 'allow', policy_id: null, snapshot_version: 'snap1', reason_text: null },
  };
  const killSwitch = { on: false };
  const memberships: Record<string, Record<string, string>> = {
    'token-owner': { [TENANT_A]: 'owner' },
    'token-editor': { [TENANT_A]: 'editor' },
    'token-viewer': { [TENANT_A]: 'viewer_auditor' },
    'token-b': { [TENANT_B]: 'owner' },
  };
  const users: Record<string, string> = { 'token-owner': USER_1, 'token-editor': USER_2, 'token-viewer': USER_2, 'token-b': USER_2 };
  const actors = new Map<string, VerifiedActor>();
  let uuidSeq = 0;

  const deps: BrowserExecuteDeps = {
    async resolveActor(req, tenantId) {
      const token = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
      if (!users[token]) return 'AUTH_REQUIRED';
      if (!tenantId) return 'TENANT_REQUIRED';
      const role = memberships[token]?.[tenantId];
      if (!role) return 'FORBIDDEN';
      const actor: VerifiedActor = { user: { id: users[token], email: `${token}@example.com` }, tenantId, role };
      actors.set(token, actor);
      return actor;
    },
    repo: (actor) => db.repo(actor.tenantId),
    executor,
    async entitlement() { return entitlement.value; },
    async tenantPolicy() { return tenantPolicy.value; },
    async tenantPolicyReady() { return tenantPolicy.value.status === 'evaluated'; },
    killSwitchEngaged: () => killSwitch.on,
    privateHostAllowlist: [],
    now,
    uuid: () => {
      uuidSeq += 1;
      return `99999999-9999-4999-8999-${uuidSeq.toString().padStart(12, '0')}`;
    },
    randomBytes: (n) => new Uint8Array(n).map((_, i) => (i * 7 + uuidSeq) % 256),
    log: (entry) => logs.push(entry),
  };
  return { db, executor, deps, clock, actors, logs, entitlement, tenantPolicy, killSwitch };
}

export function call(handler: (req: Request) => Promise<Response>, token: string | null, body: Record<string, unknown>) {
  return handler(new Request('https://fn.local/browser-execute', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })).then(async (res) => ({ status: res.status, body: await res.json() as Record<string, any> }));
}
