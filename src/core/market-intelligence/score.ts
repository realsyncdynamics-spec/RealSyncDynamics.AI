/**
 * Market Intelligence — Opportunity-Bewertung und Trennschärfe-Diagnose.
 *
 * Zweck
 * -----
 * Der `market-scanner` (Edge Function, täglich 06:00 UTC) sammelt Markt-Lücken
 * und lässt das Modell dabei vier Kennzahlen selbst vergeben: `urgency_score`,
 * `revenue_potential`, `build_complexity` und `stripe_model`. Gemessen am
 * Live-Bestand vom 2026-09-06 (129 Zeilen) sind **alle vier nahezu konstant**:
 *
 *   urgency_score      89× 9 · 36× 8 · 2× 7 · 2× 10   → 97 % in zwei Werten
 *   revenue_potential  117× high · 7× medium · 5× very_high → 91 % ein Wert
 *   build_complexity   124× medium · 4× low · 1× high  → 96 % ein Wert
 *   stripe_model       124× subscription · 5× metered   → 96 % ein Wert
 *
 * Daraus folgt die Kernentscheidung dieses Moduls: **Eine Rangfolge, die sich
 * überwiegend auf die Selbstbewertung des Modells stützt, wäre vorgetäuschte
 * Genauigkeit.** Wenn 97 % aller Einträge „dringend 8–9" tragen, trennt diese
 * Zahl nichts. Deshalb trägt das korpus-abgeleitete Merkmal `corroboration`
 * das größte Einzelgewicht — es wird aus dem Bestand berechnet, nicht vom
 * Modell behauptet.
 *
 * Zur Wahl von `corroboration` (und was vorher nicht funktionierte)
 * ---------------------------------------------------------------
 * Der erste Entwurf gewichtete `reach`: die Wiederkehr einer Job-Kategorie
 * über **Branchen** hinweg. Gegen den Live-Bestand gemessen ist dieses Signal
 * **leer** — keine einzige Job-Kategorie kommt in mehr als einer Branche vor.
 * Das ist kein Datenfehler, sondern die Bedeutung des Feldes: Es enthält
 * branchengebundene Rollentitel („Sachbearbeiter Bauamt / Ordnungsamt" gibt es
 * nur in Behörden). Ein Token-Vergleich fand nur Allerweltswörter („manager"
 * in 5 Branchen), also Rauschen.
 *
 * Was stattdessen trägt: Wie viele **verschiedene Scan-Tage** dieselbe
 * Job-Kategorie unabhängig gefunden haben. Gemessen streut das 1–8 (62
 * Kategorien einmalig, 21 mehrfach), und jede Wiederholung stammt aus einem
 * eigenen Lauf, nicht aus einer Mehrfachausgabe desselben Laufs.
 *
 * **Ehrlich zur Deutung**: Wiederholte Wiederentdeckung kann zweierlei heißen —
 * ein hartnäckiges, immer wieder bestätigtes Problem, oder schlicht ein
 * Scanner, der sich wiederholt. Beides ist aus den Daten allein nicht zu
 * trennen. Deshalb führt `corroboration` die Gewichtung zwar an, aber nicht
 * beherrschend (0.25), und das Cockpit weist die Zahl als „unabhängig
 * bestätigt an N Tagen" aus, statt sie als Marktbreite auszugeben.
 *
 * Zusätzlich meldet `assessDiscrimination()` die Entartung ausdrücklich,
 * statt sie zu verdecken. Ein Feld, das nichts trennt, soll als solches im
 * Cockpit stehen — das ist der eigentliche Befund für den Eigentümer.
 *
 * ⚠️ **Versionsrelevanz** (Regel aus CLAUDE.md §5, hergeleitet aus dem
 * gdpr-audit-Vorfall): Die Gewichte in `SCORE_WEIGHTS` und die Ordinal-Stufen
 * in `REVENUE_WEIGHT` / `FEASIBILITY_WEIGHT` bestimmen die Vergleichbarkeit
 * aller bisherigen Priorisierungen. Wer sie ändert, entscheidet über die
 * Vergleichbarkeit — das gehört entschieden, nicht nebenbei geändert.
 * `test/market-intelligence/score.test.ts` pinnt sie.
 *
 * Das Modul ist absichtlich abhängigkeitsfrei und rein: gleiche Eingabe ⇒
 * gleiche Ausgabe, keine Uhr, kein Zufall. Das Alter kommt als expliziter
 * Parameter herein, damit die Bewertung testbar bleibt.
 */

