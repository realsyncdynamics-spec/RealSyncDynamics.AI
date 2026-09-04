// Publish Gate — Contract §7 der Zielarchitektur.
//
// Geprüft wird nicht, ob die Funktion „funktioniert", sondern ob sie die
// sechs verbindlichen Regeln einhält. Jede davon beschreibt einen Weg, ein
// Gate auszuhebeln — die Tests sind entsprechend als Angriffe formuliert.

import { describe, it, expect } from 'vitest';
import {
  buildSiteFromPrompt,
  evaluatePublishGate,
  parseBrief,
  synthesizeBlueprint,
  type ApprovalState,
  type BackendState,
  type EvidenceState,
  type PolicyEngineState,
  type PublishGateInput,
  type RuntimeFinding,
  type SiteBlueprint,
} from '../../packages/siteos-core/src/index';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

function cleanBlueprint(): SiteBlueprint {
  // Agentur statt Heilberuf: kein Art.-9-Bezug, also keine Freigabepflicht
  // aus dem Compliance-Profil.
  return synthesizeBlueprint(parseBrief('Website für eine Agentur in Köln.'), { model: null });
}

const completeEvidence: EvidenceState = { snapshotWritten: true, custodyLinked: true };
const greenfield: BackendState = { kind: 'greenfield' };
const noApproval: ApprovalState = { grantedForArtifactSha256: null, grantedBy: null, reason: null };

// Die Regeln des Mandanten greifen nicht — der Zustand, den diese Tests
// voraussetzen. Sie prüfen die eigene Befundtabelle des Gates, nicht den PDP;
// dessen Wirkung steht in `publish-gate-pdp.test.ts`.
const policyAllows: PolicyEngineState = {
  kind: 'evaluated',
  decision: 'allow',
  reasons: [],
  matchedPolicyIds: [],
  snapshotVersion: 'test-snapshot',
};

function input(overrides: Partial<PublishGateInput> = {}): PublishGateInput {
  return {
    blueprint: cleanBlueprint(),
    findings: [],
    artifactSha256: HASH_A,
    evidence: completeEvidence,
    backend: greenfield,
    policy: policyAllows,
    approval: noApproval,
    // P2-3: Voreinstellung der Tests — ohne Mandantenrichtlinie, damit die
    // bestehenden Faelle unveraendert dasselbe pruefen wie zuvor.
    policyEngine: { engine: 'not_enforcing', reason: 'Test ohne Richtlinienpruefung' },
    evaluationId: 'eval-1',
    evaluatedAt: '2026-08-22T12:00:00.000Z',
    ...overrides,
  };
}

function finding(over: Partial<RuntimeFinding>): RuntimeFinding {
  return {
    code: 'gdpr.test',
    dimension: 'gdpr',
    severity: 'high',
    title: 'Testbefund',
    detail: 'Detail',
    reference: null,
    remediable: false,
    ...over,
  } as RuntimeFinding;
}

