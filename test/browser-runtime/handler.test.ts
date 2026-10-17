/**
 * browser-execute — Verhaltenstests der Autoritätskette mit Fakes.
 *
 * Request → Identity → Tenant → Entitlement → Policy → Risk → Approval
 * → Execution → Verification → Evidence. Jeder Negativpfad muss VOR dem
 * Executor enden; jede Ausführung muss gekettete Evidence hinterlassen.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createBrowserExecuteHandler } from '../../supabase/functions/browser-execute/handler';
import { evidenceContentHash } from '../../supabase/functions/_shared/evidence-hash';
import { BrowserRuntimeError } from '../../supabase/functions/_shared/browser-runtime/errors';
import { approvalFingerprint } from '../../supabase/functions/_shared/browser-runtime/actions';
import { canonicalJson } from '../../supabase/functions/_shared/evidence-hash';
import { createHash } from 'node:crypto';
import { TENANT_A, TENANT_B, TEST_FINGERPRINT_KEY, USER_1, call, createHarness, type Harness } from './fakes';

let h: Harness;
let handler: (req: Request) => Promise<Response>;

beforeEach(() => {
  h = createHarness();
  handler = createBrowserExecuteHandler(h.deps);
});

async function openSession(token = 'token-owner') {
  const res = await call(handler, token, { op: 'session_create', tenant_id: TENANT_A, mode: 'assist' });
  expect(res.status).toBe(201);
  return res.body.session.id as string;
}

async function navigate(sessionId: string, url = 'https://example.com/') {
  return call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sessionId, action: { type: 'navigate', url } });
}

function executorExecutions() {
  return h.executor.calls.filter((c) => c.op === 'execute');
}

async function assertChainValid(tenantId: string) {
  const rows = h.db.evidence.filter((e) => e.tenant_id === tenantId);
  let prev: string | null = null;
  for (const row of rows) {
    expect(row.previous_hash).toBe(prev);
    const snapshot = row.metadata.snapshot as Record<string, unknown>;
    expect(snapshot.previous_hash).toBe(prev);
    expect(await evidenceContentHash(snapshot)).toBe(row.content_hash);
    prev = row.content_hash;
  }
  return rows;
}

describe('Identity / Tenant', () => {
  it('ohne JWT: AUTH_REQUIRED, ohne Tenant: TENANT_REQUIRED, fremder Tenant: FORBIDDEN', async () => {
    expect((await call(handler, null, { op: 'health', tenant_id: TENANT_A })).body.error.code).toBe('AUTH_REQUIRED');
    expect((await call(handler, 'token-owner', { op: 'health' })).body.error.code).toBe('TENANT_REQUIRED');
    const foreign = await call(handler, 'token-owner', { op: 'health', tenant_id: TENANT_B });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.code).toBe('FORBIDDEN');
  });

  it('Tenant A sieht die Session von Tenant B nie', async () => {
    const sid = await openSession('token-owner');
    const res = await call(handler, 'token-b', { op: 'session_get', tenant_id: TENANT_B, session_id: sid });
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    const act = await call(handler, 'token-b', { op: 'act', tenant_id: TENANT_B, session_id: sid, action: { type: 'read_text' } });
    expect(act.body.error.code).toBe('SESSION_NOT_FOUND');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('ein anderes Mitglied desselben Tenants kann fremde Sessions nicht steuern', async () => {
    const sid = await openSession('token-owner');
    const res = await call(handler, 'token-editor', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'read_text' } });
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(executorExecutions()).toHaveLength(0);
  });
});

describe('Executor-Status und Capabilities', () => {
  it('nicht konfigurierter Executor: offline mit konkretem Grund, Co-Pilot/Autonomous gesperrt', async () => {
    h.executor.healthValue = { ...h.executor.healthValue, status: 'offline', reason_code: 'EXECUTOR_NOT_CONFIGURED', capabilities: [] };
    const res = await call(handler, 'token-owner', { op: 'capabilities', tenant_id: TENANT_A });
    expect(res.status).toBe(200);
    expect(res.body.executor).toMatchObject({ status: 'offline', reason_code: 'EXECUTOR_NOT_CONFIGURED', last_seen_at: null });
    expect(res.body.can_assist).toBe(true);
    expect(res.body.can_copilot).toBe(false);
    expect(res.body.reasons.copilot).toContain('EXECUTOR_OFFLINE');
    expect(res.body.can_autonomous).toBe(false);
    expect(res.body.reasons.autonomous).toEqual(expect.arrayContaining(['EXECUTOR_OFFLINE', 'APPROVAL_POLICY_MISSING', 'SESSION_VISUALIZATION_UNAVAILABLE']));
    expect(res.body.actions.navigate).toEqual({ available: false, reason: 'EXECUTOR_OFFLINE', requires_approval: false });
    expect(res.body.actions.click.requires_approval).toBe(true);
  });

  it('Autonomous bleibt ohne definierte Autonomie-Policy gesperrt, auch wenn alles andere bereit ist', async () => {
    const res = await call(handler, 'token-owner', { op: 'capabilities', tenant_id: TENANT_A });
    expect(res.body.can_copilot).toBe(true);
    expect(res.body.can_autonomous).toBe(false);
    expect(res.body.reasons.autonomous).toEqual(['APPROVAL_POLICY_MISSING']);
    expect(res.body.policy).toMatchObject({ authority: 'server', policy_id: 'rsd.browser.baseline', mutation_approval: 'required' });
    expect(res.body.actions.upload).toMatchObject({ available: false, reason: 'FILE_SOURCE_NOT_CONFIGURED' });
  });

  it('last_seen_at bleibt nach einem Ausfall der letzte erfolgreiche Probe-Zeitpunkt', async () => {
    await call(handler, 'token-owner', { op: 'health', tenant_id: TENANT_A });
    h.executor.healthValue = { ...h.executor.healthValue, status: 'offline', reason_code: 'EXECUTOR_UNREACHABLE', checked_at: '2026-09-29T11:00:00.000Z' };
    const res = await call(handler, 'token-owner', { op: 'health', tenant_id: TENANT_A });
    expect(res.body.executor.status).toBe('offline');
    expect(res.body.executor.last_seen_at).toBe('2026-09-29T00:00:00.000Z');
  });
});

describe('Session', () => {
  it('Executor offline: keine Session, sauberer Grund', async () => {
    h.executor.healthValue = { ...h.executor.healthValue, status: 'offline', reason_code: 'EXECUTOR_UNREACHABLE' };
    const res = await call(handler, 'token-owner', { op: 'session_create', tenant_id: TENANT_A });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EXECUTOR_OFFLINE');
    expect(res.body.error.details.reason).toBe('EXECUTOR_UNREACHABLE');
    expect(h.db.sessions).toHaveLength(0);
  });

  it('ohne Entitlement: ENTITLEMENT_REQUIRED, nichts angelegt', async () => {
    h.entitlement.value = 'denied';
    const res = await call(handler, 'token-owner', { op: 'session_create', tenant_id: TENANT_A });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ENTITLEMENT_REQUIRED');
    expect(h.db.sessions).toHaveLength(0);
  });

  it('viewer_auditor darf keine Session steuern', async () => {
    const res = await call(handler, 'token-viewer', { op: 'session_create', tenant_id: TENANT_A });
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('eine Zeile = genau eine Executor-Session, Status ready, Evidence gekettet', async () => {
    const sid = await openSession();
    const row = h.db.sessions[0];
    expect(row.id).toBe(sid);
    expect(row.status).toBe('ready');
    expect(row.user_id).toBe(USER_1);
    expect(row.executor_session_id).toMatch(/^rsx_[0-9a-f]{48}$/);
    expect(h.executor.openSessions.has(row.executor_session_id)).toBe(true);
    const chain = await assertChainValid(TENANT_A);
    expect((chain[0].metadata.snapshot as Record<string, unknown>).kind).toBe('browser.session.opened');
  });

  it('Autonomous-Sessions lassen sich nicht per Client-Wunsch anlegen', async () => {
    const res = await call(handler, 'token-owner', { op: 'session_create', tenant_id: TENANT_A, mode: 'autonomous' });
    expect(res.status).toBe(403);
    expect(res.body.error.details.reasons).toContain('APPROVAL_POLICY_MISSING');
  });

  it('Grenze offener Sessions pro Tenant', async () => {
    await openSession();
    await openSession();
    await openSession();
    const res = await call(handler, 'token-owner', { op: 'session_create', tenant_id: TENANT_A });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('SESSION_LIMIT_REACHED');
  });

  it('Frame kommt aus derselben Executor-Session', async () => {
    const sid = await openSession();
    await navigate(sid, 'https://example.com/impressum');
    const res = await call(handler, 'token-owner', { op: 'session_frame', tenant_id: TENANT_A, session_id: sid });
    expect(res.status).toBe(200);
    const frameCall = h.executor.calls.filter((c) => c.op === 'frame').at(-1);
    expect(frameCall?.session).toBe(h.db.sessions[0].executor_session_id);
    expect(res.body.page.url).toBe('https://example.com/impressum');
  });

  it('verlorene Executor-Session → Session failed, kein stiller Neustart', async () => {
    const sid = await openSession();
    h.executor.openSessions.clear();
    const res = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'read_text' } });
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    expect(h.db.sessions[0].status).toBe('failed');
    expect(h.db.sessions[0].last_error_code).toBe('SESSION_NOT_FOUND');
  });

  it('abgelaufene Session wird geschlossen und blockiert', async () => {
    const sid = await openSession();
    h.clock.t += 16 * 60 * 1000;
    const res = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'read_text' } });
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    expect(h.db.sessions[0].status).toBe('closed');
    expect(executorExecutions()).toHaveLength(0);
  });
});

describe('Governed Actions', () => {
  it('Lesende Aktion: ALLOW → Ausführung → Verifikation → Evidence; Pipeline vollständig', async () => {
    const sid = await openSession();
    const res = await navigate(sid);
    expect(res.status).toBe(200);
    expect(res.body.decision).toMatchObject({ decision: 'ALLOW', policy_id: 'rsd.browser.baseline', risk_level: 'low' });
    expect(res.body.pipeline.map((s: { step: string; state: string }) => `${s.step}:${s.state}`)).toEqual([
      'requested:done', 'policy:done', 'approval:skipped', 'execution:done', 'verification:done', 'evidence:done',
    ]);
    expect(res.body.evidence.event_id).toBeTruthy();
    expect(res.body.session).toMatchObject({ status: 'ready', current_url: 'https://example.com/', action_count: 1 });
    const chain = await assertChainValid(TENANT_A);
    const last = chain.at(-1)!.metadata.snapshot as Record<string, any>;
    expect(last).toMatchObject({ kind: 'browser.action.result', tenant_id: TENANT_A, target: 'https://example.com/' });
    expect(last.policy.decision).toBe('ALLOW');
    expect(last.verification.status).toBe('passed');
    expect(last.artifacts[0]).toMatchObject({ kind: 'frame' });
    const log = h.db.actionLog.find((r) => r.browser_action === 'navigate');
    expect(log).toMatchObject({ status: 'completed', policy_decision: 'allow', verification: 'passed', evidence_id: res.body.evidence.id });
  });

  it('Text aus der Seite geht an den Client, in die Evidence nur als Hash', async () => {
    const sid = await openSession();
    const res = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'read_text' } });
    expect(res.body.result.text).toBe('Hallo Welt');
    expect(JSON.stringify(h.db.evidence)).not.toContain('Hallo Welt');
    const artifacts = (h.db.evidence.at(-1)!.metadata.snapshot as Record<string, any>).artifacts;
    expect(artifacts.some((a: { kind: string }) => a.kind === 'text')).toBe(true);
  });

  it('private Ziele: URL_BLOCKED vor dem Executor, Ablehnung als Evidence', async () => {
    const sid = await openSession();
    for (const url of ['http://169.254.169.254/latest/meta-data', 'http://localhost:8080', 'file:///etc/passwd', 'http://[::1]/']) {
      const res = await navigate(sid, url);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('URL_BLOCKED');
    }
    expect(executorExecutions()).toHaveLength(0);
    const denied = (await assertChainValid(TENANT_A)).filter((e) => (e.metadata.snapshot as Record<string, unknown>).kind === 'browser.action.denied');
    expect(denied).toHaveLength(4);
  });

  it('Mandanten-Policy block → POLICY_DENIED, keine Ausführung', async () => {
    const sid = await openSession();
    h.tenantPolicy.value = { status: 'evaluated', decision: 'block', policy_id: 'pol-1', snapshot_version: 'v9', reason_text: 'Browser-Nutzung untersagt' };
    const res = await navigate(sid);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('POLICY_DENIED');
    expect(res.body.error.details.policy).toMatchObject({ policy_id: 'pol-1', policy_version: '2026-09-29.1+tenant:v9' });
    expect(executorExecutions()).toHaveLength(0);
  });

  it('Mandanten-Policies nicht ladbar → fail closed', async () => {
    const sid = await openSession();
    h.tenantPolicy.value = { status: 'unavailable', error_code: 'PDP_SNAPSHOT_UNAVAILABLE' };
    const res = await navigate(sid);
    expect(res.body.error.code).toBe('POLICY_UNAVAILABLE');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('Kill-Switch stoppt alles', async () => {
    const sid = await openSession();
    h.killSwitch.on = true;
    const res = await navigate(sid);
    expect(res.body.error.code).toBe('KILL_SWITCH_ENGAGED');
    expect((await call(handler, 'token-owner', { op: 'session_create', tenant_id: TENANT_A })).body.error.code).toBe('KILL_SWITCH_ENGAGED');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('Executor fällt während der Aktion aus: EXECUTOR_OFFLINE, Session bleibt nutzbar, Fehler-Evidence', async () => {
    const sid = await openSession();
    h.executor.failNext = new BrowserRuntimeError('EXECUTOR_OFFLINE', 'executor unreachable', { reason: 'EXECUTOR_UNREACHABLE' });
    const res = await navigate(sid);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EXECUTOR_OFFLINE');
    expect(h.db.sessions[0]).toMatchObject({ status: 'ready', last_error_code: 'EXECUTOR_OFFLINE' });
    const last = h.db.evidence.at(-1)!.metadata.snapshot as Record<string, any>;
    expect(last.result.ok).toBe(false);
    expect(last.verification.status).toBe('failed');
  });

  it('Evidence-Store nicht verfügbar: lesende Aktion läuft nicht', async () => {
    const sid = await openSession();
    h.db.failEvidenceRead = true;
    const res = await navigate(sid);
    expect(res.body.error.code).toBe('EVIDENCE_WRITE_FAILED');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('upload ohne mandantengebundene Dateiquelle: ACTION_NOT_SUPPORTED', async () => {
    const sid = await openSession();
    const res = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'upload', selector: '#f', file_ref: 'x' } });
    expect(res.status).toBe(422);
    expect(res.body.error.details.reason).toBe('FILE_SOURCE_NOT_CONFIGURED');
  });

  it('unbekannte Aktionen und kaputte Parameter werden abgewiesen', async () => {
    const sid = await openSession();
    expect((await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'eval', code: '1' } })).body.error.code).toBe('ACTION_NOT_SUPPORTED');
    expect((await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector: 'javascript:alert(1)' } })).body.error.code).toBe('VALIDATION_FAILED');
    expect((await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: 'bs_legacy', action: { type: 'read_text' } })).body.error.code).toBe('VALIDATION_FAILED');
  });

  it('Alt-Client mit Browser-Session-ID aus localStorage wird nicht ausgeführt', async () => {
    const res = await call(handler, 'token-owner', { op: 'execute', tenant_id: TENANT_A, session_id: 'bs_abc_123', actions: [{ type: 'scroll', direction: 'down' }] });
    expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    expect(executorExecutions()).toHaveLength(0);
  });
});

describe('Approvals', () => {
  async function requestClick(sid: string, selector = '#submit') {
    return call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector } });
  }
  async function executeApproved(sid: string, approvalId: string, selector = '#submit') {
    return call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector }, approval_id: approvalId });
  }

  it('Mutation ohne Freigabe: APPROVAL_REQUIRED, keine Ausführung, Freigabe mit HMAC-Fingerprint + Evidence', async () => {
    const sid = await openSession();
    await navigate(sid);
    const res = await requestClick(sid);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('APPROVAL_REQUIRED');
    const approvalId = res.body.error.details.approval_id;
    expect(executorExecutions().map((c) => c.action?.type)).toEqual(['navigate']);
    const approval = h.db.approvals[0];
    expect(approval).toMatchObject({ id: approvalId, status: 'pending', requested_by: USER_1, browser_session_id: sid });
    expect(Date.parse(approval.expires_at) - h.clock.t).toBe(15 * 60 * 1000);
    // requested_action ist der Wert, den reserve_browser_execution (#1728) vergleicht.
    const session = h.db.sessions[0];
    const input = {
      tenantId: TENANT_A, browserSessionId: sid, executorSessionId: session.executor_session_id,
      pageUrl: 'https://example.com/', action: { type: 'click' as const, selector: '#submit' },
    };
    expect(approval.requested_action).toBe(await approvalFingerprint(input, TEST_FINGERPRINT_KEY));
    expect(approval.requested_action).toMatch(/^browser:v2:[0-9a-f]{64}$/);
    expect(h.db.sessions[0].status).toBe('awaiting_approval');
    const intent = h.db.evidence.at(-1)!.metadata.snapshot as Record<string, any>;
    expect(intent).toMatchObject({ kind: 'browser.action.intent', approval_id: approvalId });
  });

  it('Fingerprint ohne Schlüssel nicht per Wörterbuch rückrechenbar (HMAC statt nacktem SHA-256)', async () => {
    const sid = await openSession();
    const res = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'type', selector: '#pin', text: '4711' } });
    expect(res.body.error.code).toBe('APPROVAL_REQUIRED');
    const stored = h.db.approvals[0].requested_action;
    const session = h.db.sessions[0];
    const plain = createHash('sha256').update(canonicalJson({
      v: 2, tenant_id: TENANT_A, browser_session_id: sid, executor_session_id: session.executor_session_id,
      page_url: 'about:blank', action: { type: 'type', selector: '#pin', text: '4711' },
    })).digest('hex');
    expect(stored).not.toBe(`browser:v2:${plain}`);
    const otherKey = new Uint8Array(32).fill(7);
    expect(await approvalFingerprint({
      tenantId: TENANT_A, browserSessionId: sid, executorSessionId: session.executor_session_id,
      pageUrl: 'about:blank', action: { type: 'type', selector: '#pin', text: '4711' },
    }, otherKey)).not.toBe(stored);
  });

  it('eingegebener Text erscheint weder in Freigabe, Event, Log noch Evidence', async () => {
    const sid = await openSession();
    const res = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'type', selector: '#pw', text: 'Sup3rGeheim!' } });
    expect(res.body.error.code).toBe('APPROVAL_REQUIRED');
    const everything = JSON.stringify([h.db.approvals, h.db.events, h.db.actionLog, h.db.evidence, h.db.sessions]);
    expect(everything).not.toContain('Sup3rGeheim!');
    expect(everything).toContain('[redacted:12 chars]');
  });

  it('offene Freigabe blockiert weitere Mutationen und Navigation, lesende Aktionen laufen weiter', async () => {
    const sid = await openSession();
    await navigate(sid);
    await requestClick(sid);
    expect((await requestClick(sid, '#other')).body.error.code).toBe('APPROVAL_PENDING');
    expect((await navigate(sid, 'https://example.org/')).body.error.code).toBe('APPROVAL_PENDING');
    const read = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'read_text' } });
    expect(read.status).toBe(200);
    expect(h.db.sessions[0].status).toBe('awaiting_approval');
  });

  it('noch nicht freigegeben: APPROVAL_PENDING, keine Ausführung', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    const res = await executeApproved(sid, approvalId);
    expect(res.body.error.code).toBe('APPROVAL_PENDING');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('Freigabe → genau eine Ausführung; Wiederverwendung scheitert (browser_executions, #1728)', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    const first = await executeApproved(sid, approvalId);
    expect(first.status).toBe(200);
    expect(first.body.pipeline.find((s: { step: string }) => s.step === 'approval').state).toBe('done');
    expect(h.db.approvals[0].status).toBe('approved');
    expect(h.db.executions).toHaveLength(1);
    expect(h.db.executions[0]).toMatchObject({ approval_id: approvalId, status: 'executed' });
    expect(first.body.execution_id).toBe(h.db.executions[0].id);
    const second = await executeApproved(sid, approvalId);
    expect(second.body.error.code).toBe('APPROVAL_ALREADY_USED');
    expect(second.body.error.details).toMatchObject({ execution_status: 'executed', approval_consumed: true });
    expect(executorExecutions()).toHaveLength(1);
    expect(executorExecutions()[0].expectedUrl).toBe('about:blank');
    const kinds = (await assertChainValid(TENANT_A)).map((e) => (e.metadata.snapshot as Record<string, unknown>).kind);
    expect(kinds).toEqual(['browser.session.opened', 'browser.action.intent', 'browser.action.intent', 'browser.action.result']);
  });

  it('Freigabe gilt nur für genau diese Aktion auf genau dieser Seite', async () => {
    const sid = await openSession();
    await navigate(sid);
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    expect((await executeApproved(sid, approvalId, '#delete-account')).body.error.code).toBe('APPROVAL_MISMATCH');
    h.db.sessions[0].current_url = 'https://example.com/andere-seite';
    expect((await executeApproved(sid, approvalId)).body.error.code).toBe('APPROVAL_MISMATCH');
    expect(executorExecutions().map((c) => c.action?.type)).toEqual(['navigate']);
  });

  it('abgelehnt → keine Ausführung, Session wieder bereit', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.reject(approvalId);
    const res = await executeApproved(sid, approvalId);
    expect(res.body.error.code).toBe('APPROVAL_DENIED');
    expect(h.db.sessions[0].status).toBe('ready');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('abgelaufen → APPROVAL_EXPIRED nach Datenbankuhr, keine Ausführung, Session frei', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.clock.t += 14 * 60 * 1000; // Session noch gültig (Leerlauf 15 min ab letzter Aktion)
    h.db.approvals[0].expires_at = new Date(h.clock.t - 1).toISOString();
    const res = await executeApproved(sid, approvalId);
    expect(res.body.error.code).toBe('APPROVAL_EXPIRED');
    expect(h.db.executions).toHaveLength(0);
    expect(h.db.sessions[0].status).toBe('ready');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('Freigabe eines anderen Tenants ist nicht auffindbar', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.db.approvals[0].tenant_id = TENANT_B;
    expect((await executeApproved(sid, approvalId)).body.error.code).toBe('APPROVAL_NOT_FOUND');
  });

  it('Evidence nicht schreibbar bei freigegebener Mutation: fail closed, keine Ausführung, Freigabe verbraucht', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.db.failEvidence = true;
    const res = await executeApproved(sid, approvalId);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EVIDENCE_WRITE_FAILED');
    expect(res.body.error.details).toMatchObject({ action_executed: false, approval_consumed: true });
    expect(executorExecutions()).toHaveLength(0);
    expect(h.db.executions[0]).toMatchObject({ status: 'executor_failed', detail: 'not_executed:evidence_unavailable' });
    expect(h.db.sessions[0].status).toBe('ready');
  });

  it('Reservierung nicht möglich: RESERVATION_UNAVAILABLE, nichts ausgeführt', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.db.failReservation = true;
    const res = await executeApproved(sid, approvalId);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('RESERVATION_UNAVAILABLE');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('Abschluss nicht schreibbar: kein ok, Reservierung bleibt stehen', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.db.failFinish = true;
    const res = await executeApproved(sid, approvalId);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('EVIDENCE_WRITE_FAILED');
    expect(res.body.error.details).toMatchObject({ execution_status: 'reserved', action_executed: true });
    expect(h.db.executions[0].status).toBe('reserved');
  });

  it('parallele Einlösung derselben Freigabe: genau eine Ausführung', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    const [a, b] = await Promise.all([executeApproved(sid, approvalId), executeApproved(sid, approvalId)]);
    const codes = [a, b].map((r) => (r.status === 200 ? 'ok' : r.body.error.code)).sort();
    expect(codes).toEqual(['APPROVAL_ALREADY_USED', 'ok']);
    expect(executorExecutions()).toHaveLength(1);
  });

  it('Anfragender kann eine offene Freigabe zurückziehen — atomar mit Evidence', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    const res = await call(handler, 'token-owner', { op: 'approval_cancel', tenant_id: TENANT_A, approval_id: approvalId });
    expect(res.body).toMatchObject({ cancelled: true, outcome: 'decided', approval_status: 'cancelled' });
    expect(h.db.approvals[0].status).toBe('cancelled');
    expect(h.db.sessions[0].status).toBe('ready');
    const decision = h.db.evidence.at(-1)!.metadata.snapshot as Record<string, unknown>;
    expect(decision).toMatchObject({ kind: 'approval.decision', decision: 'cancelled', approval_id: approvalId });
    await assertChainValid(TENANT_A);
  });

  it('freigegeben, aber unbenutzt: zurückziehbar und danach nicht mehr einlösbar', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    const res = await call(handler, 'token-owner', { op: 'approval_cancel', tenant_id: TENANT_A, approval_id: approvalId });
    expect(res.body.cancelled).toBe(true);
    expect((await executeApproved(sid, approvalId)).body.error.code).toBe('APPROVAL_DENIED');
    expect(executorExecutions()).toHaveLength(0);
  });

  it('nach der Einlösung ist Zurückziehen nicht mehr möglich', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    expect((await executeApproved(sid, approvalId)).status).toBe(200);
    const res = await call(handler, 'token-owner', { op: 'approval_cancel', tenant_id: TENANT_A, approval_id: approvalId });
    expect(res.body).toMatchObject({ cancelled: false, outcome: 'already_resolved' });
  });

  it('approval_status liefert den Verbrauch aus browser_executions', async () => {
    const sid = await openSession();
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    await executeApproved(sid, approvalId);
    const res = await call(handler, 'token-owner', { op: 'approval_status', tenant_id: TENANT_A, approval_id: approvalId });
    expect(res.body.approval).toMatchObject({ status: 'approved', execution: { status: 'executed' } });
  });

  it('kill_all schließt alle Sessions und zieht offene Freigaben zurück (nur owner/admin)', async () => {
    const sid = await openSession();
    await requestClick(sid);
    expect((await call(handler, 'token-editor', { op: 'kill_all', tenant_id: TENANT_A })).body.error.code).toBe('FORBIDDEN');
    const res = await call(handler, 'token-owner', { op: 'kill_all', tenant_id: TENANT_A });
    expect(res.body).toMatchObject({ closed_sessions: 1, cancelled_approvals: 1 });
    expect(h.db.sessions[0].status).toBe('closed');
    expect(h.executor.openSessions.size).toBe(0);
  });
});

describe('Freigabe entschieden, Session wartet noch', () => {
  it('nach Ablehnung kann eine neue Freigabe angefordert werden (kein Hängenbleiben)', async () => {
    const res = await call(handler, 'token-owner', { op: 'session_create', tenant_id: TENANT_A, mode: 'assist' });
    const sid = res.body.session.id as string;
    const first = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector: '#a' } });
    h.db.reject(first.body.error.details.approval_id);
    const second = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector: '#b' } });
    expect(second.body.error.code).toBe('APPROVAL_REQUIRED');
    expect(second.body.error.details.approval_id).not.toBe(first.body.error.details.approval_id);
  });
});

describe('Security-Review 2026-09-29', () => {
  async function requestClick(sid: string, selector = '#submit') {
    return call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector } });
  }

  it('eine beliebige approval_id entsperrt eine wartende Session nicht', async () => {
    const sid = await openSession();
    await navigate(sid);
    const pendingId = (await requestClick(sid)).body.error.details.approval_id;
    const random = '12345678-1234-4234-8234-123456789abc';
    const withRandom = await call(handler, 'token-owner', {
      op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'navigate', url: 'https://example.org/' }, approval_id: random,
    });
    expect(withRandom.body.error.code).toBe('APPROVAL_PENDING');
    // Selbst die richtige ID taugt nicht für eine Aktion ohne Freigabepflicht.
    const withPending = await call(handler, 'token-owner', {
      op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'navigate', url: 'https://example.org/' }, approval_id: pendingId,
    });
    expect(withPending.body.error.code).toBe('VALIDATION_FAILED');
    expect(executorExecutions().map((c) => c.action?.type)).toEqual(['navigate']);
    expect(h.db.sessions[0].status).toBe('awaiting_approval');
  });

  it('Live-Seite weicht von der freigegebenen ab: PAGE_CHANGED, nichts ausgeführt, Freigabe verbraucht', async () => {
    const sid = await openSession();
    await navigate(sid);
    const approvalId = (await requestClick(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.executor.pageUrl = 'https://example.com/umgeleitet'; // Seite hat sich ohne Aktion geändert
    const res = await call(handler, 'token-owner', {
      op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector: '#submit' }, approval_id: approvalId,
    });
    expect(res.body.error.code).toBe('PAGE_CHANGED');
    expect(res.body.error.details).toMatchObject({ approval_consumed: true, action_executed: false });
    expect(executorExecutions().at(-1)!.expectedUrl).toBe('https://example.com/');
    expect(h.db.executions[0]).toMatchObject({ status: 'executor_failed', detail: 'not_executed:page_changed' });
    expect(h.db.sessions[0].current_url).toBe('https://example.com/umgeleitet');
  });

  it('Freitext aus Executor-Fehlern (mit Eingabe) landet weder in DB noch Evidence noch Antwort', async () => {
    const sid = await openSession();
    await navigate(sid);
    const approvalId = (await call(handler, 'token-owner', {
      op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'type', selector: '#pin', text: '4711' },
    })).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.executor.nextResult = {
      ok: false,
      error: 'locator.fill: Timeout — waiting for fill("4711")',
      verification: { status: 'failed', checks: { error: 'fill("4711") failed', value_length_matches: false } },
    };
    const res = await call(handler, 'token-owner', {
      op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'type', selector: '#pin', text: '4711' }, approval_id: approvalId,
    });
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ ok: false, error_code: 'ACTION_FAILED' });
    const everything = JSON.stringify([h.db.approvals, h.db.events, h.db.actionLog, h.db.evidence, h.db.sessions, h.db.executions, res.body]);
    expect(everything).not.toContain('4711');
    expect(h.db.sessions[0].last_error_code).toBe('ACTION_FAILED');
  });

  it('Landung auf einer nicht-öffentlichen Adresse (Redirect) schließt die Session', async () => {
    const sid = await openSession();
    h.executor.landOn = 'http://169.254.169.254/latest/meta-data/';
    const res = await navigate(sid, 'https://example.com/r');
    expect(res.body.error.code).toBe('URL_BLOCKED');
    expect(res.body.error.details.reason).toBe('LANDED_ON_NON_PUBLIC_URL');
    expect(h.db.sessions[0].status).toBe('failed');
    expect(h.executor.calls.some((c) => c.op === 'close' && c.session === h.db.sessions[0].executor_session_id)).toBe(true);
  });

  it('Session-Limit hält auch bei parallelen Anlagen (Trigger mit Advisory-Lock)', async () => {
    const results = await Promise.all([1, 2, 3, 4].map(() => call(handler, 'token-owner', { op: 'session_create', tenant_id: TENANT_A, mode: 'assist' })));
    const codes = results.map((r) => (r.status === 201 ? 'ok' : r.body.error.code)).sort();
    expect(codes).toEqual(['SESSION_LIMIT_REACHED', 'ok', 'ok', 'ok']);
  });
});

describe('Landeprüfung (Redirect-Hops, DNS-genau im Executor)', () => {
  const PRIVATE_BY_DNS = 'intranet-by-dns.example'; // statisch öffentlich, löst privat auf

  it('Redirect auf privat auflösenden Host: Executor meldet LANDED_ON_BLOCKED_URL, Session zu, nichts von der Seite gespeichert', async () => {
    const sid = await openSession();
    h.executor.dnsBlocked.add(PRIVATE_BY_DNS);
    h.executor.landOn = `https://${PRIVATE_BY_DNS}/admin?token=geheim`;
    const res = await navigate(sid, 'https://example.com/r');
    expect(res.body.error.code).toBe('URL_BLOCKED');
    expect(res.body.error.details).toMatchObject({
      reason: 'LANDED_ON_NON_PUBLIC_URL', action_executed: true, blocked_origin: `https://${PRIVATE_BY_DNS}`,
    });
    expect(h.db.sessions[0]).toMatchObject({ status: 'failed', current_url: 'about:blank', page_title: null, last_error_code: 'URL_BLOCKED' });
    expect(h.executor.calls.some((c) => c.op === 'close')).toBe(true);
    const everything = JSON.stringify([h.db.events, h.db.actionLog, h.db.evidence, h.db.sessions, res.body]);
    expect(everything).not.toContain('token=geheim');
  });

  it('freigegebener Klick landet gesperrt: Ausführung als executed festgehalten (Nebenwirkung nicht verschwiegen)', async () => {
    const sid = await openSession();
    await navigate(sid);
    const approvalId = (await requestClickFor(sid)).body.error.details.approval_id;
    h.db.approve(approvalId);
    h.executor.dnsBlocked.add(PRIVATE_BY_DNS);
    h.executor.landOn = `https://${PRIVATE_BY_DNS}/`;
    const res = await call(handler, 'token-owner', {
      op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector: '#submit' }, approval_id: approvalId,
    });
    expect(res.body.error).toMatchObject({ code: 'URL_BLOCKED', details: { action_executed: true, approval_consumed: true } });
    expect(h.db.executions[0]).toMatchObject({ status: 'executed', detail: 'landed_on_blocked_url' });
    // Auch die gekettete Evidence verschweigt die Nebenwirkung nicht (Review 10-01).
    const resultEvent = h.db.events.at(-1)!;
    expect(resultEvent.event_type).toBe('browser.action.executed');
    expect(String(resultEvent.title)).toContain('ausgeführt, danach gesperrt gelandet');
    expect((resultEvent.payload as { result: Record<string, unknown> }).result).toMatchObject({ ok: false, action_executed: true, error_code: 'URL_BLOCKED' });
  });

  it('Seite stand schon vor der Aktion gesperrt (selbstständiger Redirect): nichts ausgeführt, Session zu', async () => {
    const sid = await openSession();
    await navigate(sid);
    h.executor.dnsBlocked.add(PRIVATE_BY_DNS);
    h.executor.pageUrl = `https://${PRIVATE_BY_DNS}/`;
    const res = await call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'read_text' } });
    expect(res.body.error.code).toBe('URL_BLOCKED');
    expect(res.body.error.details).toMatchObject({ executor_code: 'LANDED_ON_BLOCKED_URL', action_executed: false });
    expect(h.db.sessions[0]).toMatchObject({ status: 'failed', current_url: 'about:blank' });
  });

  it('Frame einer gesperrt gelandeten Seite: kein Bild, Session zu, offene Freigaben hinfällig', async () => {
    const sid = await openSession();
    await navigate(sid);
    await requestClickFor(sid);
    h.executor.dnsBlocked.add(PRIVATE_BY_DNS);
    h.executor.pageUrl = `https://${PRIVATE_BY_DNS}/`;
    const res = await call(handler, 'token-owner', { op: 'session_frame', tenant_id: TENANT_A, session_id: sid });
    expect(res.body.error.code).toBe('URL_BLOCKED');
    expect(res.body.frame).toBeUndefined();
    expect(h.db.sessions[0]).toMatchObject({ status: 'failed', last_error_code: 'LANDED_ON_NON_PUBLIC_URL', current_url: 'about:blank' });
    expect(h.db.approvals[0].status).toBe('cancelled');
    expect(h.executor.calls.some((c) => c.op === 'close')).toBe(true);
  });

  it('fehlgeschlagene Navigation (Chromium-Fehlerseite) schließt die Session NICHT', async () => {
    const sid = await openSession();
    h.executor.landOn = 'chrome-error://chromewebdata/';
    h.executor.nextResult = { ok: false, error: 'DNS_FAILED', verification: { status: 'failed', checks: { error: 'DNS_FAILED' } } };
    const res = await navigate(sid, 'https://does-not-resolve.example/');
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ ok: false, error_code: 'DNS_FAILED' });
    expect(h.db.sessions[0].status).toBe('ready');
  });

  async function requestClickFor(sid: string) {
    return call(handler, 'token-owner', { op: 'act', tenant_id: TENANT_A, session_id: sid, action: { type: 'click', selector: '#submit' } });
  }
});

describe('abgelehnte Navigation: Roh-URL nie mit Zugangsdaten, Query oder Fragment gespeichert', () => {
  it('Passwort und Token landen weder in Ereignis, Nachweis, Log noch Antwort', async () => {
    const sid = await openSession();
    const res = await navigate(sid, 'https://admin:S3cr3t-P4ss@intranet-portal.example.com/login?token=abc123#frag');
    expect(res.body.error.code).toBe('URL_BLOCKED');
    const everything = JSON.stringify([h.db.events, h.db.actionLog, h.db.evidence, h.db.sessions, res.body]);
    for (const secret of ['S3cr3t-P4ss', 'admin:', 'token=abc123', '#frag']) expect(everything).not.toContain(secret);
    const denied = h.db.events.find((e) => e.event_type === 'browser.action.denied')!;
    expect((denied.payload as { target: string }).target).toBe('https://intranet-portal.example.com/login');
    expect(h.db.actionLog.at(-1)!.url).toBe('https://intranet-portal.example.com/login');
  });

  it('fremde Schemata nur als Schema', async () => {
    const sid = await openSession();
    await navigate(sid, 'data:text/html,<script>geheim()</script>');
    expect(JSON.stringify([h.db.events, h.db.evidence, h.db.actionLog])).not.toContain('geheim');
  });
});
