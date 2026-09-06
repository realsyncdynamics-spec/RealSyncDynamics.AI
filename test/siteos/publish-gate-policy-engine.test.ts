/**
 * P2-3 — Der Publish Gate als Enforcement-Punkt der Mandantenrichtlinien.
 *
 * WAS HIER AUF DEM SPIEL STEHT
 *
 * Bis P2-3 entschied der Publish Gate ausschließlich nach fest verdrahteten
 * Regeln: Dimension, Schweregrad, zwei Blueprint-Flags. Die Richtlinien, die
 * ein Mandant selbst gepflegt hat, hatten beim Veröffentlichen **keine
 * Wirkung** — der Fragmentierungsbefund aus §1.4 des Enforcement-Plans, an
 * der schärfsten Stelle des Produkts (Zielarchitektur §7).
 *
 * Die Prüfungen hier belegen zweierlei, und das zweite ist das wichtigere:
 *   1. Die Entscheidung des PDP wirkt — `block` sperrt, `require_approval`
 *      hält an, `warn` warnt.
 *   2. Sie wirkt **innerhalb des bestehenden Vertrags**. Es gibt kein
 *      sechstes Feld und keinen zweiten Ableitungsweg; die Regel aus §7
 *      bleibt wörtlich dieselbe. Ein neues Feld hätte die generierte Spalte
 *      in der Datenbank und die Ableitung im Kern auseinanderlaufen lassen
 *      (Regel G2).
 */
import { describe, expect, it } from 'vitest';
import {
  evaluatePublishGate,
  type PolicyEngineState,
  type PublishGateInput,
} from '../../packages/siteos-core/src/publish/gate';
import { parseBrief } from '../../packages/siteos-core/src/blueprint/brief';
import { synthesizeBlueprint } from '../../packages/siteos-core/src/blueprint/synthesize';

const HASH = 'a'.repeat(64);

function cleanBlueprint() {
  return synthesizeBlueprint(parseBrief('Tischlerei in Kiel', 'de'), { source: 'ai-builder', model: null });
}

/** Sonst makelloser Zustand — nur die Richtlinienlage variiert. */
function input(policyEngine: PolicyEngineState, over: Partial<PublishGateInput> = {}): PublishGateInput {
  return {
    blueprint: cleanBlueprint(),
    findings: [],
    artifactSha256: HASH,
    evidence: { snapshotWritten: true, custodyLinked: true },
    backend: { kind: 'greenfield' },
    approval: { grantedForArtifactSha256: null, grantedBy: null, reason: null },
    policyEngine,
    evaluationId: '00000000-0000-4000-8000-000000000000',
    evaluatedAt: '2026-09-04T18:00:00.000Z',
    ...over,
  };
}

const NICHT_DURCHSETZEND: PolicyEngineState = {
  engine: 'not_enforcing',
  reason: 'Beobachtungsbetrieb',
};

describe('P2-3 / Die Mandantenrichtlinie wirkt beim Veröffentlichen', () => {
  it('ohne Richtlinienbefund bleibt eine makellose Site veröffentlichbar', () => {
    const r = evaluatePublishGate(input({ engine: 'consulted', decision: 'allow', reasons: [] }));
    expect(r.publishable).toBe(true);
    expect(r.status).toBe('passed');
  });

  it('"block" sperrt — über policy_compliant, nicht über ein neues Feld', () => {
    const r = evaluatePublishGate(input({
      engine: 'consulted',
      decision: 'block',
      reasons: ['Veröffentlichung ohne Freigabe der Rechtsabteilung ist untersagt.'],
    }));
    expect(r.policy_compliant).toBe(false);
    expect(r.publishable).toBe(false);
    expect(r.status).toBe('blocked');
    expect(r.blockers.join(' ')).toContain('Rechtsabteilung');
    // Die Begründung ist als Richtlinie erkennbar — sonst sucht jemand den
    // Fehler in den Analysebefunden.
    expect(r.blockers.some((b) => b.startsWith('Richtlinie:'))).toBe(true);
  });

  it('"require_approval" hält an, statt zu sperren — der Unterschied zählt', () => {
    const r = evaluatePublishGate(input({
      engine: 'consulted',
      decision: 'require_approval',
      reasons: ['Diese Veröffentlichung braucht die Freigabe der Datenschutzrolle.'],
    }));
    // policy_compliant bleibt wahr: Es liegt kein Verstoß vor, es fehlt eine
    // Entscheidung. Wer das vermischt, kann später nicht erklären, warum
    // etwas nicht veröffentlicht wurde.
    expect(r.policy_compliant).toBe(true);
    expect(r.human_approval_required).toBe(true);
    expect(r.publishable).toBe(false);
    expect(r.status).toBe('pending');
    expect(r.blockers.some((b) => b.includes('Datenschutzrolle'))).toBe(true);
  });

  it('"warn" warnt und hält nicht auf', () => {
    const r = evaluatePublishGate(input({
      engine: 'consulted',
      decision: 'warn',
      reasons: ['Diese Seite verweist auf einen Anbieter ausserhalb der EU.'],
    }));
    expect(r.publishable).toBe(true);
    expect(r.warnings.some((w) => w.includes('ausserhalb der EU'))).toBe(true);
  });

  it('"log_only" verändert nichts', () => {
    const r = evaluatePublishGate(input({ engine: 'consulted', decision: 'log_only', reasons: ['x'] }));
    expect(r.publishable).toBe(true);
    expect(r.warnings).toEqual([]);
  });
});

