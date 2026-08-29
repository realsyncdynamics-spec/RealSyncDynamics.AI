// Prüft die Regel des SiteOS Publish Gate gegen den normativen Text in
// `docs/architecture/target-architecture.md` §7.
//
// Die Tests sind bewusst nah am Dokument formuliert: sie zitieren die Regeln
// G1–G6 in den Beschreibungen, damit eine spätere Änderung an der Regel
// auffällt, bevor sie in Produktion auffällt.

import { describe, expect, it } from 'vitest';
import {
  assertPublishable,
  deriveBackendPreservation,
  derivePublishable,
  evaluatePublishGate,
  isEvaluationValidFor,
  type PublishGateFacts,
} from '../../packages/siteos-core/src/governance/publish-gate.ts';

const ARTIFACT = 'a'.repeat(64);
const BLUEPRINT = 'b'.repeat(64);
const FIXED_NOW = new Date('2026-08-23T10:00:00.000Z');

/** Die vollständig saubere Ausgangslage — der einzige Fall, der durchgeht. */
function passingFacts(): PublishGateFacts {
  return {
    artifact_sha256: ARTIFACT,
    blueprint_sha256: BLUEPRINT,
    evidence: { expected: ['hash', 'policy_snapshot'], present: ['hash', 'policy_snapshot'] },
    policy: { violations: [] },
    backend: { before: ['contact_form', 'checkout'], after: ['contact_form', 'checkout'] },
    approval: { required: false, granted_by: null, granted_at: null },
  };
}

function evaluate(facts: PublishGateFacts) {
  return evaluatePublishGate(facts, { now: FIXED_NOW, evaluationId: 'eval-fixed' });
}

describe('Publish Gate — Ableitungsregel (§7)', () => {
  it('gibt frei, wenn alle fünf Bedingungen erfüllt sind', () => {
    const evaluation = evaluate(passingFacts());
    expect(evaluation.status).toBe('passed');
    expect(evaluation.publishable).toBe(true);
    expect(evaluation.reasons).toEqual([]);
  });

  it('bildet die Regel wörtlich ab: jede einzelne Bedingung kippt das Ergebnis', () => {
    const base = {
      status: 'passed' as const,
      evidence_complete: true,
      backend_preservation: 'preserve_all' as const,
      policy_compliant: true,
      human_approval_required: false,
    };
    expect(derivePublishable(base)).toBe(true);

    expect(derivePublishable({ ...base, status: 'pending' })).toBe(false);
    expect(derivePublishable({ ...base, status: 'blocked' })).toBe(false);
    expect(derivePublishable({ ...base, evidence_complete: false })).toBe(false);
    expect(derivePublishable({ ...base, backend_preservation: 'changed' })).toBe(false);
    expect(derivePublishable({ ...base, backend_preservation: 'unknown' })).toBe(false);
    expect(derivePublishable({ ...base, policy_compliant: false })).toBe(false);
    expect(derivePublishable({ ...base, human_approval_required: true })).toBe(false);
  });

  it('setzt publishable nie direkt — es folgt immer aus den Feldern (G4)', () => {
    // Für jede erzeugte Evaluation muss die Regel nachrechenbar sein.
    const cases: PublishGateFacts[] = [
      passingFacts(),
      { ...passingFacts(), backend: null },
      { ...passingFacts(), policy: { violations: [{ policy_key: 'x', blocking: true, message: 'x' }] } },
      { ...passingFacts(), evidence: { expected: ['hash'], present: [] } },
    ];
    for (const facts of cases) {
      const evaluation = evaluate(facts);
      expect(evaluation.publishable).toBe(derivePublishable(evaluation));
    }
  });
});

describe('Publish Gate — fail-closed (G3)', () => {
  it('blockiert bei fehlendem Backend-Vergleich statt zu raten', () => {
    const evaluation = evaluate({ ...passingFacts(), backend: null });
    expect(evaluation.backend_preservation).toBe('unknown');
    expect(evaluation.publishable).toBe(false);
    expect(evaluation.status).toBe('pending');
    expect(evaluation.reasons.map((r) => r.code)).toContain('BACKEND_UNKNOWN');
  });

  it('blockiert, wenn eine backend-gebundene Funktion verloren geht', () => {
    const evaluation = evaluate({
      ...passingFacts(),
      backend: { before: ['contact_form', 'checkout'], after: ['contact_form'] },
    });
    expect(evaluation.backend_preservation).toBe('changed');
    expect(evaluation.status).toBe('blocked');
    expect(evaluation.publishable).toBe(false);
    expect(evaluation.reasons.find((r) => r.code === 'BACKEND_CHANGED')?.ref).toBe('checkout');
  });

  it('wertet neu hinzugekommene Funktionen nicht als Verlust', () => {
    const { value, lost } = deriveBackendPreservation({
      before: ['contact_form'],
      after: ['contact_form', 'newsletter'],
    });
    expect(value).toBe('preserve_all');
    expect(lost).toEqual([]);
  });

  it('nennt jeden fehlenden Nachweis einzeln', () => {
    const evaluation = evaluate({
      ...passingFacts(),
      evidence: { expected: ['hash', 'policy_snapshot'], present: ['hash'] },
    });
    expect(evaluation.evidence_complete).toBe(false);
    expect(evaluation.publishable).toBe(false);
    const missing = evaluation.reasons.filter((r) => r.code === 'EVIDENCE_INCOMPLETE');
    expect(missing).toHaveLength(1);
    expect(missing[0].ref).toBe('policy_snapshot');
  });
});