describe('Publish Gate — Grundfall', () => {
  it('lässt eine saubere Greenfield-Site durch', () => {
    const result = evaluatePublishGate(input());

    expect(result.status).toBe('passed');
    expect(result.publishable).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('trägt Anker und Artefakt-Hash mit (G5, G6)', () => {
    const result = evaluatePublishGate(input());
    expect(result.evaluation_id).toBe('eval-1');
    expect(result.artifact_sha256).toBe(HASH_A);
  });
});

describe('Publish Gate — G3: fail-closed', () => {
  it('sperrt bei unbekannter Backend-Erhaltung', () => {
    const result = evaluatePublishGate(input({ backend: { kind: 'transformation', comparison: null } }));

    expect(result.backend_preservation).toBe('unknown');
    expect(result.publishable).toBe(false);
    expect(result.status).toBe('blocked');
    expect(result.blockers.join(' ')).toMatch(/nicht festgestellt/);
  });

  it('sperrt, wenn ein Formularziel verlorengeht', () => {
    const result = evaluatePublishGate(input({
      backend: {
        kind: 'transformation',
        comparison: {
          lostFormTargets: ['/kontakt-alt.php'],
          lostPaymentPaths: [], lostBookingPaths: [], lostApiEndpoints: [], lostConsentCategories: [],
        },
      },
    }));

    expect(result.backend_preservation).toBe('changed');
    expect(result.publishable).toBe(false);
    expect(result.blockers.join(' ')).toContain('/kontakt-alt.php');
  });

  it('lässt eine Transformation ohne Verlust durch', () => {
    const result = evaluatePublishGate(input({
      backend: {
        kind: 'transformation',
        comparison: {
          lostFormTargets: [], lostPaymentPaths: [], lostBookingPaths: [], lostApiEndpoints: [], lostConsentCategories: [],
        },
      },
    }));

    expect(result.backend_preservation).toBe('preserve_all');
    expect(result.publishable).toBe(true);
  });

  it('sperrt ohne Evidence-Snapshot', () => {
    const result = evaluatePublishGate(input({
      evidence: { snapshotWritten: false, custodyLinked: true },
    }));
    expect(result.evidence_complete).toBe(false);
    expect(result.publishable).toBe(false);
  });

  it('sperrt ohne fortgeschriebene Custody-Kette', () => {
    const result = evaluatePublishGate(input({
      evidence: { snapshotWritten: true, custodyLinked: false },
    }));
    expect(result.evidence_complete).toBe(false);
    expect(result.publishable).toBe(false);
  });
});

describe('Publish Gate — Policy', () => {
  it('sperrt bei schwerem DSGVO-Befund', () => {
    const result = evaluatePublishGate(input({
      findings: [finding({ code: 'gdpr.missing-impressum', severity: 'high', title: 'Impressum fehlt' })],
    }));

    expect(result.policy_compliant).toBe(false);
    expect(result.publishable).toBe(false);
    expect(result.blockers.join(' ')).toContain('gdpr.missing-impressum');
  });

  it('sperrt bei einem kritischen Befund auch außerhalb der Rechtsdimensionen', () => {
    const result = evaluatePublishGate(input({
      findings: [finding({ code: 'performance.blocking', dimension: 'performance', severity: 'critical', title: 'Rendering blockiert' })],
    }));

    expect(result.policy_compliant).toBe(false);
    expect(result.publishable).toBe(false);
  });

  it('sperrt nicht bei einem mittleren Befund, meldet ihn aber', () => {
    const result = evaluatePublishGate(input({
      findings: [finding({ code: 'gdpr.weak-consent-text', severity: 'medium', title: 'Einwilligungstext unklar' })],
    }));

    expect(result.policy_compliant).toBe(true);
    expect(result.publishable).toBe(true);
    expect(result.warnings.join(' ')).toContain('gdpr.weak-consent-text');
  });
});

describe('Publish Gate — G4/G6: Freigabe', () => {
  it('verlangt eine Freigabe, wenn eine DSFA indiziert ist', () => {
    const bp = synthesizeBlueprint(
      parseBrief('Zahnarztpraxis in Hamburg mit Terminbuchung.'),
      { model: null },
    );
    expect(bp.compliance.dpiaRequired).toBe(true);

    const result = evaluatePublishGate(input({ blueprint: bp }));
    expect(result.human_approval_required).toBe(true);
    expect(result.status).toBe('pending');
    expect(result.publishable).toBe(false);
  });

  it('akzeptiert eine Freigabe nur mit Person und Begründung', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarztpraxis in Hamburg mit Terminbuchung.'), { model: null });

    // Hash stimmt, aber Person und Begründung fehlen — das wäre ein
    // Override-Flag, kein Approval (G4).
    const flagOnly = evaluatePublishGate(input({
      blueprint: bp,
      approval: { grantedForArtifactSha256: HASH_A, grantedBy: null, reason: null },
    }));
    expect(flagOnly.publishable).toBe(false);

    const proper = evaluatePublishGate(input({
      blueprint: bp,
      approval: { grantedForArtifactSha256: HASH_A, grantedBy: 'user-1', reason: 'DSFA liegt vor.' },
    }));
    expect(proper.human_approval_required).toBe(false);
    expect(proper.publishable).toBe(true);
  });

  it('lässt eine Freigabe mit dem Artefakt verfallen (G6)', () => {
    const bp = synthesizeBlueprint(parseBrief('Zahnarztpraxis in Hamburg mit Terminbuchung.'), { model: null });

    const result = evaluatePublishGate(input({
      blueprint: bp,
      artifactSha256: HASH_B,
      approval: { grantedForArtifactSha256: HASH_A, grantedBy: 'user-1', reason: 'DSFA liegt vor.' },
    }));

    expect(result.publishable).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/früheren Stand/);
  });

  it('verlangt eine Freigabe bei schwerem Barrierefreiheits-Befund, sperrt aber nicht dauerhaft', () => {
    const withFinding = input({
      findings: [finding({ code: 'accessibility.contrast', dimension: 'accessibility', severity: 'high', title: 'Kontrast zu gering' })],
    });

    expect(evaluatePublishGate(withFinding).status).toBe('pending');
    expect(evaluatePublishGate({
      ...withFinding,
      approval: { grantedForArtifactSha256: HASH_A, grantedBy: 'user-1', reason: 'Kontrast wird nachgezogen.' },
    }).publishable).toBe(true);
  });
});

describe('Publish Gate — Ableitungsregel wörtlich', () => {
  it('publishable ist genau die Konjunktion der fünf Bedingungen', () => {
    for (const variant of [
      input(),
      input({ evidence: { snapshotWritten: false, custodyLinked: true } }),
      input({ backend: { kind: 'transformation', comparison: null } }),
      input({ findings: [finding({ severity: 'critical' })] }),
      input({ blueprint: synthesizeBlueprint(parseBrief('Arztpraxis in Kiel mit Terminbuchung.'), { model: null }) }),
    ]) {
      const r = evaluatePublishGate(variant);
      expect(r.publishable).toBe(
        r.status === 'passed' &&
        r.evidence_complete === true &&
        r.backend_preservation === 'preserve_all' &&
        r.policy_compliant === true &&
        r.human_approval_required === false,
      );
    }
  });

  it('ist deterministisch', () => {
    const a = evaluatePublishGate(input());
    const b = evaluatePublishGate(input());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('Publish Gate am echten Bauergebnis', () => {
  it('lässt eine frisch gebaute Site mit vollständigem Nachweis durch', async () => {
    const built = await buildSiteFromPrompt('Website für eine Agentur in Köln.', { model: null });

    const result = evaluatePublishGate(input({
      blueprint: built.blueprint,
      findings: built.findings,
    }));

    expect({ status: result.status, blockers: result.blockers })
      .toEqual({ status: 'passed', blockers: [] });
  });
});
