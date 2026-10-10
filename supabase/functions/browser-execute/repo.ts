// browser-execute — Supabase-gestütztes Repository (service_role, erst nach
// verifizierter Mitgliedschaft erzeugt). Strukturell typisiert, Deno-frei.
//
// Jede Abfrage ist mandantengebunden (eq('tenant_id', …)); der Mandant kommt
// aus dem verifizierten Aktor, nie aus dem Request-Body.
//
// Einmal-Verbrauch einer Freigabe: reserve_browser_execution /
// finish_browser_execution aus #1728 (browser_executions, UNIQUE(approval_id)).

import type { BrowserRuntimeRepo, ApprovalRow, Reservation, ExecutionEndStatus } from './handler.ts';
import type { SessionRow, SessionStatus } from '../_shared/browser-runtime/session.ts';
import type { EvidenceRow } from '../_shared/browser-runtime/evidence.ts';
import type { ExecutorHealth } from '../_shared/browser-runtime/executor.ts';
import { BrowserRuntimeError } from '../_shared/browser-runtime/errors.ts';
import { createEvidenceChainRepo } from '../_shared/evidence-chain-repo.ts';

// deno-lint-ignore no-explicit-any
type Db = any;

interface PgError { message: string; code?: string; details?: string | null }
interface PgResult<T> { data: T | null; error: PgError | null }

