/**
 * browser-execute mit Domain-Freigabe (PR B, Lücke G1) – Handler-Test.
 *
 * Geprüft:
 *  D1  ohne Richtlinie ⇒ 403 DOMAIN_NOT_ALLOWED (Standard: verboten), Executor nicht aufgerufen
 *  D2  freigegebene Domain ⇒ 200, Executor bekommt allowed_origins und expected_page_origin
 *  D3  Prompt-Injection-Navigation zu fremder Domain mit Daten in der URL ⇒ 403, nichts ausgeführt
 *  D4  Navigation weg von der freigegebenen Domain mitten in der Aktionsfolge ⇒ 403
 *  D5  Richtlinie nicht lesbar ⇒ 503 POLICY_UNAVAILABLE (fail-closed)
 *  D6  block schlägt allow
 *  D7  observe-Richtlinie gewährt keine Freigabe
 *  D8  deaktivierte Richtlinie gewährt keine Freigabe
 *  D9  Empfänger (target.origin) nicht freigegeben ⇒ 403, bevor eine Freigabe angelegt wird
 *  D10 Aktion ohne navigate und ohne page_origin ⇒ 403 (Origin unbekannt)
 *  D11 page_origin mit Pfad ⇒ 400
 *  D12 Sperre wird als governance_event protokolliert (ohne Klartext-Eingaben)
 *  D13 Richtlinie eines anderen Mandanten zählt nicht
 *  D14 Freigabe für staging gilt nicht in der produktiven Runtime (N3)
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ORIGIN, allowOrigins, call, db, executorCalls, flags, loadHandler, resetDb } from './_browser-execute-harness.ts';

vi.mock('../../supabase/functions/_shared/auth.ts', async () => {
  const h = await import('./_browser-execute-harness.ts');
  return { requireAuthAndTenant: async () => ({ admin: h.admin, tenantId: h.TENANT, user: { id: 'user-1', email: 'pruefer@example.org' } }) };
});
vi.mock('../../supabase/functions/_shared/ai.ts', () => ({
  AiInvokeError: class extends Error {},
  runAiTool: async () => { throw new Error('nicht im Test'); },
}));

beforeAll(() => loadHandler(vi));
beforeEach(() => resetDb());

const READ = [{ type: 'navigate', url: `${ORIGIN}/kontakt` }, { type: 'extract' }];

describe('browser-execute Domain-Freigabe', () => {
  it('D1 ohne Richtlinie ⇒ verboten', async () => {
    const r = await call({ actions: READ });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe('DOMAIN_NOT_ALLOWED');
    expect(executorCalls).toHaveLength(0);
  });

  it('D2 freigegebene Domain ⇒ ausgeführt, Executor bekommt die Freigabeliste', async () => {
    allowOrigins([ORIGIN]);
    const r = await call({ actions: READ });
    expect(r.status).toBe(200);
    expect(executorCalls[0].body.allowed_origins).toEqual([ORIGIN]);
    expect(executorCalls[0].body.expected_page_origin).toBeNull();
  });

  it('D3 Injection-Navigation mit Daten in der URL ⇒ gesperrt', async () => {
    allowOrigins([ORIGIN]);
    const r = await call({ page_origin: ORIGIN, actions: [{ type: 'navigate', url: 'https://sammler.example/x?kunde=Erika+Muster&iban=DE00' }] });
    expect(r.status).toBe(403);
    expect(r.json.error.details.origin).toBe('https://sammler.example');
    expect(executorCalls).toHaveLength(0);
  });

  it('D4 Wechsel auf fremde Domain mitten in der Folge ⇒ gesperrt (Index der Aktion)', async () => {
    allowOrigins([ORIGIN]);
    const r = await call({ actions: [{ type: 'navigate', url: `${ORIGIN}/` }, { type: 'extract' }, { type: 'navigate', url: 'https://fremd.example/' }, { type: 'extract' }] });
    expect(r.status).toBe(403);
    expect(r.json.error.details.action_index).toBe(2);
    expect(executorCalls).toHaveLength(0);
  });

  it('D5 Richtlinie nicht lesbar ⇒ 503, nichts ausgeführt', async () => {
    allowOrigins([ORIGIN]);
    flags.policyError = true;
    const r = await call({ actions: READ });
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe('POLICY_UNAVAILABLE');
    expect(executorCalls).toHaveLength(0);
  });

  it('D6 block schlägt allow', async () => {
    allowOrigins([ORIGIN]);
    allowOrigins([ORIGIN], { action: 'block', mode: 'observe' });
    const r = await call({ actions: READ });
    expect(r.status).toBe(403);
    expect(executorCalls).toHaveLength(0);
  });

  it('D7 observe-Richtlinie gewährt keine Freigabe', async () => {
    allowOrigins([ORIGIN], { mode: 'observe' });
    expect((await call({ actions: READ })).status).toBe(403);
  });

  it('D8 deaktivierte Richtlinie gewährt keine Freigabe', async () => {
    allowOrigins([ORIGIN], { enabled: false });
    expect((await call({ actions: READ })).status).toBe(403);
  });

  it('D9 Empfänger nicht freigegeben ⇒ gesperrt, keine Freigabe angelegt', async () => {
    allowOrigins([ORIGIN]);
    const r = await call({
      page_origin: ORIGIN,
      actions: [{ type: 'click', selector: '#senden' }],
      target: { origin: 'https://sammler.example', method: 'POST', values: { email: 'erika@example.org' } },
    });
    expect(r.status).toBe(403);
    expect(r.json.error.details.origin).toBe('https://sammler.example');
    expect(db.governance_approvals).toHaveLength(0);
  });

  it('D10 ohne navigate und ohne page_origin ⇒ gesperrt', async () => {
    allowOrigins([ORIGIN]);
    const r = await call({ actions: [{ type: 'extract' }] });
    expect(r.status).toBe(403);
    expect(executorCalls).toHaveLength(0);
  });

  it('D11 page_origin mit Pfad ⇒ 400', async () => {
    allowOrigins([ORIGIN]);
    const r = await call({ page_origin: `${ORIGIN}/kontakt`, actions: [{ type: 'extract' }] });
    expect(r.status).toBe(400);
  });

  it('D12 Sperre wird protokolliert, ohne Klartext-Eingaben', async () => {
    allowOrigins([ORIGIN]);
    await call({
      page_origin: 'https://fremd.example',
      actions: [{ type: 'type', selector: '#iban', text: 'DE00 1234 5678' }],
      target: { origin: 'https://fremd.example', method: 'POST', values: { iban: 'DE00 1234 5678' } },
    });
    const ev = db.governance_events.find((e) => e.event_type === 'browser.action.blocked');
    expect(ev).toBeTruthy();
    expect(ev!.policy_action).toBe('block');
    expect(JSON.stringify(ev!.payload)).not.toContain('DE00 1234 5678');
  });

  it('D13 Richtlinie eines anderen Mandanten zählt nicht', async () => {
    db.governance_policies.push({ id: 'p-fremd', tenant_id: '00000000-0000-0000-0000-0000000000bb', policy_type: 'data_transfer', enabled: true, action: 'allow', mode: 'enforce', condition: { scope: 'browser_origin', origins: [ORIGIN] } });
    expect((await call({ actions: READ })).status).toBe(403);
  });

  it('D14 Freigabe für staging gilt nicht in der produktiven Runtime (N3)', async () => {
    allowOrigins([ORIGIN], { environment: 'staging' });
    expect((await call({ actions: READ })).status).toBe(403);
    allowOrigins([ORIGIN]);
    expect((await call({ actions: READ })).status).toBe(200);
  });
});
