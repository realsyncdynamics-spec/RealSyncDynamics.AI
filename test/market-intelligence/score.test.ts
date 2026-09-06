/**
 * Market Intelligence — Scoring und Trennschärfe.
 *
 * Zwei Dinge werden hier festgehalten:
 *
 * 1. **Die Gewichte sind versionsrelevant.** Sie bestimmen, in welcher
 *    Reihenfolge der Eigentümer Lücken abarbeitet. Wer sie ändert, ändert die
 *    Vergleichbarkeit jeder bisherigen Priorisierung — dieser Test macht das
 *    zu einer bewussten Entscheidung statt zu einem Nebeneffekt. Gleiche Regel
 *    wie bei den gdpr-audit-Scoring-Gewichten (CLAUDE.md §5).
 *
 * 2. **Die Diagnose muss die Entartung tatsächlich melden.** Der Nachweis
 *    läuft gegen die real gemessene Verteilung vom 2026-09-06 — nicht gegen
 *    ein ausgedachtes Beispiel. Wenn `assessDiscrimination` diese Verteilung
 *    für „informativ" hielte, wäre die Kachel im Cockpit wertlos.
 */

import { describe, it, expect } from 'vitest';
import {
  scoreGap, scoreCorpus, buildCorpusStats,
  assessDiscrimination, assessScannerFields,
  SCORE_WEIGHTS, REVENUE_WEIGHT, FEASIBILITY_WEIGHT, FRESHNESS_HALFLIFE_DAYS,
  type ScorableGap,
} from '../../src/core/market-intelligence/score';

function gap(overrides: Partial<ScorableGap> = {}): ScorableGap {
  return {
    id: 'g1',
    industry: 'Legal',
    job_category: 'Rechtsanwalt / Kanzleimanager',
    urgency_score: 9,
    revenue_potential: 'high',
    build_complexity: 'medium',
    scanned_at: '2026-09-06T06:00:00.000Z',
    ...overrides,
  };
}

