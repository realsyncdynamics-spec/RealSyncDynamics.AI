/**
 * Policy Pack "Industrial OT" — deterministischer Evaluator.
 *
 * Kein LLM im Bewertungspfad: Der Klassifizierungspfad muss reproduzierbar
 * sein — gleiche Antworten ergeben dasselbe Ergebnis und denselben Hash.
 * Die Engine setzt ausschließlich Indikatoren, nie die Einstufung selbst:
 * das höchste Ergebnis ist HIGH_RISK_CANDIDATE bzw. PROHIBITED_CHECK, beides
 * Prüfaufträge an Menschen (EU AI Act Art. 5, Art. 6, Anhang I/III).
 *
 * Sicherheitsrelevanz: answers_sha256 macht den Nachweis in
 * industrial_assessment (append-only, Art. 18 — Aufbewahrung technischer
 * Dokumentation) gegen nachträgliche Antwort-Änderungen prüfbar.
 * DSGVO-Bezug: worker_monitoring dokumentiert Beschäftigtendaten-Verarbeitung
 * (Art. 88 DSGVO, § 26 BDSG, § 87 Abs. 1 Nr. 6 BetrVG).
 *
 * Wertebereiche stehen doppelt — hier und in der Migrations-SQL
 * (20260902000000_industrial_ot_classification.sql). Nie einseitig ändern;
 * test/governance/industrial-ot-parity.test.ts bricht sonst.
 */

import pack from './policy-pack-industrial-ot.json';

export type Tri = 'yes' | 'no' | 'unclear';

export interface IndustrialOtAnswers {
  site: string;
  sector: string;
  asset: string;
  intervention: 'advisory' | 'operator_confirm' | 'closed_loop';
  safety_function: Tri;
  machinery_ce: Tri;
  critical_infra: 'none' | 'strom' | 'gas' | 'waerme' | 'wasser' | 'verkehr' | 'digitale_infrastruktur';
  learning?: 'static' | 'ml_offline_update' | 'self_evolving_online';
  worker_monitoring: 'none' | 'performance' | 'behaviour_safety' | 'emotion';
  human_interaction: boolean;
  generates_content: boolean;
}

export type IndustrialOtOutcome = 'MINIMAL' | 'TRANSPARENCY' | 'HIGH_RISK_CANDIDATE' | 'PROHIBITED_CHECK';

export const OUTCOME_SEVERITY: Record<IndustrialOtOutcome, number> = {
  MINIMAL: 0,
  TRANSPARENCY: 1,
  HIGH_RISK_CANDIDATE: 2,
  PROHIBITED_CHECK: 3,
};

/**
 * Prädikate statt String-Auswertung der `when`-Ausdrücke im Pack-JSON:
 * auditierbar, kein dynamisches eval. Die Paritätstests prüfen, dass jeder
 * Pack-Indikator genau ein Prädikat hat.
 */
export const INDICATOR_PREDICATES: Record<string, (a: IndustrialOtAnswers) => boolean> = {
  'OT-01': (a) => a.machinery_ce === 'yes' && a.safety_function === 'yes',
  'OT-02': (a) =>
    a.machinery_ce === 'yes' &&
    a.safety_function === 'yes' &&
    a.learning === 'self_evolving_online',
  // "unclear" löst hier bewusst mit aus: Ob eine Sicherheitsfunktion vorliegt,
  // entscheidet über Anhang III Nr. 2 — im Zweifel konservativ.
  'OT-03': (a) => a.critical_infra !== 'none' && a.safety_function !== 'no',
  'OT-04': (a) =>
    a.worker_monitoring === 'performance' || a.worker_monitoring === 'behaviour_safety',
  'OT-05': (a) => a.worker_monitoring === 'emotion',
  'OT-06': (a) => a.human_interaction === true,
  'OT-07': (a) => a.generates_content === true,
  'OT-08': (a) =>
    a.intervention === 'closed_loop' &&
    a.safety_function === 'no' &&
    a.machinery_ce === 'no' &&
    a.critical_infra === 'none',
  'OT-09': (a) => a.safety_function === 'unclear' || a.machinery_ce === 'unclear',
  'OT-10': () => true,
};

