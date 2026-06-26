import { describe, it, expect } from 'vitest';
import {
  buildConformityDossier,
  renderDossierMarkdown,
  type DossierInput,
} from '../src/lib/ai-act/conformityDossier';

/**
 * Annex-IV-Konformitätsdossier — Assembler + Renderer.
 *
 * Prüft die 9 Annex-IV-Abschnitte, die Lücken-Erkennung und den
 * Vollständigkeits-Score.
 */

const MINIMAL: DossierInput = {
  system: { name: 'CV-Screening', riskLabel: 'Hoch' },
};

const RICH: DossierInput = {
  system: {
    name: 'CV-Screening',
    riskLabel: 'Hoch',
    provider: 'HR-AI GmbH',
    providerRole: 'Betreiber (Deployer)',
    model: 'HR-AI Suite v4.1',
    intendedPurpose: 'Vorauswahl von Bewerbungen',
    deploymentContext: 'Recruiting',
    affectedGroups: ['Bewerber:innen'],
  },
  datasets: [
    { name: 'Korpus 2024', role: 'training', containsPersonalData: true, legalBasis: 'Art. 6 f DSGVO', biasAssessment: 'geprüft' },
  ],
  evidence: [{ title: 'Klassifizierung', hash: 'sha256:abcd', ts: 'vor 2 Std.' }],
  obligations: [
    { label: 'Konformitätsbewertung', article: 'Art. 43', done: false },
    { label: 'Technische Doku', article: 'Art. 11', done: true },
  ],
  oversight: 'Human-Approval vor Ablehnung',
  harmonisedStandards: ['ISO/IEC 42001'],
  changeLog: ['v4.1 Modell-Update'],
  registryVersion: '2026.05.0',
};

describe('Annex-IV-Dossier-Struktur', () => {
  it('erzeugt genau 9 Annex-IV-Abschnitte in Reihenfolge', () => {
    const d = buildConformityDossier(MINIMAL);
    expect(d.sections).toHaveLength(9);
    expect(d.sections.map((s) => s.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('jeder Abschnitt referenziert seine Annex-IV-Nummer', () => {
    const d = buildConformityDossier(MINIMAL);
    for (const s of d.sections) expect(s.article).toMatch(/Annex IV/);
  });
});

describe('Lücken-Erkennung & Vollständigkeit', () => {
  it('Minimal-Input: viele Lücken, niedrige Vollständigkeit', () => {
    const d = buildConformityDossier(MINIMAL);
    const totalGaps = d.sections.reduce((n, s) => n + s.gaps.length, 0);
    expect(totalGaps).toBeGreaterThan(5);
    expect(d.completeness).toBeLessThan(50);
    // Abschnitt 1 muss die Zweckbestimmung als Lücke melden.
    expect(d.sections[0].gaps).toContain('Zweckbestimmung (intended purpose)');
  });

  it('reicher Input: Score steigt deutlich', () => {
    const minimal = buildConformityDossier(MINIMAL).completeness;
    const rich = buildConformityDossier(RICH).completeness;
    expect(rich).toBeGreaterThan(minimal);
    // Abschnitt 1 ist mit allen Feldern lückenlos.
    expect(buildConformityDossier(RICH).sections[0].gaps).toHaveLength(0);
  });

  it('personenbezogener Datensatz ohne Rechtsgrundlage erzeugt Art-10-Lücke', () => {
    const d = buildConformityDossier({
      ...RICH,
      datasets: [{ name: 'X', role: 'training', containsPersonalData: true, legalBasis: null, biasAssessment: 'ok' }],
    });
    const sec2 = d.sections.find((s) => s.num === 2)!;
    expect(sec2.gaps.some((g) => /Rechtsgrundlage/.test(g))).toBe(true);
  });

  it('Post-Market-Monitoring (Art. 72) ist immer eine offene Pflicht', () => {
    const d = buildConformityDossier(RICH);
    const sec9 = d.sections.find((s) => s.num === 9)!;
    expect(sec9.gaps.some((g) => /Art\. 72/.test(g))).toBe(true);
  });
});

describe('Markdown-Renderer', () => {
  it('rendert Titel, Vollständigkeit und alle Abschnitts-Überschriften', () => {
    const d = buildConformityDossier(RICH);
    const md = renderDossierMarkdown(d, '2026.05.0');
    expect(md).toContain('# Technische Dokumentation (Annex IV) — CV-Screening');
    expect(md).toContain(`**Vollständigkeit:** ${d.completeness}%`);
    expect(md).toContain('## 1. Allgemeine Beschreibung des KI-Systems');
    expect(md).toContain('## 9. Plan zur Beobachtung nach dem Inverkehrbringen');
    expect(md).toContain('2026.05.0');
  });
});