describe('P2-3 / Ausfall sperrt (G3) und sagt, dass er ein Ausfall war', () => {
  it('ein nicht erreichbarer PDP verhindert die Veröffentlichung', () => {
    const r = evaluatePublishGate(input({ engine: 'unavailable', detail: 'Zeitüberschreitung' }));
    expect(r.publishable).toBe(false);
    expect(r.policy_compliant).toBe(false);
    expect(r.status).toBe('blocked');
  });

  it('die Begründung nennt den Ausfall und die Regel — nicht einen erfundenen Verstoß', () => {
    // Wichtiger, als es aussieht: Eine Sperre wegen Ausfall, die wie ein
    // Richtlinienverstoß formuliert ist, schickt den Betreiber an die
    // falsche Stelle.
    const r = evaluatePublishGate(input({ engine: 'unavailable', detail: 'Zeitüberschreitung' }));
    const text = r.blockers.join(' ');
    expect(text).toContain('nicht erreichbar');
    expect(text).toContain('Zeitüberschreitung');
    expect(text).toContain('G3');
  });
});

describe('P2-3 / Beobachtungsbetrieb täuscht keine Strenge vor', () => {
  it('ändert das Ergebnis nicht', () => {
    const r = evaluatePublishGate(input(NICHT_DURCHSETZEND));
    expect(r.publishable).toBe(true);
    expect(r.policy_compliant).toBe(true);
  });

  it('sagt aber ausdrücklich, dass die Richtlinien hier nicht binden', () => {
    // Ein Gate, das strenger wirkt, als es ist, ist die Fehlerklasse, gegen
    // die dieser ganze Plan geschrieben ist.
    const r = evaluatePublishGate(input(NICHT_DURCHSETZEND));
    expect(r.warnings.some((w) => w.includes('nicht durchgesetzt'))).toBe(true);
  });
});

describe('P2-3 / Der Vertrag aus §7 bleibt unangetastet', () => {
  it('das Ergebnis trägt kein zusätzliches Vertragsfeld', () => {
    const r = evaluatePublishGate(input({ engine: 'consulted', decision: 'block', reasons: ['x'] }));
    // Genau die Felder aus §7, plus die beiden Begründungslisten und den
    // Hash-Anker, die es dort schon gab.
    expect(Object.keys(r).sort()).toEqual([
      'artifact_sha256', 'backend_preservation', 'blockers', 'evaluated_at',
      'evaluation_id', 'evidence_complete', 'human_approval_required',
      'policy_compliant', 'publishable', 'status', 'warnings',
    ]);
  });

  it('publishable folgt weiterhin genau der Ableitungsregel', () => {
    for (const state of [
      { engine: 'consulted', decision: 'allow', reasons: [] },
      { engine: 'consulted', decision: 'block', reasons: ['x'] },
      { engine: 'consulted', decision: 'require_approval', reasons: ['x'] },
      { engine: 'unavailable', detail: 'x' },
      NICHT_DURCHSETZEND,
    ] as PolicyEngineState[]) {
      const r = evaluatePublishGate(input(state));
      expect(r.publishable, JSON.stringify(state)).toBe(
        r.status === 'passed'
        && r.evidence_complete === true
        && r.backend_preservation === 'preserve_all'
        && r.policy_compliant === true
        && r.human_approval_required === false,
      );
    }
  });

  it('bleibt deterministisch — gleiche Eingabe, gleiches Ergebnis', () => {
    const state: PolicyEngineState = { engine: 'consulted', decision: 'block', reasons: ['a', 'b'] };
    expect(evaluatePublishGate(input(state))).toEqual(evaluatePublishGate(input(state)));
  });

  it('eine Richtliniensperre schlägt eine erteilte Freigabe nicht um', () => {
    // Eine Freigabe hebt die Freigabepflicht auf, nicht einen Verstoß. Sonst
    // wäre die Freigabe das Override-Flag, das G4 ausschliesst.
    const r = evaluatePublishGate(input(
      { engine: 'consulted', decision: 'block', reasons: ['untersagt'] },
      { approval: { grantedForArtifactSha256: HASH, grantedBy: 'user-1', reason: 'geprüft' } },
    ));
    expect(r.publishable).toBe(false);
    expect(r.policy_compliant).toBe(false);
  });
});