export interface TriggeredIndicator {
  id: string;
  title: string;
  outcome: IndustrialOtOutcome;
  legal_basis: string;
  open_question: string | null;
  measures: string[];
  deadline: string | null;
  escalate: boolean;
}

export interface IndustrialOtAssessment {
  pack_id: string;
  pack_version: string;
  legal_basis_version: string;
  answers: IndustrialOtAnswers;
  answers_sha256: string;
  triggered: TriggeredIndicator[];
  outcome: IndustrialOtOutcome;
  open_questions: number;
  evaluated_at: string;
}

interface PackIndicator {
  id: string;
  title: string;
  when: string;
  outcome: string;
  legal_basis: string;
  open_question?: string | null;
  measures?: string[];
  deadline_ref?: string | null;
  escalate?: boolean;
}

/**
 * Kanonische Serialisierung — Schlüssel sortiert, `undefined`-Werte
 * ausgelassen (wie JSON.stringify), damit der Hash stabil bleibt, egal ob
 * ein optionales Feld fehlt oder explizit `undefined` ist.
 */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

/** SHA-256 über Web Crypto — läuft in Browser, Deno und Node gleichermaßen. */
async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function evaluateIndustrialOt(
  answers: IndustrialOtAnswers,
): Promise<IndustrialOtAssessment> {
  const deadlines = pack.deadlines as Record<string, string>;
  const triggered: TriggeredIndicator[] = [];

  for (const ind of pack.indicators as PackIndicator[]) {
    const predicate = INDICATOR_PREDICATES[ind.id];
    if (!predicate || !predicate(answers)) continue;

    triggered.push({
      id: ind.id,
      title: ind.title,
      outcome: ind.outcome as IndustrialOtOutcome,
      legal_basis: ind.legal_basis,
      open_question: ind.open_question ?? null,
      measures: ind.measures ?? [],
      deadline: ind.deadline_ref ? deadlines[ind.deadline_ref] ?? null : null,
      escalate: ind.escalate === true,
    });
  }

  const outcome = triggered.reduce<IndustrialOtOutcome>(
    (worst, t) => (OUTCOME_SEVERITY[t.outcome] > OUTCOME_SEVERITY[worst] ? t.outcome : worst),
    'MINIMAL',
  );

  return {
    pack_id: pack.pack_id,
    pack_version: pack.version,
    legal_basis_version: pack.legal_basis_version,
    answers,
    answers_sha256: await sha256Hex(canonical(answers)),
    triggered,
    outcome,
    open_questions: triggered.filter((t) => t.open_question !== null).length,
    evaluated_at: new Date().toISOString(),
  };
}

/** Maßnahmen als flache Liste für industrial_measure. */
export function toMeasures(a: IndustrialOtAssessment) {
  return a.triggered.flatMap((t) =>
    t.measures.map((m) => ({
      indicator_id: t.id,
      measure: m,
      legal_basis: t.legal_basis,
      due_date: t.deadline,
      status: 'open' as const,
    })),
  );
}

/** Evidence-Eintrag für ai_evidence_events (Prüfpfad). */
export function toEvidence(a: IndustrialOtAssessment) {
  const riskLevel =
    a.outcome === 'PROHIBITED_CHECK'
      ? ('critical' as const)
      : a.outcome === 'HIGH_RISK_CANDIDATE'
        ? ('high' as const)
        : a.outcome === 'TRANSPARENCY'
          ? ('medium' as const)
          : ('info' as const);
  return {
    event_type: 'ai_act_classification',
    event_summary: `Industrial OT Vorprüfung: ${a.outcome} (${a.triggered.length} Indikatoren, ${a.open_questions} offene Fragen)`,
    risk_level: riskLevel,
    evidence: {
      pack_id: a.pack_id,
      pack_version: a.pack_version,
      legal_basis_version: a.legal_basis_version,
      answers_sha256: a.answers_sha256,
      triggered_indicators: a.triggered.map((t) => ({ id: t.id, outcome: t.outcome })),
      outcome: a.outcome,
      open_questions: a.open_questions,
      evaluated_at: a.evaluated_at,
    },
  };
}

export { pack as industrialOtPack };
