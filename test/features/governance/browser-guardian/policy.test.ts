// @vitest-environment node
import assert from 'node:assert/strict';
import { describe, it } from './_runner.ts';
import { CONTEXT, FRESH, on, POLICY, req } from './fixtures.ts';
import { classifyText, evaluate, isPrivateHostLiteral } from '../../../../packages/browser-guardian/src/index.ts';
import type { ActionRequest, GuardianPolicy, SessionState } from '../../../../packages/browser-guardian/src/index.ts';

const run = (request: ActionRequest, session: SessionState = FRESH, policy: GuardianPolicy = POLICY) =>
  evaluate({ policy, context: CONTEXT, session, request });
const codes = (d: ReturnType<typeof run>) => d.reasons.map((r) => r.code);

describe('Browser-Policy · Rahmen (fail-closed)', () => {
  it('unbekannte Aktion ⇒ deny, nie log_only', () => {
    const d = run(req({ type: 'download', url: 'https://www.example.org/x.zip' }));
    assert.equal(d.decision, 'deny');
    assert.deepEqual(codes(d), ['UNKNOWN_ACTION']);
  });

  it('keine Entscheidung außerhalb allow/require_approval/deny', () => {
    const actions = [
      { type: 'navigate', url: 'https://www.example.org/' }, { type: 'scroll', direction: 'down' },
      { type: 'click', selector: '#a' }, { type: 'type', selector: '#a', text: 'x' },
      { type: 'select', selector: '#a', value: 'x' }, { type: 'extract' }, { type: 'wait', milliseconds: 1 },
      { type: 'screenshot' }, { type: 'evaluate_js', code: '1' }, null, 42,
    ];
    for (const a of actions) {
      for (const s of [FRESH, on('https://www.example.org/', 'public'), on('https://crm.firma.example/', 'personal', true)]) {
        assert.ok(['allow', 'require_approval', 'deny'].includes(run(req(a), s).decision));
      }
    }
  });

  it('ungültige Richtlinie ⇒ deny', () => {
    const d = run(req({ type: 'wait', milliseconds: 1 }), FRESH, { ...POLICY, version: '' });
    assert.equal(d.decision, 'deny');
    assert.deepEqual(codes(d), ['POLICY_INVALID']);
  });

  it('Kill-Switch aktiv oder nicht gesetzt ⇒ deny', () => {
    for (const kill_switch of [true, undefined as unknown as boolean]) {
      const d = evaluate({ policy: POLICY, context: { ...CONTEXT, kill_switch }, session: FRESH, request: req({ type: 'wait', milliseconds: 1 }) });
      assert.deepEqual(codes(d), ['KILL_SWITCH']);
    }
  });

  it('fehlender Mandant ⇒ deny', () => {
    const d = evaluate({ policy: POLICY, context: { ...CONTEXT, tenant_id: '' }, session: FRESH, request: req({ type: 'wait', milliseconds: 1 }) });
    assert.deepEqual(codes(d), ['CONTEXT_INVALID']);
  });

  it('Sprachkanal gesperrt (Festlegung 6)', () => {
    const d = run(req({ type: 'navigate', url: 'https://www.example.org/' }, { channel: 'voice' }));
    assert.deepEqual(codes(d), ['VOICE_DISABLED']);
  });

  it('angehaltene Sitzung und Schrittlimit ⇒ deny', () => {
    assert.deepEqual(codes(run(req({ type: 'wait', milliseconds: 1 }), { ...FRESH, halted: true })), ['SESSION_HALTED']);
    assert.deepEqual(codes(run(req({ type: 'wait', milliseconds: 1 }), { ...FRESH, step_count: 25 })), ['STEP_LIMIT']);
    const raised = { ...POLICY, max_session_steps: 1000 };
    assert.deepEqual(codes(run(req({ type: 'wait', milliseconds: 1 }), { ...FRESH, step_count: 25 }, raised)), ['STEP_LIMIT']);
  });
});

