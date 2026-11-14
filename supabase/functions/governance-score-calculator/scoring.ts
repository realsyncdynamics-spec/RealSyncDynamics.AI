/**
 * Reine Score-Logik für governance-score-calculator (ohne I/O, testbar).
 *
 * Grundsatz: keine Ersatzwerte. Ein Rahmenwerk ohne Quelldaten bekommt
 * `null` (nicht 0, nicht 50, nicht 100) und fließt nicht in den
 * Gesamtwert ein. Hat ein Tenant für kein Rahmenwerk Daten, gibt es
 * keinen Gesamtwert und damit keinen Bericht.
 *
 * Quellen (Schema Stand 2026-11-09):
 * - ISO 27001 / ISO 42001: `*_implementations.status`
 *   Anteil `implemented` | `optimized` an allen Controls.
 * - AI Act: `ai_act_assessments.approval_status`
 *   Anteil `approved` an allen Bewertungen. Bewusst NICHT
 *   `overall_risk_score` — das ist ein Risikowert (hoch = schlecht),
 *   kein Erfüllungsgrad.
 * - DSGVO: `dpias.status`
 *   Anteil `approved` an allen DSFAs.
 * - NIS2: `nis2_incident_deadlines.is_compliant_with_deadline`
 *   Anteil `true` an allen bereits geprüften Fristen (`null` = ungeprüft,
 *   zählt nicht).
 */

export type FrameworkKey = 'iso27001' | 'iso42001' | 'ai_act' | 'dsgvo' | 'nis2';

export const FRAMEWORK_WEIGHTS: Record<FrameworkKey, number> = {
  iso27001: 0.25,
  iso42001: 0.20,
  ai_act: 0.20,
  dsgvo: 0.20,
  nis2: 0.15,
};

export const FRAMEWORK_LABELS: Record<FrameworkKey, string> = {
  iso27001: 'ISO 27001',
  iso42001: 'ISO 42001',
  ai_act: 'EU AI Act',
  dsgvo: 'DSGVO',
  nis2: 'NIS2',
};

export interface FrameworkScore {
  /** 0–100 oder null, wenn keine auswertbaren Daten vorliegen. */
  score: number | null;
  /** Anzahl ausgewerteter Datensätze. */
  basis: number;
}

export interface TenantScoreInput {
  iso27001: Array<{ status: string | null }>;
  iso42001: Array<{ status: string | null }>;
  aiAct: Array<{ approval_status: string | null }>;
  dpias: Array<{ status: string | null }>;
  nis2: Array<{ is_compliant_with_deadline: boolean | null }>;
}

export interface TenantScores {
  frameworks: Record<FrameworkKey, FrameworkScore>;
  /** Gewichteter Mittelwert über Rahmenwerke mit Daten; null ohne Daten. */
  overall: number | null;
}

function share<T>(rows: T[], hit: (row: T) => boolean): FrameworkScore {
  if (rows.length === 0) return { score: null, basis: 0 };
  const hits = rows.filter(hit).length;
  return { score: Math.round((hits / rows.length) * 100), basis: rows.length };
}

const IMPLEMENTED = new Set(['implemented', 'optimized']);

export function calculateScores(input: TenantScoreInput): TenantScores {
  const checkedNis2 = input.nis2.filter((r) => r.is_compliant_with_deadline !== null);

  const frameworks: Record<FrameworkKey, FrameworkScore> = {
    iso27001: share(input.iso27001, (r) => IMPLEMENTED.has(r.status ?? '')),
    iso42001: share(input.iso42001, (r) => IMPLEMENTED.has(r.status ?? '')),
    ai_act: share(input.aiAct, (r) => r.approval_status === 'approved'),
    dsgvo: share(input.dpias, (r) => r.status === 'approved'),
    nis2: share(checkedNis2, (r) => r.is_compliant_with_deadline === true),
  };

  let weighted = 0;
  let weightSum = 0;
  for (const key of Object.keys(frameworks) as FrameworkKey[]) {
    const s = frameworks[key].score;
    if (s === null) continue;
    weighted += s * FRAMEWORK_WEIGHTS[key];
    weightSum += FRAMEWORK_WEIGHTS[key];
  }

  return {
    frameworks,
    overall: weightSum > 0 ? Math.round(weighted / weightSum) : null,
  };
}

/** Rahmenwerke, für die ein Wert vorliegt (für `frameworks_covered`). */
export function coveredFrameworks(scores: TenantScores): FrameworkKey[] {
  return (Object.keys(scores.frameworks) as FrameworkKey[]).filter(
    (k) => scores.frameworks[k].score !== null,
  );
}

/** Lesbare Aufschlüsselung für `audit_reports.description`. */
export function describeScores(scores: TenantScores): string {
  const lines = (Object.keys(scores.frameworks) as FrameworkKey[]).map((k) => {
    const f = scores.frameworks[k];
    return f.score === null
      ? `${FRAMEWORK_LABELS[k]}: keine Daten`
      : `${FRAMEWORK_LABELS[k]}: ${f.score} % (Basis: ${f.basis})`;
  });
  return [
    'Automatisch berechnete Selbsteinschätzung aus den im Mandanten erfassten Daten.',
    'Rahmenwerke ohne Daten fließen nicht in den Gesamtwert ein.',
    '',
    ...lines,
  ].join('\n');
}