// ─── Eingabetypen (Spiegel von public.market_gaps) ──────────────────────────

export type RevenuePotential = 'low' | 'medium' | 'high' | 'very_high';
export type BuildComplexity = 'low' | 'medium' | 'high';

export interface ScorableGap {
  id: string;
  industry: string;
  job_category: string;
  urgency_score: number;
  revenue_potential: RevenuePotential;
  build_complexity: BuildComplexity;
  scanned_at: string;
}

// ─── Gewichte — versionsrelevant, nicht ohne Entscheidung ändern ────────────

/**
 * Summe = 1.0. `corroboration` führt, weil es als einziges Merkmal aus dem
 * Korpus berechnet wird und damit nicht an der Selbstbewertung des Modells
 * hängt — aber nur mit 0.25, weil seine Deutung mehrdeutig ist (siehe Kopf).
 * `demand` und `revenue` bleiben enthalten, obwohl sie heute kaum Information
 * tragen: Sie sollen die Bewertung sofort schärfen, falls der Scanner künftig
 * differenzierter urteilt, ohne dass die Gewichte erneut angefasst werden.
 */
export const SCORE_WEIGHTS = {
  corroboration: 0.25,
  demand: 0.25,
  revenue: 0.20,
  feasibility: 0.15,
  freshness: 0.15,
} as const;

export const REVENUE_WEIGHT: Record<RevenuePotential, number> = {
  low: 0.25,
  medium: 0.50,
  high: 0.80,
  very_high: 1.00,
};

/** Invers: Was billig zu bauen ist, ist mehr wert — gleiche Lücke, früherer Umsatz. */
export const FEASIBILITY_WEIGHT: Record<BuildComplexity, number> = {
  low: 1.00,
  medium: 0.60,
  high: 0.30,
};

/** Ab hier gilt ein Befund als veraltet (Tage). Ein Zyklus = 12 Tage, also 6 Zyklen. */
export const FRESHNESS_HALFLIFE_DAYS = 72;

// ─── Korpus-Statistik ───────────────────────────────────────────────────────

export interface CorpusStats {
  /** Job-Kategorie → Anzahl **verschiedener Scan-Tage**, an denen sie auftrat. */
  corroborationByJobCategory: Map<string, number>;
  /** Höchste beobachtete Bestätigungszahl, Normierungsanker (min. 1). */
  maxCorroboration: number;
  /** Aufsteigend sortierte, eindeutige Urgency-Werte des Korpus. */
  urgencyLadder: number[];
  /**
   * Job-Kategorien, die in mehr als einer Branche vorkommen. Heute leer —
   * bewusst mitgeführt und im Cockpit ausgewiesen, damit die Abwesenheit von
   * branchenübergreifenden Themen ein sichtbarer Befund bleibt und nicht
   * unbemerkt als „nichts gefunden" durchgeht.
   */
  crossIndustryJobCategories: string[];
}

/**
 * Baut die Bezugsgrößen, gegen die einzelne Lücken bewertet werden.
 *
 * Bestätigung zählt **verschiedene Scan-Tage**, nicht Zeilen: Zwei Zeilen aus
 * demselben Lauf sind eine Mehrfachausgabe, kein zweiter Beleg. Der Scanner
 * läuft genau einmal täglich, deshalb ist der Tag hier gleichbedeutend mit
 * dem Lauf.
 */
export function buildCorpusStats(gaps: readonly ScorableGap[]): CorpusStats {
  const daysByJob = new Map<string, Set<string>>();
  const industriesByJob = new Map<string, Set<string>>();
  const urgencies = new Set<number>();

  for (const gap of gaps) {
    const job = normalizeKey(gap.job_category);

    let days = daysByJob.get(job);
    if (!days) { days = new Set<string>(); daysByJob.set(job, days); }
    days.add(scanDay(gap.scanned_at));

    let industries = industriesByJob.get(job);
    if (!industries) { industries = new Set<string>(); industriesByJob.set(job, industries); }
    industries.add(normalizeKey(gap.industry));

    urgencies.add(gap.urgency_score);
  }

  const corroborationByJobCategory = new Map<string, number>();
  let maxCorroboration = 1;
  for (const [job, days] of daysByJob) {
    corroborationByJobCategory.set(job, days.size);
    if (days.size > maxCorroboration) maxCorroboration = days.size;
  }

  const crossIndustryJobCategories: string[] = [];
  for (const [job, industries] of industriesByJob) {
    if (industries.size > 1) crossIndustryJobCategories.push(job);
  }
  crossIndustryJobCategories.sort();

  return {
    corroborationByJobCategory,
    maxCorroboration,
    urgencyLadder: [...urgencies].sort((a, b) => a - b),
    crossIndustryJobCategories,
  };
}

