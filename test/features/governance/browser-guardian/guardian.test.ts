// @vitest-environment node
import assert from 'node:assert/strict';
import { describe, it } from './_runner.ts';
import { CONTEXT, POLICY, req } from './fixtures.ts';
import {
  ApprovalLedger,
  APPROVAL_TTL_SECONDS,
  BrowserGuardian,
  EvidenceLog,
  generateHmacKey,
  MemoryEvidenceSink,
  SimulatedDriver,
  verifyEvidence,
} from '../../../../packages/browser-guardian/src/index.ts';
import type { EvidenceEntry, EvidenceSink, GuardianPolicy } from '../../../../packages/browser-guardian/src/index.ts';

const PAGES = {
  'https://www.example.org/': { title: 'Start', text: 'Willkommen. Öffnungszeiten 8–17 Uhr.', submits: { '#send': 'https://www.example.org/danke' } },
  'https://www.example.org/danke': { title: 'Danke', text: 'Danke.' },
  'https://www.example.org/team': { title: 'Team', text: 'Ansprechpartnerin: anna.schmidt@example.org' },
  'https://www.example.org/weiter': { title: 'Weiter', text: '', redirect_to: 'https://tracker.example.net/' },
  'https://tracker.example.net/': { title: 'Tracker', text: 'x' },
  'https://intranet.firma.example/': { title: 'Intern', text: 'Quartalszahlen intern' },
};

async function setup(opts: { sink?: EvidenceSink; now?: () => number; policy?: GuardianPolicy } = {}) {
  const sink = opts.sink ?? new MemoryEvidenceSink();
  const driver = new SimulatedDriver(PAGES);
  const guardian = new BrowserGuardian({
    policy: opts.policy ?? POLICY,
    context: CONTEXT,
    driver,
    evidence: new EvidenceLog(sink),
    key: await generateHmacKey(),
    approvals: new ApprovalLedger(opts.now),
  });
  return { guardian, driver, sink: sink as MemoryEvidenceSink };
}
const HUMAN = { kind: 'human' as const, id: 'user-1' };

describe('Guardian · Ausführung nur nach technischer Prüfung', () => {
  it('erlaubte Aktion läuft und hinterlässt Nachweis mit Richtlinienversion (Festlegung 5)', async () => {
    const { guardian, driver, sink } = await setup();
    const out = await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/' }));
    assert.equal(out.status, 'executed');
    assert.equal(driver.calls.length, 1);
    assert.ok(sink.entries.length >= 2);
    for (const e of sink.entries) assert.equal(e.record.policy_version, POLICY.version);
    assert.equal((await verifyEvidence(sink.entries)).ok, true);
  });

  it('unbekannte Aktion erreicht den Treiber nie', async () => {
    const { guardian, driver } = await setup();
    const out = await guardian.execute(req({ type: 'run_script', code: 'fetch("https://x")' }));
    assert.equal(out.status, 'denied');
    assert.equal(driver.calls.length, 0);
  });

  it('Freigabepflicht: ohne Freigabe kein Treiberaufruf; mit Freigabe genau einmal', async () => {
    const { guardian, driver } = await setup();
    await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/' }));
    const click = req({ type: 'click', selector: '#send' });
    assert.equal((await guardian.execute(click)).status, 'approval_required');
    assert.equal(driver.calls.length, 1);

    const { approval } = await guardian.propose(click);
    assert.ok(approval);
    assert.equal((await guardian.execute(click, approval.id)).approval_outcome, 'not_approved');
    await guardian.decideApproval(approval.id, HUMAN, true);
    const done = await guardian.execute(click, approval.id);
    assert.equal(done.status, 'executed');
    assert.equal(done.result?.url, 'https://www.example.org/danke');
    assert.equal((await guardian.execute(click, approval.id)).approval_outcome, 'already_used');
  });

  it('Freigabe gilt nur für genau diese Aktion', async () => {
    const { guardian } = await setup();
    await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/' }));
    const { approval } = await guardian.propose(req({ type: 'type', selector: '#q', text: 'Dachrinne' }));
    await guardian.decideApproval(approval!.id, HUMAN, true);
    const other = await guardian.execute(req({ type: 'type', selector: '#q', text: 'Dachrinne reparieren' }), approval!.id);
    assert.equal(other.approval_outcome, 'mismatch');
  });

  it('Modell/Planer kann nicht freigeben', async () => {
    const { guardian } = await setup();
    const { approval } = await guardian.propose(req({ type: 'navigate', url: 'https://unbekannt.example.net/' }));
    await assert.rejects(guardian.decideApproval(approval!.id, { kind: 'model', id: 'planner' } as never, true), /APPROVER_NOT_HUMAN/);
  });

  it('feste Freigabedauer 15 min; Richtlinie kann nicht verlängern (Festlegung 4)', async () => {
    let now = 1_000_000;
    const { guardian } = await setup({ now: () => now, policy: { ...POLICY, approval_ttl_seconds: 7 * 24 * 3600 } });
    const r = req({ type: 'navigate', url: 'https://unbekannt.example.net/' });
    const { approval } = await guardian.propose(r);
    assert.equal(approval!.expires_at - approval!.created_at, APPROVAL_TTL_SECONDS * 1000);
    await guardian.decideApproval(approval!.id, HUMAN, true);
    now += APPROVAL_TTL_SECONDS * 1000;
    assert.equal((await guardian.execute(r, approval!.id)).approval_outcome, 'expired');
  });

  it('Richtlinienwechsel macht offene Freigaben ungültig', async () => {
    const { guardian } = await setup();
    const r = req({ type: 'navigate', url: 'https://unbekannt.example.net/' });
    const { approval } = await guardian.propose(r);
    await guardian.decideApproval(approval!.id, HUMAN, true);
    await guardian.setPolicy({ ...POLICY, version: '2026-11-15.2' });
    assert.equal((await guardian.execute(r, approval!.id)).approval_outcome, 'mismatch');
  });
});

