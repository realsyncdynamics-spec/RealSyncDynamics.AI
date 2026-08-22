import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  APPROVAL_SEVERITIES,
  BLOCKING_SEVERITIES,
  EVALUATION_MAX_AGE_MS,
  derivePublishable,
  evaluatePublishGate,
  evaluationCoversArtifact,
  evaluationIsFresh,
  failClosedContract,
  mayPublish,
  sealContract,
  type PublishEvaluationInput,
  type PublishGateContract,
  type RuntimeFinding,
  type Severity,
} from '../../packages/siteos-core/src/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Der Publish Gate ist die schärfste Einzelfestlegung der Zielarchitektur
 * (docs/architecture/target-architecture.md §7). Diese Datei prüft nicht,
 * ob der Code läuft, sondern ob die Regeln G1–G6 gelten — und zwar so, dass
 * ein Aufweichen sichtbar fehlschlägt.
 */

const ARTIFACT = 'a'.repeat(64);
const NOW = Date.parse('2026-08-22T12:00:00.000Z');

function finding(severity: Severity, code = `test.${severity}`): RuntimeFinding {
  return {
    code,
    dimension: 'gdpr',
    severity,
    title: `Befund ${severity}`,
    reference: 'DSGVO Art. 5',
    remediation: 'beheben',
    locator: null,
  };
}

function input(overrides: Partial<PublishEvaluationInput> = {}): PublishEvaluationInput {
  return {
    evaluation_id: 'eval-1',
    evaluated_at: '2026-08-22T11:30:00.000Z',
    artifact_sha256: ARTIFACT,
    findings: [],
    scan_present: true,
    evidence_complete: true,
    backend_preservation: 'preserve_all',
    human_approval_granted: false,
    ...overrides,
  };
}

describe('Ableitungsregel — die einzige Stelle, an der sie steht', () => {
  const base: Omit<PublishGateContract, 'publishable'> = {
    status: 'passed',
    evidence_complete: true,
    backend_preservation: 'preserve_all',
    policy_compliant: true,
    human_approval_required: false,
    evaluated_at: '2026-08-22T11:30:00.000Z',
    evaluation_id: 'eval-1',
    artifact_sha256: ARTIFACT,
    reasons: [],
  };

  it('lässt genau die Kombination aus §7 durch', () => {
    expect(derivePublishable(base)).toBe(true);
  });

  it('jede einzelne Abweichung verhindert die Veröffentlichung', () => {
    // Fünf Bedingungen, fünf Gegenproben. Fällt eine weg, muss dieser Test
    // fehlschlagen — sonst wäre die Regel stillschweigend gelockert.
    expect(derivePublishable({ ...base, status: 'blocked' })).toBe(false);
    expect(derivePublishable({ ...base, status: 'pending' })).toBe(false);
    expect(derivePublishable({ ...base, evidence_complete: false })).toBe(false);
    expect(derivePublishable({ ...base, backend_preservation: 'changed' })).toBe(false);
    expect(derivePublishable({ ...base, backend_preservation: 'unknown' })).toBe(false);
    expect(derivePublishable({ ...base, policy_compliant: false })).toBe(false);
    expect(derivePublishable({ ...base, human_approval_required: true })).toBe(false);
  });

  it('setzt publishable beim Versiegeln konsistent', () => {
    expect(sealContract(base).publishable).toBe(true);
    expect(sealContract({ ...base, policy_compliant: false }).publishable).toBe(false);
  });
});

