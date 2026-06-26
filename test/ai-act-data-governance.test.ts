import { describe, it, expect } from 'vitest';
import {
  DATASET_ROLE_LABEL,
  ART10_FACET_LABEL,
  assessArt10Completeness,
  type DatasetRole,
  type Art10Facet,
} from '../src/features/governance/aiActDataGovernanceApi';

/**
 * AI-Act Daten-Governance (Art. 10) — Heuristik- und Konstanten-Tests.
 *
 * Prüft die Art-10-Vollständigkeits-Bewertung (Quelle, Herkunft, Steward,
 * Rechtsgrundlage, Vorverarbeitung, Bias, Repräsentativität) und die
 * exportierten Label-Maps.
 */

const EMPTY = {
  source_description: null,
  origin_jurisdictions: [],
  data_steward: null,
  legal_basis: null,
  preprocessing_notes: null,
  bias_assessment: null,
  representativeness_note: null,
  contains_personal_data: false,
};

const FULL_NO_PII = {
  source_description: 'Öffentlicher Web-Crawl, EU-Server',
  origin_jurisdictions: ['DE', 'AT'],
  data_steward: 'Team Data',
  legal_basis: null,
  preprocessing_notes: 'Dedupliziert, normalisiert',
  bias_assessment: 'Geografische Verteilung geprüft',
  representativeness_note: 'Repräsentativ für DACH-Sprachraum',
  contains_personal_data: false,
};

describe('Art-10-Vollständigkeit', () => {
  it('leerer Datensatz: alle 6 nicht-PII-Facetten fehlen, Score 0', () => {
    const r = assessArt10Completeness(EMPTY);
    expect(r.complete).toBe(false);
    expect(r.score).toBe(0);
    // legal_basis ist ohne Personenbezug NICHT anwendbar → 6 statt 7 Facetten.
    expect(r.missing).toHaveLength(6);
    expect(r.missing).not.toContain<Art10Facet>('legal_basis');
  });

  it('vollständig ohne Personenbezug: complete, Score 100', () => {
    const r = assessArt10Completeness(FULL_NO_PII);
    expect(r.complete).toBe(true);
    expect(r.score).toBe(100);
    expect(r.missing).toHaveLength(0);
    expect(r.covered).toHaveLength(6);
  });

  it('Personenbezug ohne Rechtsgrundlage macht legal_basis zur fehlenden Pflicht', () => {
    const r = assessArt10Completeness({ ...FULL_NO_PII, contains_personal_data: true });
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual<Art10Facet[]>(['legal_basis']);
    // Jetzt 7 anwendbare Facetten, 6 erfüllt → 86 %.
    expect(r.score).toBe(86);
  });

  it('Personenbezug MIT Rechtsgrundlage ist wieder vollständig', () => {
    const r = assessArt10Completeness({
      ...FULL_NO_PII,
      contains_personal_data: true,
      legal_basis: 'Art. 6 Abs. 1 lit. f DSGVO',
    });
    expect(r.complete).toBe(true);
    expect(r.score).toBe(100);
  });

  it('leere/Whitespace-Strings zählen nicht als dokumentiert', () => {
    const r = assessArt10Completeness({ ...EMPTY, source_description: '   ' });
    expect(r.covered).not.toContain<Art10Facet>('source');
  });
});

describe('Label-Maps', () => {
  it('DATASET_ROLE_LABEL deckt genau die 5 Rollen ab', () => {
    const roles: DatasetRole[] = ['training', 'validation', 'testing', 'production_input', 'other'];
    expect(Object.keys(DATASET_ROLE_LABEL).sort()).toEqual([...roles].sort());
  });

  it('ART10_FACET_LABEL deckt genau die 7 Facetten ab', () => {
    const facets: Art10Facet[] = [
      'source', 'origin', 'data_steward', 'legal_basis',
      'preprocessing', 'bias', 'representativeness',
    ];
    expect(Object.keys(ART10_FACET_LABEL).sort()).toEqual([...facets].sort());
  });
});
