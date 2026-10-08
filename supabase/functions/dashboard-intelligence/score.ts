// dashboard-intelligence — reine Score-Ableitung (vitest-importierbar).
//
// Befund 2026-09-29: Der alte Pfad startete bei einem festen Basiswert 75,
// las vier Quelltabellen, von denen drei in keiner Migration existieren
// (compliance_policies, audits, dpia_assessments), ignorierte deren Fehler
// und leitete GDPR/NIS2/DSA/AI-Act-Scores als feste Vielfache (×1,05, ×0,98 …)
// des Gesamtwerts ab. Ergebnis ohne jede Datengrundlage: 75/79/74/77/71.
//
// Regeln ab jetzt:
//   1. Fehlt eine Quelle oder liefert sie einen Fehler → insufficient_data,
//      es wird NICHTS geschrieben.
//   2. Framework- und Kategorie-Werte werden nicht mehr aus dem Gesamtwert
//      hochgerechnet — ohne eigene Messung bleiben sie null.

export interface SourceResult<T> {
  data: T[] | null;
  error: unknown;
}

export interface ScoreSources {
  policies: SourceResult<{ status: string }>;
  audits: SourceResult<{ findings_count: number; status: string }>;
  incidents: SourceResult<{ severity: string; status: string }>;
  dpia: SourceResult<{ status: string }>;
}

export type ScoreOutcome =
  | {
      status: 'ok';
      overall: number;
      /** Nicht aus dem Gesamtwert ableitbar — bleiben ohne eigene Messung null. */
      gdpr: null;
      nis2: null;
      dsa: null;
      ai_act: null;
    }
  | { status: 'insufficient_data'; missing: string[] };

export function missingSources(sources: ScoreSources): string[] {
  const missing: string[] = [];
  for (const [name, result] of Object.entries(sources) as Array<[string, SourceResult<unknown>]>) {
    if (result.error || !Array.isArray(result.data)) missing.push(name);
  }
  return missing;
}

export function scoreFromSources(sources: ScoreSources): ScoreOutcome {
  const missing = missingSources(sources);
  if (missing.length > 0) return { status: 'insufficient_data', missing };

  const policies = sources.policies.data ?? [];
  const audits = sources.audits.data ?? [];
  const incidents = sources.incidents.data ?? [];
  const dpia = sources.dpia.data ?? [];

  let overall = 75;
  if (policies.length > 0) {
    const documented = policies.filter((p) => p.status === 'approved').length;
    overall += Math.min((documented / 5) * 25, 25);
  }
  if (audits.length > 0) {
    const recentClean = audits.filter((a) => a.status === 'passed' && a.findings_count === 0);
    if (recentClean.length > 0) overall += 15;
    else if (audits[0].findings_count === 0) overall += 10;
    else overall -= Math.min(audits[0].findings_count * 2, 20);
  }
  if (incidents.length > 0) {
    const critical = incidents.filter((i) => i.severity === 'critical').length;
    const high = incidents.filter((i) => i.severity === 'high').length;
    overall -= critical * 10 + high * 5;
  }
  if (dpia.length === 0) overall += 5;

  return {
    status: 'ok',
    overall: Math.round(Math.max(0, Math.min(100, overall))),
    gdpr: null,
    nis2: null,
    dsa: null,
    ai_act: null,
  };
}