// ─── Bewertung ──────────────────────────────────────────────────────────────

export interface ScoreComponents {
  corroboration: number;
  demand: number;
  revenue: number;
  feasibility: number;
  freshness: number;
}

export interface GapScore {
  id: string;
  /** 0–100, kaufmännisch auf eine Nachkommastelle gerundet. */
  score: number;
  components: ScoreComponents;
  /** Anzahl verschiedener Scan-Tage, an denen die Job-Kategorie auftrat. */
  corroborationDays: number;
}

/**
 * Bewertet eine Lücke gegen den Korpus.
 *
 * `ageDays` kommt von außen, damit die Funktion rein bleibt — sonst hinge
 * jeder Test an der Systemuhr.
 */
export function scoreGap(
  gap: ScorableGap,
  stats: CorpusStats,
  ageDays: number,
): GapScore {
  const corroborationDays =
    stats.corroborationByJobCategory.get(normalizeKey(gap.job_category)) ?? 1;

  const components: ScoreComponents = {
    // Auf den beobachteten Höchstwert normiert, nicht auf eine feste Obergrenze:
    // Sonst läge bei 62 einmaligen Kategorien fast alles nahe null.
    corroboration: stats.maxCorroboration <= 1
      ? 0
      : (corroborationDays - 1) / (stats.maxCorroboration - 1),
    demand: ladderPosition(gap.urgency_score, stats.urgencyLadder),
    revenue: REVENUE_WEIGHT[gap.revenue_potential] ?? 0,
    feasibility: FEASIBILITY_WEIGHT[gap.build_complexity] ?? 0,
    freshness: freshness(ageDays),
  };

  const raw =
    components.corroboration * SCORE_WEIGHTS.corroboration +
    components.demand * SCORE_WEIGHTS.demand +
    components.revenue * SCORE_WEIGHTS.revenue +
    components.feasibility * SCORE_WEIGHTS.feasibility +
    components.freshness * SCORE_WEIGHTS.freshness;

  return {
    id: gap.id,
    score: Math.round(clamp01(raw) * 1000) / 10,
    components,
    corroborationDays,
  };
}

/** Bewertet den gesamten Korpus, absteigend sortiert. Stabil bei Gleichstand (id). */
export function scoreCorpus(
  gaps: readonly ScorableGap[],
  ageDaysOf: (gap: ScorableGap) => number,
): GapScore[] {
  const stats = buildCorpusStats(gaps);
  return gaps
    .map((gap) => scoreGap(gap, stats, ageDaysOf(gap)))
    .sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));
}

// ─── Trennschärfe-Diagnose ──────────────────────────────────────────────────

export type DiscriminationVerdict = 'informative' | 'weak' | 'degenerate';

export interface DiscriminationReport {
  field: string;
  total: number;
  distinctValues: number;
  /** Anteil des häufigsten Wertes, 0–1. */
  topShare: number;
  /** Normierte Shannon-Entropie, 0–1. 0 = ein einziger Wert, 1 = Gleichverteilung. */
  normalizedEntropy: number;
  /**
   * Effektive Anzahl Werte (Perplexität, 2^H). Anders als `distinctValues`
   * zählt sie seltene Ausreißer kaum mit: Ein Feld mit vier vorkommenden
   * Werten, von denen zwei je einmal auftreten, hat effektiv zwei.
   */
  effectiveValues: number;
  verdict: DiscriminationVerdict;
  topValue: string | null;
}

/** Unter so vielen effektiven Werten trennt ein Feld praktisch nicht mehr. */
export const DEGENERATE_EFFECTIVE_VALUES = 1.5;
/** Darunter trennt es nur schwach. */
export const WEAK_EFFECTIVE_VALUES = 3.0;

/**
 * Misst, ob ein Feld überhaupt zwischen Einträgen unterscheidet.
 *
 * Warum das im Produkt steht und nicht in einem Skript: Ein Cockpit, das 129
 * Zeilen nach einer Zahl sortiert, die effektiv nur zwei Stufen kennt,
 * behauptet eine Rangfolge, die es nicht gibt. Diese Diagnose macht den
 * Unterschied zwischen „priorisiert" und „sortiert" sichtbar.
 *
 * Das Urteil hängt an der **effektiven** Wertezahl, nicht am Anteil des
 * häufigsten Wertes. Der Grund steckt in den echten Daten: `urgency_score`
 * verteilt sich 89/36/2/2 — der häufigste Wert deckt nur 69 %, eine
 * Schwelle auf den Spitzenanteil würde das Feld also durchwinken. Effektiv
 * sind es aber 2,1 Stufen für 129 Einträge, weil die beiden Ausreißer mit je
 * zwei Zeilen praktisch nichts trennen. Die Perplexität sieht genau das.
 */