describe('G3 — fail closed', () => {
  it('erklärt eine nicht zustande gekommene Auswertung für nicht veröffentlichbar', () => {
    const contract = failClosedContract(
      { code: 'evaluation_timeout', detail: 'Zeitüberschreitung' },
      { evaluation_id: 'eval-x', evaluated_at: '2026-08-22T11:30:00.000Z', artifact_sha256: ARTIFACT },
    );
    expect(contract.publishable).toBe(false);
    expect(contract.backend_preservation).toBe('unknown');
    expect(contract.reasons[0].code).toBe('evaluation_timeout');
  });

  it('unterscheidet „nicht geprüft" von „geprüft und durchgefallen"', () => {
    // Für die Veröffentlichung wirkt beides gleich, für den Prüfpfad nicht.
    const notEvaluated = failClosedContract(
      { code: 'evaluation_missing', detail: 'keine Antwort' },
      { evaluation_id: 'e', evaluated_at: '2026-08-22T11:30:00.000Z', artifact_sha256: ARTIFACT },
    );
    expect(notEvaluated.status).toBe('pending');

    const evaluated = evaluatePublishGate(input({ findings: [finding('critical')] }));
    expect(evaluated.status).toBe('blocked');
    expect(evaluated.publishable).toBe(false);
  });

  it('behandelt ein unlesbares Auswertungsdatum als nicht frisch', () => {
    const contract = sealContract({
      status: 'passed',
      evidence_complete: true,
      backend_preservation: 'preserve_all',
      policy_compliant: true,
      human_approval_required: false,
      evaluated_at: 'kein Datum',
      evaluation_id: 'e',
      artifact_sha256: ARTIFACT,
      reasons: [],
    });
    expect(evaluationIsFresh(contract, NOW)).toBe(false);
  });

  it('misstraut einer Auswertung aus der Zukunft', () => {
    const contract = sealContract({
      status: 'passed',
      evidence_complete: true,
      backend_preservation: 'preserve_all',
      policy_compliant: true,
      human_approval_required: false,
      evaluated_at: new Date(NOW + 60_000).toISOString(),
      evaluation_id: 'e',
      artifact_sha256: ARTIFACT,
      reasons: [],
    });
    expect(evaluationIsFresh(contract, NOW)).toBe(false);
  });
});

describe('G4 — kein Überschreiben', () => {
  it('bietet keinen Weg, publishable zu erzwingen', () => {
    // Geprüft am Quelltext, nicht an der Absicht: Ein Parameter wie `force`
    // oder `override` wäre genau das Flag ohne Person, das G4 verbietet.
    const source = readFileSync(join(ROOT, 'packages/siteos-core/src/publish/contract.ts'), 'utf-8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).not.toMatch(/\bforce\b/i);
    expect(code).not.toMatch(/\boverride\b/i);
    expect(code).not.toMatch(/\bbypass\b/i);
  });

  it('macht die Ausnahme zur Freigabe, nicht zum Flag', () => {
    const withHigh = evaluatePublishGate(input({ findings: [finding('high')] }));
    expect(withHigh.human_approval_required).toBe(true);
    expect(withHigh.publishable).toBe(false);

    const approved = evaluatePublishGate(
      input({ findings: [finding('high')], human_approval_granted: true }),
    );
    expect(approved.human_approval_required).toBe(false);
    expect(approved.publishable).toBe(true);
  });

  it('lässt auch eine Freigabe kritische Befunde nicht überstimmen', () => {
    const approved = evaluatePublishGate(
      input({ findings: [finding('critical')], human_approval_granted: true }),
    );
    expect(approved.publishable).toBe(false);
    expect(approved.policy_compliant).toBe(false);
  });
});

describe('G6 — eine Evaluation gilt für genau ein Artefakt', () => {
  const contract = evaluatePublishGate(input());

  it('deckt das bewertete Artefakt ab', () => {
    expect(evaluationCoversArtifact(contract, ARTIFACT)).toBe(true);
  });

  it('deckt kein anderes Artefakt ab', () => {
    expect(evaluationCoversArtifact(contract, 'b'.repeat(64))).toBe(false);
  });

  it('deckt kein leeres Artefakt ab', () => {
    expect(evaluationCoversArtifact(contract, '')).toBe(false);
  });

  it('verhindert, dass eine alte Freigabe einen neuen Inhalt trägt', () => {
    // Der klassische Weg, ein Gate auszuhebeln: bewerten, dann austauschen.
    expect(contract.publishable).toBe(true);
    const verdict = mayPublish(contract, 'b'.repeat(64), NOW);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons.map((r) => r.code)).toContain('artifact_mismatch');
  });
});

