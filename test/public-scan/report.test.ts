/**
 * Kundenbericht des öffentlichen Scans.
 *
 * Zwei Dinge werden hier festgenagelt, nicht nur geprüft:
 *
 *  1. **Die Sprachregel.** Der Bericht entsteht ohne Mandat und ohne
 *     Kenntnis der Verarbeitungsvorgänge. Er darf keine Konformität
 *     zusichern. Ein Satz wie „Website ist DSGVO-konform“ wäre eine
 *     Rechtsaussage, die wir nicht treffen dürfen — deshalb steht sie hier
 *     als Test und nicht als Kommentar.
 *  2. **Die Vollständigkeit der Abbildung.** Jede der acht Prüfdimensionen
 *     muss in genau einer Kundenkategorie landen. Sonst verschwindet ein
 *     Befund lautlos aus dem Bericht.
 */
import { describe, expect, it } from 'vitest';
import type { Dimension, RuntimeFinding } from '../../packages/siteos-core/src/index';
import {
  CATEGORY_DIMENSIONS,
  CATEGORY_LABELS,
  PREVIEW_FINDING_LIMIT,
  PUBLIC_SCAN_DISCLAIMER,
  VERDICT_TEXT,
  buildPublicScanReport,
  categoryOf,
  verdictFor,
  type PublicScanCategoryId,
} from '../../supabase/functions/_shared/public-scan/report';
import type { PublicScanSignals } from '../../supabase/functions/_shared/public-scan/detectors';

const ALL_DIMENSIONS: Dimension[] = [
  'gdpr', 'eu-ai-act', 'tdddg', 'accessibility', 'security', 'performance', 'seo', 'content',
];

const leereSignale: PublicScanSignals = {
  technologies: [],
  aiTools: [],
  chatWidgets: [],
  hasConsentManager: false,
  externalFontHosts: [],
  hasAiDisclosure: false,
  formCount: 0,
  hasViewportMeta: true,
  hasStructuredData: true,
  headingLevels: [1, 2],
};

function befund(overrides: Partial<RuntimeFinding> & { dimension: Dimension }): RuntimeFinding {
  return {
    code: 'test.code',
    severity: 'medium',
    title: 'Testbefund',
    reference: 'Test',
    remediation: 'Test',
    locator: 'https://firma.de',
    ...overrides,
  };
}

function bericht(findings: RuntimeFinding[], signals: PublicScanSignals = leereSignale, htmlLength = 50_000) {
  return buildPublicScanReport({
    url: 'https://firma.de',
    domain: 'firma.de',
    scannedAt: '2026-08-23T10:00:00.000Z',
    httpStatus: 200,
    htmlLength,
    findings,
    signals,
  });
}

describe('Abbildung Dimension → Kategorie', () => {
  it('ordnet jede der acht Prüfdimensionen genau einer Kategorie zu', () => {
    const zugeordnet = Object.values(CATEGORY_DIMENSIONS).flat();
    for (const dimension of ALL_DIMENSIONS) {
      expect(zugeordnet.filter((d) => d === dimension)).toHaveLength(1);
    }
  });

  it('erfindet keine Dimension, die es in siteos-core nicht gibt', () => {
    for (const dimension of Object.values(CATEGORY_DIMENSIONS).flat()) {
      expect(ALL_DIMENSIONS).toContain(dimension);
    }
  });

  it('hat für jede Kategorie eine Beschriftung', () => {
    for (const id of Object.keys(CATEGORY_DIMENSIONS) as PublicScanCategoryId[]) {
      expect(CATEGORY_LABELS[id]).toBeTruthy();
    }
  });

  it('führt jede Dimension über categoryOf auf ihre Kategorie zurück', () => {
    expect(categoryOf('gdpr')).toBe('dsgvo');
    expect(categoryOf('tdddg')).toBe('dsgvo');
    expect(categoryOf('eu-ai-act')).toBe('eu_ai_act');
    expect(categoryOf('performance')).toBe('ux');
    expect(categoryOf('content')).toBe('ux');
  });
});

describe('Sprachregel — keine Zusicherung von Konformität', () => {
  const verboten = /konform|rechtssicher|erfüllt die (?:DSGVO|Anforderungen)|compliant|garantiert/i;

  it('verwendet in keiner Urteilsstufe eine Konformitätsaussage', () => {
    for (const text of Object.values(VERDICT_TEXT)) {
      expect(text).not.toMatch(verboten);
    }
  });

  it('formuliert das beste Ergebnis als Beobachtung, nicht als Freispruch', () => {
    expect(VERDICT_TEXT.no_obvious_issues).toBe('Keine offensichtlichen Probleme erkannt');
  });

  it('enthält im Haftungshinweis den Verweis auf fehlende Rechtsberatung', () => {
    expect(PUBLIC_SCAN_DISCLAIMER).toMatch(/keine Rechtsberatung/i);
    expect(PUBLIC_SCAN_DISCLAIMER).toMatch(/keine Aussage über die/i);
  });

  it('trägt den Haftungshinweis in jeden Bericht — auch in einen makellosen', () => {
    const r = bericht([]);
    expect(r.overallScore).toBe(100);
    expect(r.disclaimer).toBe(PUBLIC_SCAN_DISCLAIMER);
    for (const kategorie of r.categories) {
      expect(kategorie.verdictText).not.toMatch(verboten);
    }
  });
});