describe('Publish Gate — Policy und Freigabe', () => {
  it('unterscheidet blockierende von nicht blockierenden Verstössen', () => {
    const soft = evaluate({
      ...passingFacts(),
      policy: { violations: [{ policy_key: 'seo.title', blocking: false, message: 'Titel kurz' }] },
    });
    expect(soft.policy_compliant).toBe(true);
    expect(soft.publishable).toBe(true);

    const hard = evaluate({
      ...passingFacts(),
      policy: {
        violations: [{ policy_key: 'dsgvo.consent', blocking: true, message: 'Tracking ohne Einwilligung' }],
      },
    });
    expect(hard.policy_compliant).toBe(false);
    expect(hard.status).toBe('blocked');
    expect(hard.reasons.find((r) => r.code === 'POLICY_VIOLATION')?.ref).toBe('dsgvo.consent');
  });

  it('hält eine verlangte, aber nicht erteilte Freigabe offen', () => {
    const evaluation = evaluate({
      ...passingFacts(),
      approval: { required: true, granted_by: null, granted_at: null },
    });
    expect(evaluation.human_approval_required).toBe(true);
    expect(evaluation.status).toBe('pending');
    expect(evaluation.publishable).toBe(false);
  });

  it('gibt frei, sobald eine Person die Freigabe erteilt hat (G4: Person, kein Flag)', () => {
    const evaluation = evaluate({
      ...passingFacts(),
      approval: {
        required: true,
        granted_by: '11111111-1111-1111-1111-111111111111',
        granted_at: '2026-08-23T09:00:00.000Z',
      },
    });
    expect(evaluation.human_approval_required).toBe(false);
    expect(evaluation.publishable).toBe(true);
  });

  it('akzeptiert keine halbe Freigabe (Person ohne Zeitpunkt)', () => {
    const evaluation = evaluate({
      ...passingFacts(),
      approval: { required: true, granted_by: 'someone', granted_at: null },
    });
    expect(evaluation.human_approval_required).toBe(true);
    expect(evaluation.publishable).toBe(false);
  });
});

describe('Publish Gate — Status trennt "geht nicht" von "noch nicht"', () => {
  it('meldet blocked bei festgestelltem Negativbefund', () => {
    expect(
      evaluate({
        ...passingFacts(),
        policy: { violations: [{ policy_key: 'p', blocking: true, message: 'm' }] },
      }).status,
    ).toBe('blocked');
  });

  it('meldet pending bei noch offenem Vorgang', () => {
    expect(evaluate({ ...passingFacts(), backend: null }).status).toBe('pending');
  });

  it('lässt blocked vor pending gewinnen — ein Verstoss verschwindet nicht durch Warten', () => {
    const evaluation = evaluate({
      ...passingFacts(),
      backend: null,
      policy: { violations: [{ policy_key: 'p', blocking: true, message: 'm' }] },
    });
    expect(evaluation.status).toBe('blocked');
  });
});

describe('Publish Gate — Artefakt-Bindung (G6)', () => {
  it('trägt den Artefakt-Hash im Ergebnis', () => {
    expect(evaluate(passingFacts()).artifact_sha256).toBe(ARTIFACT);
  });

  it('verfällt, sobald sich das Artefakt ändert', () => {
    const evaluation = evaluate(passingFacts());
    expect(isEvaluationValidFor(evaluation, ARTIFACT)).toBe(true);
    expect(isEvaluationValidFor(evaluation, 'c'.repeat(64))).toBe(false);
  });

  it('nennt beim Artefaktwechsel den Grund und nicht nur ein Nein', () => {
    const evaluation = evaluate(passingFacts());
    const result = assertPublishable(evaluation, 'c'.repeat(64));
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reasons[0].code).toBe('ARTIFACT_MISMATCH');
    }
  });

  it('reicht die Gründe der Bewertung durch, wenn das Artefakt stimmt', () => {
    const evaluation = evaluate({ ...passingFacts(), backend: null });
    const result = assertPublishable(evaluation, ARTIFACT);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reasons.map((r) => r.code)).toContain('BACKEND_UNKNOWN');
    }
  });

  it('gibt frei, wenn Bewertung und Artefakt zusammenpassen', () => {
    expect(assertPublishable(evaluate(passingFacts()), ARTIFACT)).toEqual({ allowed: true });
  });
});

describe('Publish Gate — Ergebnisform', () => {
  it('liefert alle Contract-Felder aus §7', () => {
    const evaluation = evaluate(passingFacts());
    for (const field of [
      'status',
      'evidence_complete',
      'backend_preservation',
      'policy_compliant',
      'human_approval_required',
      'publishable',
      'evaluated_at',
      'evaluation_id',
    ]) {
      expect(evaluation).toHaveProperty(field);
    }
  });

  it('schreibt evaluated_at als ISO-Zeitstempel', () => {
    expect(evaluate(passingFacts()).evaluated_at).toBe('2026-08-23T10:00:00.000Z');
  });

  it('vergibt ohne Vorgabe eine eigene Kennung je Auswertung', () => {
    const first = evaluatePublishGate(passingFacts());
    const second = evaluatePublishGate(passingFacts());
    expect(first.evaluation_id).not.toBe(second.evaluation_id);
  });
});
