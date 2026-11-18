/**
 * browser-execute mit Fingerprint v2 (PR A) – Handler-Test mit gemocktem Supabase.
 *
 * Geprüft:
 *  V1  verändernde Aktion ohne target ⇒ 400 TARGET_REQUIRED, keine Freigabe angelegt
 *  V2  ungültiges target ⇒ 400 TARGET_INVALID
 *  V3  erste Anfrage ⇒ 409 APPROVAL_REQUIRED; Event-Payload ohne Klartextwerte
 *  V4  freigegeben + gleiches Ziel/Inhalt ⇒ 200, Executor bekommt expected_target
 *  V5  freigegeben + geänderter Inhalt ⇒ 409 APPROVAL_MISMATCH, Executor nicht aufgerufen
 *  V6  freigegeben + anderer Empfänger ⇒ 409 APPROVAL_MISMATCH (Empfänger ebenfalls freigegeben)
 *  V7  gleiche Freigabe zweimal ⇒ 409 APPROVAL_ALREADY_USED
 *  V8  v1-Freigabe (alter Fingerprint) ⇒ 409 APPROVAL_MISMATCH
 *  V9  reine Lese-Aktionen brauchen kein target und keine Freigabe
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORIGIN, allowOrigins, approve, call as rawCall, db, executorCalls, loadHandler, resetDb } from './_browser-execute-harness.ts';

vi.mock('../../supabase/functions/_shared/auth.ts', async () => {
  const h = await import('./_browser-execute-harness.ts');
  return { requireAuthAndTenant: async () => ({ admin: h.admin, tenantId: h.TENANT, user: { id: 'user-1', email: 'pruefer@example.org' } }) };
});
vi.mock('../../supabase/functions/_shared/ai.ts', () => ({
  AiInvokeError: class extends Error {},
  runAiTool: async () => { throw new Error('nicht im Test'); },
}));

beforeAll(() => loadHandler(vi));
beforeEach(() => {
  resetDb();
  allowOrigins([ORIGIN, 'https://zweitempfaenger.example']); // PR B: Domain-Freigabe
});

const call = (body: Record<string, unknown>) => rawCall({ page_origin: ORIGIN, ...body });
const TARGET = { origin: ORIGIN, method: 'POST', values: { name: 'Erika Muster', email: 'erika@example.org' } };
const CLICK = [{ type: 'click', selector: '#senden' }];

async function requestAndApprove(target = TARGET) {
  const r = await call({ actions: CLICK, target });
  expect(r.status).toBe(409);
  expect(r.json.error.code).toBe('APPROVAL_REQUIRED');
  const approvalId = r.json.error.details.approval_id as string;
  approve(approvalId);
  return approvalId;
}

describe('browser-execute Fingerprint v2', () => {
  it('V1 verändernde Aktion ohne target ⇒ TARGET_REQUIRED, nichts angelegt', async () => {
    const r = await call({ actions: CLICK });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe('TARGET_REQUIRED');
    expect(db.governance_approvals).toHaveLength(0);
  });

  it('V2 ungültiges target ⇒ TARGET_INVALID', async () => {
    const r = await call({ actions: CLICK, target: { ...TARGET, origin: 'https://x.example/pfad?d=geheim' } });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe('TARGET_INVALID');
  });

  it('V3 Freigabe wird mit v2-Fingerprint angelegt; Event-Payload ohne Klartextwerte', async () => {
    await requestAndApprove();
    expect(db.governance_approvals[0].requested_action).toMatch(/^browser:v2:[0-9a-f]{64}$/);
    const payload = JSON.stringify(db.governance_events[0].payload);
    expect(payload).not.toContain('Erika');
    expect(payload).not.toContain('erika@example.org');
    expect(db.governance_events[0].payload.target).toMatchObject({ origin: TARGET.origin, method: 'POST' });
  });

  it('V4 gleiches Ziel und gleicher Inhalt ⇒ ausgeführt, Executor bekommt expected_target', async () => {
    const approvalId = await requestAndApprove();
    const r = await call({ actions: CLICK, target: TARGET, approval_id: approvalId });
    expect(r.status).toBe(200);
    expect(r.json.ok).toBe(true);
    expect(executorCalls).toHaveLength(1);
    expect(executorCalls[0].body.expected_target).toEqual(TARGET);
    expect(db.browser_executions[0].status).toBe('executed');
    expect(JSON.stringify(db.governance_evidence)).not.toContain('erika@example.org');
  });

  it('V5 geänderter Inhalt ⇒ APPROVAL_MISMATCH, Executor nicht aufgerufen', async () => {
    const approvalId = await requestAndApprove();
    const r = await call({ actions: CLICK, target: { ...TARGET, values: { ...TARGET.values, email: 'angreifer@example.net' } }, approval_id: approvalId });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('APPROVAL_MISMATCH');
    expect(executorCalls).toHaveLength(0);
    expect(db.browser_executions).toHaveLength(0);
  });

  it('V6 anderer (ebenfalls freigegebener) Empfänger ⇒ APPROVAL_MISMATCH', async () => {
    const approvalId = await requestAndApprove();
    const r = await call({ actions: CLICK, target: { ...TARGET, origin: 'https://zweitempfaenger.example' }, approval_id: approvalId });
    expect(r.json.error.code).toBe('APPROVAL_MISMATCH');
    expect(executorCalls).toHaveLength(0);
  });

  it('V7 gleiche Freigabe zweimal ⇒ APPROVAL_ALREADY_USED', async () => {
    const approvalId = await requestAndApprove();
    expect((await call({ actions: CLICK, target: TARGET, approval_id: approvalId })).status).toBe(200);
    const r = await call({ actions: CLICK, target: TARGET, approval_id: approvalId });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('APPROVAL_ALREADY_USED');
    expect(executorCalls).toHaveLength(1);
  });

  it('V8 alte v1-Freigabe passt nicht mehr ⇒ APPROVAL_MISMATCH', async () => {
    const approvalId = await requestAndApprove();
    db.governance_approvals[0].requested_action = 'browser:v1:' + 'a'.repeat(64);
    const r = await call({ actions: CLICK, target: TARGET, approval_id: approvalId });
    expect(r.json.error.code).toBe('APPROVAL_MISMATCH');
  });

  it('V9 reine Lese-Aktionen: kein target, keine Freigabe', async () => {
    const r = await call({ actions: [{ type: 'extract' }] });
    expect(r.status).toBe(200);
    expect(db.governance_approvals).toHaveLength(0);
    expect(executorCalls[0].body.expected_target).toBeNull();
  });
});
