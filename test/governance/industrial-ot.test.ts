/**
 * Policy Pack "Industrial OT" — Matrix-Tests.
 *
 * Der Evaluator ist deterministisch (kein LLM im Bewertungspfad); diese
 * Tests fixieren die Indikator-Matrix OT-01..OT-10, die worst-of-Aggregation
 * und die Hash-Stabilität der kanonischen Serialisierung. Jede Änderung an
 * Prädikaten oder Gewichten ist versionsrelevant und muss hier sichtbar
 * werden.
 */

import { describe, expect, it } from 'vitest';
import {
  canonical,
  evaluateIndustrialOt,
  toEvidence,
  toMeasures,
  type IndustrialOtAnswers,
} from '@/src/core/governance/industrial-ot';

/** Neutrale Basis: nichts außer OT-10 (KI-Kompetenz) löst aus. */
function base(overrides: Partial<IndustrialOtAnswers> = {}): IndustrialOtAnswers {
  return {
    site: 'Werk Bruchsal',
    sector: 'hochtemperaturwolle',
    asset: 'Ofenlinie 3',
    intervention: 'advisory',
    safety_function: 'no',
    machinery_ce: 'no',
    critical_infra: 'none',
    worker_monitoring: 'none',
    human_interaction: false,
    generates_content: false,
    ...overrides,
  };
}

const ids = (a: Awaited<ReturnType<typeof evaluateIndustrialOt>>) => a.triggered.map((t) => t.id);

describe('Industrial OT — Indikator-Matrix', () => {
  it('Basis: nur OT-10 (Art. 4 KI-Kompetenz), Gesamtergebnis MINIMAL', async () => {
    const a = await evaluateIndustrialOt(base());
    expect(ids(a)).toEqual(['OT-10']);
    expect(a.outcome).toBe('MINIMAL');
  });

  it('OT-01: Sicherheitsfunktion + CE-Maschine → HIGH_RISK_CANDIDATE', async () => {
    const a = await evaluateIndustrialOt(base({ machinery_ce: 'yes', safety_function: 'yes' }));
    expect(ids(a)).toContain('OT-01');
    expect(a.outcome).toBe('HIGH_RISK_CANDIDATE');
  });

  it('OT-02: zusätzlich selbstlernend im Betrieb → OT-01 und OT-02 (Benannte Stelle)', async () => {
    const a = await evaluateIndustrialOt(
      base({ machinery_ce: 'yes', safety_function: 'yes', learning: 'self_evolving_online' }),
    );
    expect(ids(a)).toEqual(expect.arrayContaining(['OT-01', 'OT-02']));
    const ot02 = a.triggered.find((t) => t.id === 'OT-02');
    // MaschVO-Frist ist unverschoben: 20.01.2027.
    expect(ot02?.deadline).toBe('2027-01-20');
  });

  it('OT-02 löst bei ml_offline_update nicht aus', async () => {
    const a = await evaluateIndustrialOt(
      base({ machinery_ce: 'yes', safety_function: 'yes', learning: 'ml_offline_update' }),
    );
    expect(ids(a)).not.toContain('OT-02');
  });

  it('OT-03: öffentliche Versorgung → KANDIDAT — werksintern (none) nicht', async () => {
    const publicGrid = await evaluateIndustrialOt(
      base({ critical_infra: 'strom', safety_function: 'yes' }),
    );
    expect(ids(publicGrid)).toContain('OT-03');

    // Werksinternes Energiemanagement ist keine kritische Infrastruktur
    // nach Anhang III Nr. 2 — der Wizard trennt das über critical_infra=none.
    const inPlant = await evaluateIndustrialOt(base({ safety_function: 'yes' }));
    expect(ids(inPlant)).not.toContain('OT-03');
  });

  it('OT-03 löst auch bei safety_function=unclear aus (konservativ)', async () => {
    const a = await evaluateIndustrialOt(
      base({ critical_infra: 'wasser', safety_function: 'unclear' }),
    );
    expect(ids(a)).toContain('OT-03');
    expect(ids(a)).toContain('OT-09');
  });

  it('OT-04: Beschäftigtenbewertung (performance und behaviour_safety)', async () => {
    for (const monitoring of ['performance', 'behaviour_safety'] as const) {
      const a = await evaluateIndustrialOt(base({ worker_monitoring: monitoring }));
      expect(ids(a)).toContain('OT-04');
      expect(a.outcome).toBe('HIGH_RISK_CANDIDATE');
    }
  });

  it('OT-05: Emotionserkennung → PROHIBITED_CHECK mit Eskalation, nie nur Kandidat', async () => {
    const a = await evaluateIndustrialOt(base({ worker_monitoring: 'emotion' }));
    const ot05 = a.triggered.find((t) => t.id === 'OT-05');
    expect(ot05?.outcome).toBe('PROHIBITED_CHECK');
    expect(ot05?.escalate).toBe(true);
    expect(a.outcome).toBe('PROHIBITED_CHECK');
  });

  it('worst-of: Verbotsindikator dominiert Hochrisiko-Indikatoren', async () => {
    const a = await evaluateIndustrialOt(
      base({ machinery_ce: 'yes', safety_function: 'yes', worker_monitoring: 'emotion' }),
    );
    expect(ids(a)).toEqual(expect.arrayContaining(['OT-01', 'OT-05']));
    expect(a.outcome).toBe('PROHIBITED_CHECK');
  });

  it('OT-06/OT-07: Transparenzpflichten nach Art. 50, seit 02.08.2026 anwendbar', async () => {
    const a = await evaluateIndustrialOt(
      base({ human_interaction: true, generates_content: true }),
    );
    expect(ids(a)).toEqual(expect.arrayContaining(['OT-06', 'OT-07']));
    expect(a.outcome).toBe('TRANSPARENCY');
    expect(a.triggered.find((t) => t.id === 'OT-06')?.deadline).toBe('2026-08-02');
  });

  it('OT-08: Regeleingriff ohne Safety/CE/Infra → dokumentierte Negativfeststellung, MINIMAL', async () => {
    const a = await evaluateIndustrialOt(base({ intervention: 'closed_loop' }));
    expect(ids(a)).toEqual(expect.arrayContaining(['OT-08', 'OT-10']));
    expect(a.outcome).toBe('MINIMAL');
  });

  it('OT-09: Angabe "unclear" wird konservativ als Prüfauftrag eingeordnet', async () => {
    const a = await evaluateIndustrialOt(base({ machinery_ce: 'unclear' }));
    expect(ids(a)).toContain('OT-09');
    expect(a.outcome).toBe('HIGH_RISK_CANDIDATE');
    expect(a.open_questions).toBeGreaterThan(0);
  });
});