describe('verdictFor', () => {
  it('stuft eine befundfreie Kategorie als unauffällig ein', () => {
    expect(verdictFor(100, 0)).toBe('no_obvious_issues');
  });

  it('lässt einen schweren Befund nicht im guten Mittelwert untergehen', () => {
    // Genau der Fall, den ein reiner Schwellenwert verfehlen würde: hoher
    // Score, aber ein kritischer Einzelbefund.
    expect(verdictFor(95, 1)).toBe('potential_risks');
    expect(verdictFor(95, 0)).toBe('no_obvious_issues');
  });

  it('stuft ohne schweren Befund nach Score ab', () => {
    expect(verdictFor(80, 0)).toBe('minor_potential');
    expect(verdictFor(60, 0)).toBe('potential_risks');
    expect(verdictFor(30, 0)).toBe('significant_risks');
  });
});

describe('Befundzählung und Vorschau', () => {
  it('teilt in kritisch, mittel und Optimierungsmöglichkeit', () => {
    const r = bericht([
      befund({ dimension: 'security', severity: 'critical' }),
      befund({ dimension: 'gdpr', severity: 'high' }),
      befund({ dimension: 'seo', severity: 'medium' }),
      befund({ dimension: 'seo', severity: 'low' }),
      befund({ dimension: 'eu-ai-act', severity: 'info' }),
    ]);

    expect(r.counts.critical).toBe(2); // critical + high
    expect(r.counts.medium).toBe(1);
    expect(r.counts.opportunity).toBe(2); // low + info
    expect(r.counts.total).toBe(5);
  });

  it('zeigt die schwersten Befunde zuerst', () => {
    const r = bericht([
      befund({ dimension: 'seo', severity: 'low', title: 'leicht' }),
      befund({ dimension: 'security', severity: 'critical', title: 'schwer' }),
      befund({ dimension: 'gdpr', severity: 'medium', title: 'mittel' }),
    ]);

    expect(r.preview.map((f) => f.title)).toEqual(['schwer', 'mittel', 'leicht']);
  });

  it('begrenzt die Vorschau und weist den Rest als gesperrt aus', () => {
    const viele = Array.from({ length: PREVIEW_FINDING_LIMIT + 4 }, (_, i) =>
      befund({ dimension: 'seo', severity: 'medium', title: `Befund ${i}` }),
    );
    const r = bericht(viele);

    expect(r.preview).toHaveLength(PREVIEW_FINDING_LIMIT);
    expect(r.lockedCount).toBe(4);
  });

  it('nimmt reine Hinweise nicht in die Vorschau auf', () => {
    // `info` ist ein Zustandshinweis ohne Handlungsbedarf. In einer Liste
    // mit der Überschrift „gefundene Probleme“ hat er nichts zu suchen.
    const r = bericht([befund({ dimension: 'eu-ai-act', severity: 'info' })]);
    expect(r.preview).toHaveLength(0);
    expect(r.lockedCount).toBe(0);
  });
});

describe('Kategorien im Bericht', () => {
  it('liefert alle sechs Kategorien, auch ohne Befund', () => {
    const r = bericht([]);
    expect(r.categories).toHaveLength(6);
    expect(r.categories.map((c) => c.id)).toEqual([
      'dsgvo', 'eu_ai_act', 'seo', 'accessibility', 'security', 'ux',
    ]);
  });

  it('senkt den DSGVO-Score, wenn ein TDDDG-Befund vorliegt', () => {
    // Beide Regelwerke zahlen auf dieselbe Kundenkategorie ein.
    const r = bericht([befund({ dimension: 'tdddg', severity: 'critical' })]);
    const dsgvo = r.categories.find((c) => c.id === 'dsgvo')!;
    expect(dsgvo.score).toBeLessThan(100);
    expect(dsgvo.criticalCount).toBe(1);
  });

  it('zählt info-Befunde nicht als Beanstandung der Kategorie', () => {
    const r = bericht([befund({ dimension: 'eu-ai-act', severity: 'info' })]);
    const aiAct = r.categories.find((c) => c.id === 'eu_ai_act')!;
    expect(aiAct.findingCount).toBe(0);
    expect(aiAct.criticalCount).toBe(0);
  });
});

describe('Abdeckung der Messung', () => {
  it('meldet eine Messung mit fast leerem HTML als eingeschränkt', () => {
    // Wichtig, weil ein leerer Abruf sonst als makelloses Ergebnis
    // erscheint — ein gutes Ergebnis aus einer nicht erfolgten Messung.
    const r = bericht([], leereSignale, 200);
    expect(r.coverage).toBe('limited');
  });

  it('meldet eine gewöhnliche Seite als vollständig gemessen', () => {
    expect(bericht([], leereSignale, 50_000).coverage).toBe('full');
  });
});

describe('Nachvollziehbarkeit', () => {
  it('führt die Version der Auswertung mit', () => {
    expect(bericht([]).engineVersion).toMatch(/^public-scan\/\d+\.\d+\.\d+$/);
  });

  it('gibt Zeitpunkt, Adresse und HTTP-Status unverändert weiter', () => {
    const r = bericht([]);
    expect(r.scannedAt).toBe('2026-08-23T10:00:00.000Z');
    expect(r.domain).toBe('firma.de');
    expect(r.httpStatus).toBe(200);
  });

  it('ist vollständig als JSON darstellbar — der Bericht wird gespeichert', () => {
    const r = bericht([befund({ dimension: 'gdpr', severity: 'high' })]);
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
});