describe('Browser-Policy · Navigation prüft Ziel und Daten', () => {
  it('öffentliches Ziel ⇒ allow', () => {
    const d = run(req({ type: 'navigate', url: 'https://www.example.org/impressum' }));
    assert.equal(d.decision, 'allow');
    assert.equal(d.target_class, 'public');
    assert.equal(d.policy_version, POLICY.version);
  });

  it('nicht gelistetes Ziel ⇒ Freigabe (nur öffentlich ohne Prüfung, Festlegung 3)', () => {
    const d = run(req({ type: 'navigate', url: 'https://unbekannt.example.net/' }));
    assert.equal(d.decision, 'require_approval');
    assert.ok(codes(d).includes('ORIGIN_UNCLASSIFIED'));
  });

  it('internes/personenbezogenes Ziel ⇒ Freigabe, personenbezogen mit Datenschutzprüfung', () => {
    assert.equal(run(req({ type: 'navigate', url: 'https://intranet.firma.example/' })).review, 'human_approval');
    assert.equal(run(req({ type: 'navigate', url: 'https://crm.firma.example/kunden' })).review, 'data_protection_review');
  });

  it('Schema, Zugangsdaten, lokale Netze, Sperrliste ⇒ deny', () => {
    for (const url of ['file:///etc/passwd', 'javascript:alert(1)', 'https://u:p@www.example.org/',
      'http://127.0.0.1/', 'http://169.254.169.254/latest/meta-data', 'http://localhost:8080', 'http://[::1]/',
      'http://2130706433/', 'http://[::ffff:127.0.0.1]/', 'http://router/', 'https://evil.example/']) {
      assert.equal(run(req({ type: 'navigate', url })).decision, 'deny', url);
    }
  });

  it('personenbezogene Daten in der Adresse ⇒ Datenschutzprüfung, auch bei öffentlichem Ziel', () => {
    const d = run(req({ type: 'navigate', url: 'https://www.example.org/suche?q=max.mustermann%40mail.de' }));
    assert.equal(d.decision, 'require_approval');
    assert.equal(d.review, 'data_protection_review');
    assert.ok(codes(d).includes('URL_CARRIES_SENSITIVE_DATA'));
  });

  it('nach dem Lesen interner Inhalte: Zielwechsel und lange Parameter ⇒ Freigabe', () => {
    const tainted = on('https://intranet.firma.example/bericht', 'internal', true);
    assert.ok(codes(run(req({ type: 'navigate', url: 'https://www.example.org/' }), tainted)).includes('SESSION_TAINTED'));
    const sameOrigin = on('https://www.example.org/a', 'public', true);
    const d = run(req({ type: 'navigate', url: `https://www.example.org/b?d=${'A'.repeat(80)}` }), sameOrigin);
    assert.ok(codes(d).includes('POSSIBLE_ENCODED_EGRESS'));
  });
});

describe('Browser-Policy · Lesen ist nicht automatisch harmlos', () => {
  it('Auslesen/Bildschirmfoto: öffentlich ⇒ allow, sonst Freigabe', () => {
    for (const type of ['extract', 'screenshot']) {
      assert.equal(run(req({ type }), on('https://www.example.org/', 'public')).decision, 'allow');
      assert.equal(run(req({ type }), on('https://intranet.firma.example/', 'internal')).decision, 'require_approval');
      assert.equal(run(req({ type }), on('https://neu.example.net/', 'unclassified')).decision, 'require_approval');
      assert.equal(run(req({ type }), on('https://www.example.org/', 'public', true)).review, 'data_protection_review');
    }
  });

  it('ohne geladene Seite ⇒ deny', () => {
    assert.deepEqual(codes(run(req({ type: 'extract' }))), ['NO_PAGE']);
  });
});

describe('Browser-Policy · Verändern', () => {
  const page = on('https://www.example.org/form', 'public');

  it('click/select/type brauchen immer eine Freigabe', () => {
    for (const a of [{ type: 'click', selector: '#send' }, { type: 'select', selector: '#s', value: 'a' }, { type: 'type', selector: '#q', text: 'Dachrinne' }]) {
      const d = run(req(a), page);
      assert.equal(d.decision, 'require_approval');
      assert.ok(codes(d).includes('MUTATION_REQUIRES_APPROVAL'));
    }
  });

  it('Passwörter, Schlüssel und Kartendaten tippt der Agent nie', () => {
    assert.ok(codes(run(req({ type: 'type', selector: '#pw', text: 'password=Hunter2!' }), page)).includes('INPUT_SECRET'));
    assert.equal(run(req({ type: 'type', selector: '#k', text: 'sk-abcdefghijklmnopqrstuv' }), page).decision, 'deny');
    assert.equal(run(req({ type: 'type', selector: '#cc', text: '4111 1111 1111 1111' }), page).decision, 'deny');
  });

  it('personenbezogene Eingabe ⇒ Datenschutzprüfung', () => {
    const d = run(req({ type: 'type', selector: '#mail', text: 'kunde@beispiel.de' }), page);
    assert.equal(d.decision, 'require_approval');
    assert.equal(d.review, 'data_protection_review');
  });
});

describe('Klassifikation', () => {
  it('erkennt E-Mail, Telefon, IBAN, Karte, Schlüssel; Text ohne Funde bleibt öffentlich', () => {
    assert.equal(classifyText('Öffnungszeiten Mo–Fr 8–17 Uhr').data_class, 'public');
    assert.equal(classifyText('Mail: a.b@firma.de').data_class, 'personal');
    assert.equal(classifyText('Tel. +49 30 1234567').data_class, 'personal');
    assert.equal(classifyText('IBAN DE89 3704 0044 0532 0130 00').data_class, 'personal');
    assert.equal(classifyText('ghp_abcdefghijklmnopqrstuvwxyz123456').data_class, 'confidential');
    // Ungültige Prüfziffer ⇒ keine IBAN (die Ziffernfolge darf als Telefon gelten: Heuristik verschärft nur).
    assert.ok(!classifyText('DE00 0000 0000 0000 0000 00').findings.some((f) => f.kind === 'iban'));
  });

  it('Inhalt entschärft nie die deklarierte Klasse', () => {
    assert.equal(classifyText('harmlos', 'internal').data_class, 'internal');
  });

  it('private Host-Literale', () => {
    assert.equal(isPrivateHostLiteral('www.example.org'), false);
    assert.equal(isPrivateHostLiteral('fcbayern.de'), false);
    assert.equal(isPrivateHostLiteral('10.0.0.1'), true);
    assert.equal(isPrivateHostLiteral('[fd00::1]'), true);
  });
});