describe('Abschliessende Prüfung vor der Veröffentlichung', () => {
  const good = evaluatePublishGate(input());

  it('lässt eine frische, passende, bestandene Bewertung durch', () => {
    expect(mayPublish(good, ARTIFACT, NOW).allowed).toBe(true);
  });

  it('lässt eine abgelaufene Bewertung nicht durch', () => {
    const later = NOW + EVALUATION_MAX_AGE_MS + 1000;
    const verdict = mayPublish(good, ARTIFACT, later);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons.map((r) => r.code)).toContain('evaluation_stale');
  });

  it('nennt jeden Grund, nicht nur den ersten', () => {
    const later = NOW + EVALUATION_MAX_AGE_MS + 1000;
    const verdict = mayPublish(good, 'c'.repeat(64), later);
    const codes = verdict.reasons.map((r) => r.code);
    expect(codes).toContain('artifact_mismatch');
    expect(codes).toContain('evaluation_stale');
  });

  it('begründet eine Ablehnung immer', () => {
    const blocked = evaluatePublishGate(input({ findings: [finding('critical')] }));
    const verdict = mayPublish(blocked, ARTIFACT, NOW);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reasons.length).toBeGreaterThan(0);
  });
});

describe('Bewertung aus den Eingaben', () => {
  it('ist rein — dieselben Eingaben ergeben denselben Vertrag', () => {
    // Ohne Reproduzierbarkeit belegt eine Evaluation nichts.
    expect(evaluatePublishGate(input())).toEqual(evaluatePublishGate(input()));
  });

  it('wertet fehlenden Scan nicht als Konformität', () => {
    // „Keine Befunde" ohne Prüfung ist die Abwesenheit einer Prüfung, nicht
    // ihr Ergebnis.
    const contract = evaluatePublishGate(input({ scan_present: false, findings: [] }));
    expect(contract.policy_compliant).toBe(false);
    expect(contract.status).toBe('pending');
    expect(contract.reasons.map((r) => r.code)).toContain('scan_missing');
  });

  it('blockiert bei unvollständiger Nachweiskette', () => {
    const contract = evaluatePublishGate(input({ evidence_complete: false }));
    expect(contract.publishable).toBe(false);
    expect(contract.reasons.map((r) => r.code)).toContain('evidence_incomplete');
  });

  it('behandelt Backend-Erhaltung getrennt von der Richtlinienkonformität', () => {
    // Eine Änderung kann optisch und rechtlich sauber sein und trotzdem ein
    // Formularziel verlieren.
    const changed = evaluatePublishGate(input({ backend_preservation: 'changed' }));
    expect(changed.policy_compliant).toBe(true);
    expect(changed.publishable).toBe(false);
    expect(changed.reasons.map((r) => r.code)).toContain('backend_changed');
  });

  it('blockiert bei unbekannter Backend-Erhaltung', () => {
    const unknown = evaluatePublishGate(input({ backend_preservation: 'unknown' }));
    expect(unknown.publishable).toBe(false);
    expect(unknown.reasons.map((r) => r.code)).toContain('backend_unknown');
  });

  it('lässt mittlere und niedrige Befunde durch', () => {
    const contract = evaluatePublishGate(
      input({ findings: [finding('medium'), finding('low'), finding('info')] }),
    );
    expect(contract.publishable).toBe(true);
  });

  it('nennt die blockierenden Befunde beim Code', () => {
    const contract = evaluatePublishGate(
      input({ findings: [finding('critical', 'gdpr.missing-impressum')] }),
    );
    const reason = contract.reasons.find((r) => r.code === 'policy_violation');
    expect(reason?.detail).toContain('gdpr.missing-impressum');
  });
});

describe('Schwellen sind versionsrelevant', () => {
  it('blockiert genau bei kritischen Befunden', () => {
    expect([...BLOCKING_SEVERITIES]).toEqual(['critical']);
  });

  it('erzwingt eine Freigabe genau bei hohen Befunden', () => {
    expect([...APPROVAL_SEVERITIES]).toEqual(['high']);
  });

  it('überschneidet die beiden Mengen nicht', () => {
    // Ein Schweregrad, der zugleich blockiert und freigebbar wäre, hätte zwei
    // widersprüchliche Bedeutungen.
    for (const severity of BLOCKING_SEVERITIES) {
      expect(APPROVAL_SEVERITIES).not.toContain(severity);
    }
  });
});