describe('Guardian · Ziel, Daten, Wirkung nach der Ausführung', () => {
  it('Weiterleitung auf ein ungeprüftes Ziel wird geblockt', async () => {
    const { guardian } = await setup();
    const out = await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/weiter' }));
    assert.equal(out.status, 'executor_failed');
    assert.equal(out.result?.error, 'DOCUMENT_BLOCKED');
    assert.equal(guardian.session.current_url, null);
  });

  it('gelesene personenbezogene Daten: nicht im Nachweis, Sitzung markiert, nicht ans Modell', async () => {
    const { guardian, sink } = await setup();
    await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/team' }));
    const out = await guardian.execute(req({ type: 'extract' }));
    assert.equal(out.status, 'executed');
    assert.equal(out.forward_to_model, false);
    assert.equal(guardian.session.tainted, true);
    assert.ok(!JSON.stringify(sink.entries).includes('anna.schmidt'));
    // Danach brauchen Bildschirmfoto und Zielwechsel eine Freigabe.
    assert.equal((await guardian.execute(req({ type: 'screenshot' }))).status, 'approval_required');
    assert.equal((await guardian.execute(req({ type: 'navigate', url: 'https://tracker.example.net/' }))).status, 'approval_required');
  });

  it('öffentlicher Inhalt ohne Funde darf als Kontext ans Modell', async () => {
    const { guardian } = await setup();
    await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/' }));
    assert.equal((await guardian.execute(req({ type: 'extract' }))).forward_to_model, true);
  });

  it('getippter Text steht nicht im Nachweis', async () => {
    const { guardian, sink } = await setup();
    await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/' }));
    const r = req({ type: 'type', selector: '#q', text: 'Geheimprojekt Dachrinne' });
    const { approval } = await guardian.propose(r);
    await guardian.decideApproval(approval!.id, HUMAN, true);
    assert.equal((await guardian.execute(r, approval!.id)).status, 'executed');
    assert.ok(!JSON.stringify(sink.entries).includes('Geheimprojekt'));
  });
});

describe('Guardian · Nachprüfung unabhängig vom Treiber', () => {
  it('Treiber landet trotz Wächter auf fremdem Ziel ⇒ fehlgeschlagen, Inhalt verworfen, Sitzung markiert', async () => {
    const rogue = {
      kind: 'simulation' as const,
      run: async () => ({ ok: true, url: 'https://tracker.example.net/', text: 'kunde@example.net' }),
      close: async () => undefined,
    };
    const g = new BrowserGuardian({
      policy: POLICY, context: CONTEXT, driver: rogue, evidence: new EvidenceLog(new MemoryEvidenceSink()), key: await generateHmacKey(),
    });
    const out = await g.execute(req({ type: 'navigate', url: 'https://www.example.org/' }));
    assert.equal(out.status, 'executor_failed');
    assert.equal(out.result?.error, 'LANDED_OUTSIDE_DECISION');
    assert.equal(out.result?.text, undefined);
    assert.equal(g.session.tainted, true);
  });
});

describe('Guardian · Prüfpfad', () => {
  it('Nachweis nicht schreibbar ⇒ nichts ausgeführt, Sitzung angehalten', async () => {
    const failing: EvidenceSink = { append: async () => { throw new Error('disk full'); } };
    const { guardian, driver } = await setup({ sink: failing });
    assert.equal((await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/' }))).status, 'evidence_failed');
    assert.equal(driver.calls.length, 0);
    assert.equal(guardian.session.halted, true);
  });

  it('Manipulation am Nachweis wird erkannt', async () => {
    const { guardian, sink } = await setup();
    await guardian.execute(req({ type: 'navigate', url: 'https://www.example.org/' }));
    const tampered: EvidenceEntry[] = sink.entries.map((e) => ({ ...e, record: { ...e.record } }));
    tampered[0].record.decision = 'deny';
    const check = await verifyEvidence(tampered);
    assert.equal(check.ok, false);
    assert.equal(check.issues[0].issue, 'hash_mismatch');
  });
});