describe('Industrial OT — Hash und Reproduzierbarkeit', () => {
  it('gleiche Antworten → gleicher SHA-256, unabhängig von der Schlüssel-Reihenfolge', () => {
    expect(canonical({ b: 1, a: { d: 2, c: 3 } })).toBe(canonical({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('fehlendes und explizit undefiniertes optionales Feld hashen gleich', async () => {
    const withoutLearning = await evaluateIndustrialOt(base());
    const withUndefined = await evaluateIndustrialOt(base({ learning: undefined }));
    expect(withoutLearning.answers_sha256).toBe(withUndefined.answers_sha256);
    expect(withoutLearning.answers_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('unterschiedliche Antworten → unterschiedlicher Hash', async () => {
    const a = await evaluateIndustrialOt(base());
    const b = await evaluateIndustrialOt(base({ safety_function: 'yes' }));
    expect(a.answers_sha256).not.toBe(b.answers_sha256);
  });
});

describe('Industrial OT — Ableitungen', () => {
  it('toMeasures flacht Maßnahmen mit Indikator-Bezug und Frist ab', async () => {
    const a = await evaluateIndustrialOt(
      base({ machinery_ce: 'yes', safety_function: 'yes', learning: 'self_evolving_online' }),
    );
    const measures = toMeasures(a);
    expect(measures.length).toBeGreaterThan(0);
    for (const m of measures) {
      expect(m.status).toBe('open');
      expect(m.indicator_id).toMatch(/^OT-\d\d$/);
    }
    expect(measures.some((m) => m.indicator_id === 'OT-02' && m.due_date === '2027-01-20')).toBe(true);
  });

  it('toEvidence passt auf ai_evidence_events und mappt das Risiko-Level', async () => {
    const prohibited = toEvidence(await evaluateIndustrialOt(base({ worker_monitoring: 'emotion' })));
    expect(prohibited.event_type).toBe('ai_act_classification');
    expect(prohibited.risk_level).toBe('critical');

    const minimal = toEvidence(await evaluateIndustrialOt(base()));
    expect(minimal.risk_level).toBe('info');
    expect(minimal.evidence.answers_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