export function assessDiscrimination(
  field: string,
  values: readonly (string | number)[],
): DiscriminationReport {
  const total = values.length;
  if (total === 0) {
    return {
      field, total: 0, distinctValues: 0, topShare: 0,
      normalizedEntropy: 0, effectiveValues: 0, verdict: 'degenerate', topValue: null,
    };
  }

  const counts = new Map<string, number>();
  for (const value of values) {
    const key = String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let topValue: string | null = null;
  let topCount = 0;
  let entropy = 0;
  for (const [key, count] of counts) {
    if (count > topCount) { topCount = count; topValue = key; }
    const p = count / total;
    entropy -= p * Math.log2(p);
  }

  const distinctValues = counts.size;
  // Bei nur einem beobachteten Wert ist die Entropie definitionsgemäß 0.
  const normalizedEntropy = distinctValues <= 1 ? 0 : entropy / Math.log2(distinctValues);
  const effectiveValues = Math.pow(2, entropy);
  const topShare = topCount / total;

  let verdict: DiscriminationVerdict = 'informative';
  if (effectiveValues < DEGENERATE_EFFECTIVE_VALUES) verdict = 'degenerate';
  else if (effectiveValues < WEAK_EFFECTIVE_VALUES) verdict = 'weak';

  return {
    field,
    total,
    distinctValues,
    topShare: Math.round(topShare * 1000) / 1000,
    normalizedEntropy: Math.round(normalizedEntropy * 1000) / 1000,
    effectiveValues: Math.round(effectiveValues * 100) / 100,
    verdict,
    topValue,
  };
}

/** Die vier Felder, die der Scanner selbst vergibt — genau die, die entartet sind. */
export function assessScannerFields(
  gaps: readonly Pick<ScorableGap, 'urgency_score' | 'revenue_potential' | 'build_complexity'>[],
): DiscriminationReport[] {
  return [
    assessDiscrimination('urgency_score', gaps.map((g) => g.urgency_score)),
    assessDiscrimination('revenue_potential', gaps.map((g) => g.revenue_potential)),
    assessDiscrimination('build_complexity', gaps.map((g) => g.build_complexity)),
  ];
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Kalendertag eines Zeitstempels als `YYYY-MM-DD`.
 *
 * Bewusst per Präfix-Schnitt statt über `Date`: Die Werte kommen als ISO-
 * Zeitstempel in UTC aus Postgres, und der Scanner läuft um 06:00 UTC. Eine
 * Umrechnung in die lokale Zone des Browsers könnte einen Lauf auf den
 * Vortag schieben und zwei Läufe zu einem Tag verschmelzen.
 */
function scanDay(timestamp: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(timestamp.trim());
  return match ? match[1] : timestamp.trim();
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * Position eines Wertes auf der beobachteten Werteleiter, 0–1.
 *
 * Bewusst rangbasiert statt absolut: Bei einem Korpus, der nur 7–10 vergibt,
 * würde `urgency/10` alles zwischen 0.7 und 1.0 stauchen. Die Leiter spreizt
 * die tatsächlich vorkommenden Stufen über die volle Breite.
 */
function ladderPosition(value: number, ladder: readonly number[]): number {
  if (ladder.length <= 1) return 1;
  const index = ladder.indexOf(value);
  if (index >= 0) return index / (ladder.length - 1);
  // Unbekannter Wert (z. B. nach einer Scanner-Änderung): zwischen die
  // Nachbarn einordnen, statt ihn stillschweigend auf 0 zu setzen.
  let below = 0;
  for (const step of ladder) if (step < value) below++;
  return clamp01(below / (ladder.length - 1));
}

/** Exponentieller Verfall mit Halbwertszeit; frisch = 1, nach 72 Tagen = 0.5. */
function freshness(ageDays: number): number {
  const age = Number.isFinite(ageDays) && ageDays > 0 ? ageDays : 0;
  return clamp01(Math.pow(0.5, age / FRESHNESS_HALFLIFE_DAYS));
}