function unwrap<T>(r: PgResult<T>, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.code ?? 'error'}`);
  return r.data as T;
}

const SESSION_COLUMNS =
  'id, tenant_id, user_id, executor_session_id, mode, status, current_url, page_title, last_action, next_action, ' +
  'last_error_code, last_frame_sha256, last_frame_at, action_count, executor_version, created_at, updated_at, expires_at, closed_at';

const OPEN = ['creating', 'ready', 'executing', 'awaiting_approval', 'paused'];

const RESERVATION_OUTCOMES: ReadonlySet<string> = new Set([
  'reserved', 'already_used', 'not_found', 'not_approved', 'expired', 'mismatch',
]);

/** PostgREST bettet eine 1:1-Beziehung je nach Version als Objekt oder Array ein. */
function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export function createBrowserRuntimeRepo(db: Db): BrowserRuntimeRepo {
  const chain = createEvidenceChainRepo(db);
  return {
    latestEvidenceHash: (tenantId) => chain.latestEvidenceHash(tenantId),
    appendEvidence: (row: EvidenceRow, expected) => chain.appendEvidence(row, expected),
    decideApproval: (input) => chain.decideApproval(input),

    async countOpenSessions(tenantId, nowIso) {
      const r = await db.from('browser_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('status', OPEN)
        .gt('expires_at', nowIso);
      if (r.error) throw new Error(`browser_sessions count: ${r.error.code ?? 'error'}`);
      return r.count ?? 0;
    },

    async insertSession(row) {
      const r: PgResult<SessionRow> = await db.from('browser_sessions').insert(row).select(SESSION_COLUMNS).single();
      // Trigger browser_sessions_enforce_open_limit (Advisory-Lock je Mandant).
      if (r.error?.code === 'P0001' && r.error.details === 'BROWSER_SESSION_LIMIT_REACHED') {
        throw new BrowserRuntimeError('SESSION_LIMIT_REACHED', 'at most 3 open sessions per tenant');
      }
      return unwrap(r, 'browser_sessions insert');
    },

    async getSession(tenantId, sessionId) {
      const r: PgResult<SessionRow> = await db.from('browser_sessions')
        .select(SESSION_COLUMNS).eq('tenant_id', tenantId).eq('id', sessionId).maybeSingle();
      return unwrap(r, 'browser_sessions get');
    },

    async updateSession(tenantId, sessionId, patch, expected?: readonly SessionStatus[]) {
      let q = db.from('browser_sessions').update(patch).eq('tenant_id', tenantId).eq('id', sessionId);
      if (expected && expected.length > 0) q = q.in('status', [...expected]);
      const r: PgResult<SessionRow> = await q.select(SESSION_COLUMNS).maybeSingle();
      return unwrap(r, 'browser_sessions update');
    },

    async listOpenSessions(tenantId) {
      const r: PgResult<SessionRow[]> = await db.from('browser_sessions')
        .select(SESSION_COLUMNS)
        .eq('tenant_id', tenantId)
        .in('status', OPEN)
        .order('created_at', { ascending: false })
        .limit(50);
      return unwrap(r, 'browser_sessions list') ?? [];
    },

    async insertEvent(row) {
      const r: PgResult<{ id: string }> = await db.from('governance_events').insert(row).select('id').single();
      return unwrap(r, 'governance_events insert');
    },

    async insertApproval(row) {
      const r: PgResult<{ id: string; expires_at: string }> = await db.from('governance_approvals')
        .insert(row).select('id, expires_at').single();
      return unwrap(r, 'governance_approvals insert');
    },

    async getApproval(tenantId, approvalId) {
      const r: PgResult<Record<string, unknown>> = await db.from('governance_approvals')
        .select('id, tenant_id, status, expires_at, requested_by, browser_session_id, resolved_at, event_id, '
          + 'execution:browser_executions(id,status,reserved_at,finished_at,detail)')
        .eq('tenant_id', tenantId).eq('id', approvalId).maybeSingle();
      const row = unwrap(r, 'governance_approvals get');
      if (!row) return null;
      return { ...row, execution: single(row.execution as ApprovalRow['execution'] | ApprovalRow['execution'][]) } as ApprovalRow;
    },

    async cancelApproval(tenantId, approvalId) {
      // Nur Kompensation, wenn der Nachweis der Anforderung scheiterte —
      // die Freigabe war nie entscheidbar sichtbar und wird nicht verbraucht.
      const r: PgResult<Array<{ id: string }>> = await db.from('governance_approvals')
        .update({ status: 'cancelled', resolved_at: new Date().toISOString(), resolution_reason: 'request evidence failed' })
        .eq('tenant_id', tenantId).eq('id', approvalId).eq('status', 'pending')
        .select('id');
      return (unwrap(r, 'governance_approvals cancel') ?? []).length === 1;
    },

    async cancelPendingSessionApprovals(tenantId, sessionIds) {
      if (sessionIds.length === 0) return [];
      const r: PgResult<Array<{ id: string }>> = await db.from('governance_approvals')
        .update({ status: 'cancelled', resolved_at: new Date().toISOString(), resolution_reason: 'browser session closed' })
        .eq('tenant_id', tenantId).in('browser_session_id', sessionIds).eq('status', 'pending')
        .select('id');
      return (unwrap(r, 'governance_approvals cancel session') ?? []).map((a) => a.id);
    },

    async reserveExecution(tenantId, approvalId, fingerprint) {
      const r: PgResult<Reservation | Reservation[]> = await db.rpc('reserve_browser_execution', {
        p_tenant_id: tenantId,
        p_approval_id: approvalId,
        p_fingerprint: fingerprint,
      });
      const row = single(unwrap(r, 'reserve_browser_execution'));
      if (!row || !RESERVATION_OUTCOMES.has(row.outcome)) throw new Error('reserve_browser_execution: unexpected result');
      return row;
    },

    async finishExecution(executionId: string, status: ExecutionEndStatus, detail: string | null) {
      const r: PgResult<boolean> = await db.rpc('finish_browser_execution', {
        p_execution_id: executionId,
        p_status: status,
        p_detail: detail,
      });
      return unwrap(r, 'finish_browser_execution') === true;
    },

    async insertActionLog(row) {
      const r: PgResult<{ id: string }> = await db.from('browser_actions').insert(row).select('id').single();
      return unwrap(r, 'browser_actions insert');
    },

    async updateActionLog(id, patch) {
      const r: PgResult<unknown> = await db.from('browser_actions').update(patch).eq('id', id);
      unwrap(r, 'browser_actions update');
    },

    async getExecutorLastSeen(executorId) {
      const r: PgResult<{ last_seen_at: string | null }> = await db.from('browser_executor_status')
        .select('last_seen_at').eq('executor_id', executorId).maybeSingle();
      return unwrap(r, 'browser_executor_status get')?.last_seen_at ?? null;
    },

    async upsertExecutorStatus(health: ExecutorHealth, lastSeenAt) {
      const r: PgResult<unknown> = await db.from('browser_executor_status').upsert({
        executor_id: health.executor_id,
        status: health.status,
        reason_code: health.reason_code,
        last_checked_at: health.checked_at,
        last_seen_at: lastSeenAt,
        runtime: health.runtime,
        version: health.version,
        active_sessions: health.active_sessions,
        max_sessions: health.max_sessions,
        capabilities: health.capabilities,
      }, { onConflict: 'executor_id' });
      unwrap(r, 'browser_executor_status upsert');
    },
  };
}