describe('Gewichte (versionsrelevant — Änderung ist eine Entscheidung)', () => {
  it('hat die festgelegten Gewichte', () => {
    expect(SCORE_WEIGHTS).toEqual({
      corroboration: 0.25,
      demand: 0.25,
      revenue: 0.20,
      feasibility: 0.15,
      freshness: 0.15,
    });
  });

  it('summiert auf genau 1.0', () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it('hält die Ordinal-Stufen und die Halbwertszeit fest', () => {
    expect(REVENUE_WEIGHT).toEqual({ low: 0.25, medium: 0.50, high: 0.80, very_high: 1.00 });
    expect(FEASIBILITY_WEIGHT).toEqual({ low: 1.00, medium: 0.60, high: 0.30 });
    expect(FRESHNESS_HALFLIFE_DAYS).toBe(72);
  });

  it('gewichtet die korpus-abgeleitete Bestätigung mindestens so stark wie jede Modell-Selbstbewertung', () => {
    // Der ganze Sinn des Moduls: Was gemessen ist, wiegt schwerer als was
    // behauptet ist. Kippt dieses Verhältnis, ist die Rangfolge wieder
    // Scheingenauigkeit.
    expect(SCORE_WEIGHTS.corroboration).toBeGreaterThanOrEqual(SCORE_WEIGHTS.revenue);
    expect(SCORE_WEIGHTS.corroboration).toBeGreaterThanOrEqual(SCORE_WEIGHTS.feasibility);
  });
});

describe('buildCorpusStats', () => {
  it('zählt Bestätigung als verschiedene Scan-Tage, nicht als Zeilen', () => {
    // Zwei Zeilen aus demselben Lauf sind eine Mehrfachausgabe, kein zweiter Beleg.
    const stats = buildCorpusStats([
      gap({ id: 'a', scanned_at: '2026-09-01T06:00:00Z' }),
      gap({ id: 'b', scanned_at: '2026-09-01T06:00:30Z' }),
    ]);
    expect(stats.corroborationByJobCategory.get('rechtsanwalt / kanzleimanager')).toBe(1);
  });

  it('zählt verschiedene Tage als eigenständige Bestätigungen', () => {
    const stats = buildCorpusStats([
      gap({ id: 'a', scanned_at: '2026-09-01T06:00:00Z' }),
      gap({ id: 'b', scanned_at: '2026-09-13T06:00:00Z' }),
      gap({ id: 'c', scanned_at: '2026-09-25T06:00:00Z' }),
    ]);
    expect(stats.corroborationByJobCategory.get('rechtsanwalt / kanzleimanager')).toBe(3);
    expect(stats.maxCorroboration).toBe(3);
  });

  it('meldet branchenübergreifende Kategorien — im Live-Muster keine', () => {
    // Rollentitel sind branchengebunden; das ist der gemessene Normalfall.
    const stats = buildCorpusStats([
      gap({ id: 'a', industry: 'Legal', job_category: 'Rechtsanwalt' }),
      gap({ id: 'b', industry: 'Behörden', job_category: 'Sachbearbeiter Bauamt' }),
    ]);
    expect(stats.crossIndustryJobCategories).toEqual([]);
  });

  it('erkennt eine Kategorie, die doch in zwei Branchen auftaucht', () => {
    const stats = buildCorpusStats([
      gap({ id: 'a', industry: 'Legal', job_category: 'Compliance Officer' }),
      gap({ id: 'b', industry: 'FinTech', job_category: 'Compliance Officer' }),
    ]);
    expect(stats.crossIndustryJobCategories).toEqual(['compliance officer']);
  });

  it('behandelt Groß-/Kleinschreibung und Randleerzeichen als denselben Schlüssel', () => {
    const stats = buildCorpusStats([
      gap({ id: 'a', job_category: 'HR-Manager', scanned_at: '2026-09-01T06:00:00Z' }),
      gap({ id: 'b', job_category: '  hr-manager ', scanned_at: '2026-09-13T06:00:00Z' }),
    ]);
    expect(stats.corroborationByJobCategory.get('hr-manager')).toBe(2);
  });
});

describe('scoreGap', () => {
  it('ist deterministisch — gleiche Eingabe, gleiche Ausgabe', () => {
    const corpus = [gap({ id: 'a' }), gap({ id: 'b', job_category: 'Andere' })];
    const stats = buildCorpusStats(corpus);
    expect(scoreGap(corpus[0], stats, 10)).toEqual(scoreGap(corpus[0], stats, 10));
  });

  it('vergibt die volle Punktzahl für den bestmöglichen Eintrag', () => {
    const corpus = [
      gap({ id: 'top', urgency_score: 10, revenue_potential: 'very_high', build_complexity: 'low', scanned_at: '2026-09-01T06:00:00Z' }),
      gap({ id: 'top2', urgency_score: 10, revenue_potential: 'very_high', build_complexity: 'low', scanned_at: '2026-09-13T06:00:00Z' }),
      gap({ id: 'low', job_category: 'Selten', urgency_score: 7, scanned_at: '2026-09-01T06:00:00Z' }),
    ];
    const stats = buildCorpusStats(corpus);
    // Höchste Bestätigung, oberste Urgency-Stufe, bestes Revenue, billigster
    // Bau, taggleich gescannt → alle Komponenten auf 1.
    const result = scoreGap(corpus[0], stats, 0);
    expect(result.score).toBe(100);
    expect(result.corroborationDays).toBe(2);
  });

  it('spreizt die gestauchte Urgency-Skala über die beobachteten Stufen', () => {
    // Live vergibt der Scanner nur 7/8/9/10. Absolut wäre 8 → 0.8; auf der
    // Leiter ist 8 die zweite von vier Stufen → 1/3.
    const corpus = [7, 8, 9, 10].map((u, i) =>
      gap({ id: `g${i}`, urgency_score: u, job_category: `Job ${i}` }));
    const stats = buildCorpusStats(corpus);
    expect(stats.urgencyLadder).toEqual([7, 8, 9, 10]);
    expect(scoreGap(corpus[1], stats, 0).components.demand).toBeCloseTo(1 / 3, 6);
    expect(scoreGap(corpus[0], stats, 0).components.demand).toBe(0);
    expect(scoreGap(corpus[3], stats, 0).components.demand).toBe(1);
  });

  it('halbiert die Frische nach genau einer Halbwertszeit', () => {
    const stats = buildCorpusStats([gap()]);
    expect(scoreGap(gap(), stats, FRESHNESS_HALFLIFE_DAYS).components.freshness).toBeCloseTo(0.5, 6);
    expect(scoreGap(gap(), stats, 0).components.freshness).toBe(1);
  });

  it('bewertet einen unbekannten Urgency-Wert zwischen seinen Nachbarn statt auf null', () => {
    // Schutz gegen eine stille Scanner-Änderung: Ein neuer Wert darf den
    // Eintrag nicht ohne Vorwarnung ans Listenende schieben.
    const corpus = [7, 9].map((u, i) => gap({ id: `g${i}`, urgency_score: u, job_category: `Job ${i}` }));
    const stats = buildCorpusStats(corpus);
    const unknown = scoreGap(gap({ urgency_score: 8, job_category: 'Job 0' }), stats, 0);
    expect(unknown.components.demand).toBeGreaterThan(0);
    expect(unknown.components.demand).toBeLessThanOrEqual(1);
  });

  it('bevorzugt bei sonst gleichen Werten die mehrfach bestätigte Lücke', () => {
    const corpus = [
      gap({ id: 'oft', job_category: 'Oft', scanned_at: '2026-09-01T06:00:00Z' }),
      gap({ id: 'oft2', job_category: 'Oft', scanned_at: '2026-09-13T06:00:00Z' }),
      gap({ id: 'einmal', job_category: 'Einmal', scanned_at: '2026-09-01T06:00:00Z' }),
    ];
    const ranked = scoreCorpus(corpus, () => 0);
    expect(ranked[0].id).toMatch(/^oft/);
    expect(ranked[ranked.length - 1].id).toBe('einmal');
  });
});

describe('scoreCorpus', () => {
  it('sortiert absteigend und bricht Gleichstand stabil über die id', () => {
    const corpus = [
      gap({ id: 'b', job_category: 'X' }),
      gap({ id: 'a', job_category: 'X' }),
    ];
    const ranked = scoreCorpus(corpus, () => 0);
    expect(ranked.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('kommt mit leerem Bestand zurecht', () => {
    expect(scoreCorpus([], () => 0)).toEqual([]);
  });

  it('trennt tatsächlich — der Live-Bestand ergibt mehr als eine Punktzahl', () => {
    // Der eigentliche Zweck: Auf realistisch gestauchten Eingaben (alle
    // urgency 8/9, alle revenue high, alle build medium) muss die Bewertung
    // trotzdem eine Rangfolge erzeugen. Täte sie es nicht, wäre das Cockpit
    // nur eine andere Ansicht derselben undifferenzierten Liste.
    const corpus: ScorableGap[] = [
      gap({ id: '1', job_category: 'Sachbearbeiter Bauamt', scanned_at: '2026-09-01T06:00:00Z' }),
      gap({ id: '2', job_category: 'Sachbearbeiter Bauamt', scanned_at: '2026-09-13T06:00:00Z' }),
      gap({ id: '3', job_category: 'Sachbearbeiter Bauamt', scanned_at: '2026-09-25T06:00:00Z' }),
      gap({ id: '4', job_category: 'Pflegedienstleitung', urgency_score: 8, scanned_at: '2026-08-01T06:00:00Z' }),
      gap({ id: '5', job_category: 'Einzelfall', urgency_score: 8, scanned_at: '2026-06-01T06:00:00Z' }),
    ];
    const ranked = scoreCorpus(corpus, (g) =>
      (Date.parse('2026-09-26T06:00:00Z') - Date.parse(g.scanned_at)) / 86_400_000);
    const distinct = new Set(ranked.map((r) => r.score));
    expect(distinct.size).toBeGreaterThan(1);
    expect(ranked[0].score).toBeGreaterThan(ranked[ranked.length - 1].score);
  });
});

describe('assessDiscrimination', () => {
  it('sieht bei der real gemessenen Urgency nur ~2 effektive Stufen — Urteil „schwach"', () => {
    // Live-Stand 2026-09-06: 89× 9, 36× 8, 2× 7, 2× 10.
    // Der häufigste Wert deckt nur 69 %, eine Schwelle auf den Spitzenanteil
    // würde das Feld durchwinken. Effektiv sind es 2,1 Stufen für 129
    // Einträge — die beiden Ausreißer mit je zwei Zeilen trennen nichts.
    const values = [
      ...Array<number>(89).fill(9),
      ...Array<number>(36).fill(8),
      ...Array<number>(2).fill(7),
      ...Array<number>(2).fill(10),
    ];
    const report = assessDiscrimination('urgency_score', values);
    expect(report.total).toBe(129);
    expect(report.distinctValues).toBe(4);
    expect(report.topValue).toBe('9');
    expect(report.topShare).toBeCloseTo(0.69, 2);
    expect(report.effectiveValues).toBeCloseTo(2.1, 1);
    expect(report.verdict).toBe('weak');
  });

  it('meldet die real gemessene build_complexity als entartet', () => {
    // 124× medium, 4× low, 1× high → effektiv 1,2 Werte.
    const values = [
      ...Array<string>(124).fill('medium'),
      ...Array<string>(4).fill('low'),
      'high',
    ];
    const report = assessDiscrimination('build_complexity', values);
    expect(report.topShare).toBeGreaterThan(0.95);
    expect(report.effectiveValues).toBeLessThan(1.5);
    expect(report.verdict).toBe('degenerate');
  });

  it('meldet das real gemessene revenue_potential als entartet', () => {
    // 117× high, 7× medium, 5× very_high → effektiv ~1,45 Werte.
    const values = [
      ...Array<string>(117).fill('high'),
      ...Array<string>(7).fill('medium'),
      ...Array<string>(5).fill('very_high'),
    ];
    const report = assessDiscrimination('revenue_potential', values);
    expect(report.effectiveValues).toBeLessThan(1.5);
    expect(report.verdict).toBe('degenerate');
  });

  it('hält eine echte Gleichverteilung für informativ', () => {
    const report = assessDiscrimination('f', ['a', 'b', 'c', 'd']);
    expect(report.verdict).toBe('informative');
    expect(report.normalizedEntropy).toBe(1);
    expect(report.distinctValues).toBe(4);
  });

  it('erkennt einen einzigen Wert als entartet, Entropie 0', () => {
    const report = assessDiscrimination('f', ['x', 'x', 'x']);
    expect(report.verdict).toBe('degenerate');
    expect(report.normalizedEntropy).toBe(0);
    expect(report.distinctValues).toBe(1);
  });

  it('stuft eine leichte Schieflage als schwach ein', () => {
    // 7 von 10 auf einem Wert → zwischen WEAK (0.60) und DEGENERATE (0.80).
    const report = assessDiscrimination('f', [
      ...Array<string>(7).fill('a'), 'b', 'c', 'd',
    ]);
    expect(report.verdict).toBe('weak');
  });

  it('bleibt bei leerer Eingabe definiert', () => {
    const report = assessDiscrimination('f', []);
    expect(report.total).toBe(0);
    expect(report.verdict).toBe('degenerate');
    expect(report.topValue).toBeNull();
  });
});

describe('assessScannerFields', () => {
  it('prüft genau die drei vom Modell selbst vergebenen Kennzahlen', () => {
    const reports = assessScannerFields([gap(), gap({ id: 'b' })]);
    expect(reports.map((r) => r.field)).toEqual([
      'urgency_score', 'revenue_potential', 'build_complexity',
    ]);
    // Zwei identische Einträge → alle drei Felder entartet.
    expect(reports.every((r) => r.verdict === 'degenerate')).toBe(true);
  });
});
