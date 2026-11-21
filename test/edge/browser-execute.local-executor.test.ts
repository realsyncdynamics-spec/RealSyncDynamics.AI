/**
 * browser-execute – lokaler Executor (PR C): op 'reserve' und op 'report'.
 *
 * Geprüft:
 *  L1  reserve ohne Freigabe ⇒ 409 APPROVAL_REQUIRED (gleicher Weg wie execute)
 *  L2  reserve mit Freigabe ⇒ execution_id, erwartetes Ziel und Domainliste; Playwright NICHT aufgerufen
 *  L3  reserve ohne konfigurierten Playwright-Dienst funktioniert (lokal)
 *  L4  reserve für Lese-Aktionen ⇒ keine Reservierung, aber Event + Evidence (Prüfpfad, Befund 1)
 *  L4b Lese-reserve, Event nicht schreibbar ⇒ 503 AUDIT_UNAVAILABLE, keine Domainliste
 *  L4c Lese-reserve, Evidence nicht schreibbar ⇒ 503 AUDIT_UNAVAILABLE, keine Domainliste
 *  L4d verändernde reserve schreibt keinen Lese-Nachweis (Nachweis erst beim report)
 *  L5  reserve auf nicht freigegebener Domain ⇒ 403
 *  L6  report executed ⇒ Status executed, Event + Evidence + browser_actions, nur Hashes (G4)
 *  L7  report ohne passende Reservierung (fremde/unbekannte execution_id) ⇒ 404
 *  L8  report mit verändertem Inhalt ⇒ 409 REPORT_MISMATCH, nichts geschrieben
 *  L9  doppelter report ⇒ 409 ALREADY_REPORTED, kein zweiter Nachweis
 *  L10 parallele reports ⇒ genau ein Nachweis
 *  L11 report failed (Timeout) ⇒ executor_failed, Freigabe verbraucht, kein erneutes reserve
 *  L12 Evidence-Fehler ⇒ executed_unrecorded, kein ok
 *  L13 report trotz inzwischen gesperrter Domain oder ausgefallener Richtlinie ⇒ wird nachgewiesen
 *  L14 ungültige Report-Felder ⇒ 400
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORIGIN, allowOrigins, approve, call as rawCall, db, executorCalls, flags, loadHandler, resetDb } from './_browser-execute-harness.ts';

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
  allowOrigins([ORIGIN]);
});

const TARGET = { origin: ORIGIN, method: 'POST', values: { name: 'Erika Muster', email: 'erika@example.org' } };
const CLICK = [{ type: 'click', selector: '#senden' }];
const BASE = { page_origin: ORIGIN, actions: CLICK, target: TARGET };
const HASH = 'a'.repeat(64);
const call = (body: Record<string, unknown>) => rawCall({ ...BASE, ...body });

async function reserved(): Promise<string> {
  const first = await call({ op: 'reserve' });
  expect(first.json.error.code).toBe('APPROVAL_REQUIRED');
  approve(first.json.error.details.approval_id);
  const r = await call({ op: 'reserve', approval_id: first.json.error.details.approval_id });
  expect(r.status).toBe(200);
  return r.json.execution_id;
}

describe('lokaler Executor: reserve', () => {
  it('L1 ohne Freigabe ⇒ APPROVAL_REQUIRED', async () => {
    const r = await call({ op: 'reserve' });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('APPROVAL_REQUIRED');
  });

  it('L2 mit Freigabe ⇒ Reservierung, Vertrag für den Desktop, kein Playwright-Aufruf', async () => {
    const first = await call({ op: 'reserve' });
    approve(first.json.error.details.approval_id);
    const r = await call({ op: 'reserve', approval_id: first.json.error.details.approval_id });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, reservation_required: true, fingerprint_version: 'v2', allowed_origins: [ORIGIN], expected_page_origin: ORIGIN, expected_target: TARGET });
    expect(db.browser_executions[0]).toMatchObject({ id: r.json.execution_id, status: 'reserved' });
    expect(executorCalls).toHaveLength(0);
  });

  it('L3 funktioniert ohne konfigurierten Playwright-Dienst', async () => {
    const env = (globalThis as any).Deno.env;
    (globalThis as any).Deno.env = { get: () => undefined };
    try {
      const r = await call({ op: 'reserve' });
      expect(r.json.error.code).toBe('APPROVAL_REQUIRED');
      const ex = await call({ op: 'execute' });
      expect(ex.json.error.code).toBe('EXECUTOR_NOT_CONFIGURED');
    } finally {
      (globalThis as any).Deno.env = env;
    }
  });

  it('L4 Lese-Aktionen ⇒ keine Reservierung nötig', async () => {
    const r = await rawCall({ op: 'reserve', actions: [{ type: 'navigate', url: `${ORIGIN}/` }, { type: 'extract' }] });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ execution_id: null, reservation_required: false, allowed_origins: [ORIGIN] });
    expect(db.browser_executions).toHaveLength(0);
    const ev = db.governance_events.filter((e) => e.event_type === 'browser.action.reserved');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ policy_action: 'log', risk_level: 'low' });
    expect(ev[0].payload).toMatchObject({ executor: 'desktop', reservation_required: false, page_origin: null, allowed_origins: [ORIGIN] });
    expect(db.governance_evidence).toHaveLength(1);
    expect(db.governance_evidence[0]).toMatchObject({ event_id: ev[0].id });
    expect(r.json).toMatchObject({ event_id: ev[0].id, evidence_id: db.governance_evidence[0].id });
    expect(executorCalls).toHaveLength(0);
  });

  it('L4b Lese-reserve ohne schreibbares Event ⇒ 503, keine Domainliste', async () => {
    flags.eventError = true;
    const r = await rawCall({ op: 'reserve', actions: [{ type: 'navigate', url: `${ORIGIN}/` }] });
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe('AUDIT_UNAVAILABLE');
    expect(r.json.allowed_origins).toBeUndefined();
    expect(db.governance_evidence).toHaveLength(0);
  });

  it('L4c Lese-reserve ohne schreibbare Evidence ⇒ 503, keine Domainliste', async () => {
    flags.evidenceError = true;
    const r = await rawCall({ op: 'reserve', actions: [{ type: 'navigate', url: `${ORIGIN}/` }] });
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe('AUDIT_UNAVAILABLE');
    expect(r.json.allowed_origins).toBeUndefined();
  });

  it('L4d verändernde reserve schreibt keinen Lese-Nachweis', async () => {
    await reserved();
    expect(db.governance_events.some((e) => e.event_type === 'browser.action.reserved')).toBe(false);
    expect(db.governance_evidence).toHaveLength(0);
  });

  it('L5 nicht freigegebene Domain ⇒ 403', async () => {
    const r = await rawCall({ op: 'reserve', actions: [{ type: 'navigate', url: 'https://sammler.example/?d=1' }] });
    expect(r.status).toBe(403);
  });
});

describe('lokaler Executor: report', () => {
  it('L6 executed ⇒ Status, Event, Evidence und Auditzeile – ohne Klartextinhalte', async () => {
    const id = await reserved();
    const r = await call({ op: 'report', execution_id: id, outcome: 'executed', verification: 'passed', result_hash: HASH });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ ok: true, execution_status: 'executed', action_logged: true, verification: 'passed' });
    expect(db.browser_executions[0].status).toBe('executed');
    expect(db.governance_evidence).toHaveLength(1);
    const ev = db.governance_events.find((e) => e.event_type === 'browser.action.executed');
    expect(ev!.payload).toMatchObject({ executor: 'desktop', result_hash: HASH, verification: 'passed' });
    expect(db.browser_actions[0]).toMatchObject({ browser_action: 'submit', status: 'completed', policy_decision: 'require_approval', verification: 'passed', browser_execution_id: id, url: ORIGIN });
    const all = JSON.stringify([db.governance_events, db.governance_evidence, db.browser_actions]);
    expect(all).not.toContain('erika@example.org');
    expect(all).not.toContain('Erika Muster');
  });

  it('L7 unbekannte oder fremde execution_id ⇒ 404', async () => {
    await reserved();
    const r = await call({ op: 'report', execution_id: '00000000-0000-0000-0000-000000009999', outcome: 'executed' });
    expect(r.status).toBe(404);
    db.browser_executions[0].tenant_id = '00000000-0000-0000-0000-0000000000bb';
    const r2 = await call({ op: 'report', execution_id: db.browser_executions[0].id, outcome: 'executed' });
    expect(r2.status).toBe(404);
  });

  it('L8 veränderter Inhalt ⇒ REPORT_MISMATCH, nichts geschrieben', async () => {
    const id = await reserved();
    const r = await call({ op: 'report', execution_id: id, outcome: 'executed', target: { ...TARGET, values: { ...TARGET.values, email: 'angreifer@example.net' } } });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('REPORT_MISMATCH');
    expect(db.governance_evidence).toHaveLength(0);
    expect(db.browser_executions[0]).toMatchObject({ status: 'reserved', detail: null });
  });

  it('L9 doppelter report ⇒ ALREADY_REPORTED, kein zweiter Nachweis', async () => {
    const id = await reserved();
    expect((await call({ op: 'report', execution_id: id, outcome: 'executed' })).status).toBe(200);
    const r = await call({ op: 'report', execution_id: id, outcome: 'executed' });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('ALREADY_REPORTED');
    expect(db.governance_evidence).toHaveLength(1);
  });

  it('L10 parallele reports ⇒ genau ein Nachweis', async () => {
    const id = await reserved();
    const results = await Promise.all(Array.from({ length: 5 }, () => call({ op: 'report', execution_id: id, outcome: 'executed' })));
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.json?.error?.code === 'ALREADY_REPORTED')).toHaveLength(4);
    expect(db.governance_evidence).toHaveLength(1);
    expect(db.browser_actions).toHaveLength(1);
  });

  it('L11 Timeout ⇒ executor_failed, Freigabe verbraucht', async () => {
    const id = await reserved();
    const r = await call({ op: 'report', execution_id: id, outcome: 'failed', failure_code: 'TIMEOUT' });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ execution_status: 'executor_failed', approval_consumed: true });
    expect(db.browser_executions[0]).toMatchObject({ status: 'executor_failed', detail: 'desktop:TIMEOUT' });
    const again = await call({ op: 'reserve', approval_id: db.browser_executions[0].approval_id });
    expect(again.json.error.code).toBe('APPROVAL_ALREADY_USED');
  });

  it('L12 Evidence-Fehler ⇒ executed_unrecorded, kein ok', async () => {
    const id = await reserved();
    flags.evidenceError = true;
    const r = await call({ op: 'report', execution_id: id, outcome: 'executed' });
    expect(r.status).toBe(500);
    expect(r.json.error.code).toBe('EVIDENCE_WRITE_FAILED');
    expect(db.browser_executions[0].status).toBe('executed_unrecorded');
  });

  it('L13 inzwischen gesperrte Domain bzw. ausgefallene Richtlinie verhindert den Nachweis nicht', async () => {
    const id = await reserved();
    allowOrigins([ORIGIN], { action: 'block' });
    flags.policyError = true;
    const r = await call({ op: 'report', execution_id: id, outcome: 'executed' });
    expect(r.status).toBe(200);
    expect(db.governance_evidence).toHaveLength(1);
  });

  it('L14 ungültige Felder ⇒ 400', async () => {
    const id = await reserved();
    for (const bad of [
      { execution_id: 'kein-uuid', outcome: 'executed' },
      { execution_id: id, outcome: 'vielleicht' },
      { execution_id: id, outcome: 'executed', verification: 'egal' },
      { execution_id: id, outcome: 'executed', result_hash: 'xyz' },
      { execution_id: id, outcome: 'failed' },
      { execution_id: id, outcome: 'failed', failure_code: 'kleinbuchstaben' },
    ]) {
      expect((await call({ op: 'report', ...bad })).status).toBe(400);
    }
    const read = await rawCall({ op: 'report', execution_id: id, outcome: 'executed', actions: [{ type: 'extract' }], page_origin: ORIGIN });
    expect(read.status).toBe(400);
    expect(db.browser_executions[0]).toMatchObject({ status: 'reserved', detail: null });
  });
});
