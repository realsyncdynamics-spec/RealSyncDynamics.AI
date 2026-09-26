// Invarianten fuer Assessment-Snapshots – KEIN Evaluator.
//
// Diese Datei legt fest, welche Ergebnisse und abgeleiteten Aussagen ein
// Evaluator aus gegebenen Eingaben NIE produzieren darf. Der Evaluator (naechster
// Schritt) dockt an: sein Snapshot muss checkAssessmentInvariants() und
// checkEvidenceBacking() ohne Verstoss bestehen, und sein result darf nicht in
// forbiddenResults(inputs) liegen.
//
// Rein: keine DB, kein Netz, keine Uhr (Zeitbezug nur ueber evidence_cutoff im
// Snapshot).

import type { AssessmentInputs, AssessmentResult, AssessmentSnapshot, SealLevel } from './types.ts';

export const ASSESSMENT_RESULTS: readonly AssessmentResult[] = ['PASS', 'CONDITIONAL', 'FAIL', 'UNKNOWN', 'STALE'];

export type InvariantCode =
  | 'INV_A_EGRESS_STRICT_PASS'
  | 'INV_A_EGRESS_UNKNOWN_STRICT_PASS'
  | 'INV_B_STALE_EVIDENCE_PASS'
  | 'INV_B_FRESHNESS_MISLABELLED'
  | 'INV_C_AI_ACT_WITHOUT_RISK_CLASS'
  | 'INV_D_SEAL_ESCALATION'
  | 'INV_D_FULL_SUPPLY_CHAIN_WITHOUT_SEAL4'
  | 'INV_E_THIRD_COUNTRY_FROM_REGION'
  | 'EVIDENCE_UNBACKED_POSITIVE_RESULT'
  | 'EVIDENCE_RELIED_ON_MISSING'
  | 'SNAPSHOT_FIELD_MISMATCH'
  | 'SNAPSHOT_TIME_ORDER';

export interface Violation { code: InvariantCode; message: string }

const SEAL_RANK: Record<SealLevel, number> = { 'SEAL-0': 0, 'SEAL-1': 1, 'SEAL-2': 2, 'SEAL-3': 3, 'SEAL-4': 4 };

/** Belegtes SEAL-Level fuer genau diese SKU (nie von der Marke geerbt). */
export function evidencedSealLevel(inputs: AssessmentInputs): SealLevel | null {
  const seal = inputs.facts.eu_commission_seal;
  if (seal.status !== 'awarded' || !seal.level) return null;
  if (!seal.applies_to_sku.includes(inputs.product_sku)) return null;
  if (seal.sources.length === 0 || seal.verification_status === 'unknown') return null;
  return seal.level;
}

function daysBetween(fromIso: string, toIso: string): number {
  return (Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000;
}

/** Ist ein Evidenz-Eintrag relativ zum evidence_cutoff veraltet? */
export function isStale(item: AssessmentInputs['evidence'][number], evidenceCutoff: string): boolean {
  return item.freshness === 'stale' || daysBetween(item.captured_at, evidenceCutoff) > item.max_age_days;
}

/** Ein Evidenz-Eintrag ist 'belegt', wenn er claimed/verified ist UND mindestens eine Quelle hat. */
export function isBacked(item: AssessmentInputs['evidence'][number]): boolean {
  return (item.status === 'claimed' || item.status === 'verified') && item.source_count > 0;
}

/**
 * Ergebnisse, die fuer diese Eingaben ausgeschlossen sind. Der Evaluator darf
 * nur Ergebnisse ausserhalb dieser Menge liefern.
 */
export function forbiddenResults(inputs: AssessmentInputs, evidenceCutoff: string): { forbidden: Set<AssessmentResult>; reasons: InvariantCode[] } {
  const forbidden = new Set<AssessmentResult>();
  const reasons: InvariantCode[] = [];
  const egress = inputs.facts.external_inference_egress;

  // (a) Externe Inferenz-Weitergabe ist unter strict_eu_sovereignty nie PASS;
  //     eine unbelegte Weitergabe-Aussage ebenso wenig.
  if (inputs.policy_profile === 'strict_eu_sovereignty') {
    if (egress.value === true) { forbidden.add('PASS'); reasons.push('INV_A_EGRESS_STRICT_PASS'); }
    else if (egress.value === null || egress.status === 'unknown' || egress.sources.length === 0) {
      forbidden.add('PASS'); reasons.push('INV_A_EGRESS_UNKNOWN_STRICT_PASS');
    }
  }

  // (b) Veraltete Evidenz, auf die sich die Entscheidung stuetzt, macht nie PASS.
  const relied = new Set(inputs.relied_on);
  if (inputs.evidence.some((e) => relied.has(e.ref) && isStale(e, evidenceCutoff))) {
    forbidden.add('PASS'); reasons.push('INV_B_STALE_EVIDENCE_PASS');
  }

  // (d) Vollstaendige Lieferketten-Souveraenitaet verlangt belegtes SEAL-4 fuer diese SKU.
  if (inputs.assurance_target === 'full_supply_chain_sovereignty') {
    const lvl = evidencedSealLevel(inputs);
    if (lvl === null || SEAL_RANK[lvl] < 4) { forbidden.add('PASS'); reasons.push('INV_D_FULL_SUPPLY_CHAIN_WITHOUT_SEAL4'); }
  }

  // Evidence-Gate: kein PASS/CONDITIONAL aus unbelegten Claims.
  const byRef = new Map(inputs.evidence.map((e) => [e.ref, e]));
  if (inputs.relied_on.some((r) => { const e = byRef.get(r); return !e || !isBacked(e); })) {
    forbidden.add('PASS'); forbidden.add('CONDITIONAL'); reasons.push('EVIDENCE_UNBACKED_POSITIVE_RESULT');
  }

  return { forbidden, reasons };
}

/** Pruefung (a), (b), (d)-Ergebnis und alle Aussage-Invarianten (c), (d), (e). */
export function checkAssessmentInvariants(s: AssessmentSnapshot): Violation[] {
  const v: Violation[] = [];
  const inp = s.inputs;

  // (a), (b), (d): Ergebnis-Verbote. Nur PASS ist hier ausgeschlossen; das
  // Verbot von CONDITIONAL aus unbelegten Claims prueft checkEvidenceBacking().
  const { reasons } = forbiddenResults(inp, s.evidence_cutoff);
  if (s.result === 'PASS') {
    for (const code of reasons) {
      if (code === 'EVIDENCE_UNBACKED_POSITIVE_RESULT') continue;
      v.push({ code, message: `result=PASS ist fuer diese Eingaben ausgeschlossen (${code}).` });
    }
  }

  // (b') Frische-Kennzeichnung muss zum evidence_cutoff passen.
  for (const e of inp.evidence) {
    if (e.freshness === 'fresh' && daysBetween(e.captured_at, s.evidence_cutoff) > e.max_age_days) {
      v.push({ code: 'INV_B_FRESHNESS_MISLABELLED', message: `${e.ref}: als fresh markiert, aber aelter als max_age_days=${e.max_age_days} zum evidence_cutoff.` });
    }
  }

  // (c) Ohne Risikoklasse keine Aussage zur AI-Act-Konformitaet.
  if (inp.use_case_risk_class === 'not_assessed' && s.derived.ai_act_conformity !== null && s.derived.ai_act_conformity !== 'no_statement') {
    v.push({ code: 'INV_C_AI_ACT_WITHOUT_RISK_CLASS', message: `use_case_risk_class=not_assessed, aber ai_act_conformity=${s.derived.ai_act_conformity}.` });
  }

  // (d) SEAL-Level nie hoeher als belegt; SEAL-3 wird nie SEAL-4 / full_supply_chain_sovereignty.
  const evidenced = evidencedSealLevel(inp);
  if (s.derived.seal_level !== null) {
    if (evidenced === null || SEAL_RANK[s.derived.seal_level] > SEAL_RANK[evidenced]) {
      v.push({ code: 'INV_D_SEAL_ESCALATION', message: `derived.seal_level=${s.derived.seal_level}, belegt ist ${evidenced ?? 'keines'} fuer SKU ${inp.product_sku}.` });
    }
  }
  if (s.derived.sovereignty_assurance === 'full_supply_chain_sovereignty' && (evidenced === null || SEAL_RANK[evidenced] < 4)) {
    v.push({ code: 'INV_D_FULL_SUPPLY_CHAIN_WITHOUT_SEAL4', message: `full_supply_chain_sovereignty ohne belegtes SEAL-4 (belegt: ${evidenced ?? 'keines'}).` });
  }

  // (e) Kein Drittstaaten-Ausschluss aus der Region: derived.third_country_access
  //     darf nie guenstiger sein als der Fakt selbst.
  const fact = inp.facts.third_country_access;
  if (s.derived.third_country_access === 'no_access_claimed') {
    const backed = fact.status === 'no_access_claimed' && fact.verification_status !== 'unknown' && fact.sources.length > 0;
    if (!backed) {
      v.push({ code: 'INV_E_THIRD_COUNTRY_FROM_REGION', message: `derived.third_country_access=no_access_claimed, der Fakt lautet ${fact.status} (Region ${inp.facts.inference_region.scope}/${inp.facts.inference_region.country_codes.join(',') || '-'} begruendet das nicht).` });
    }
  }

  // Konsistenz Snapshot <-> inputs und Zeitreihenfolge.
  for (const k of ['deployment_id', 'policy_profile', 'assurance_target', 'rule_version'] as const) {
    if ((s as unknown as Record<string, unknown>)[k] !== (inp as unknown as Record<string, unknown>)[k]) {
      v.push({ code: 'SNAPSHOT_FIELD_MISMATCH', message: `${k} weicht zwischen Snapshot und inputs ab.` });
    }
  }
  if (Date.parse(s.evidence_cutoff) > Date.parse(s.evaluated_at)) {
    v.push({ code: 'SNAPSHOT_TIME_ORDER', message: 'evidence_cutoff liegt nach evaluated_at.' });
  }
  if (s.expires_at !== null && Date.parse(s.expires_at) <= Date.parse(s.evaluated_at)) {
    v.push({ code: 'SNAPSHOT_TIME_ORDER', message: 'expires_at liegt nicht nach evaluated_at.' });
  }
  return v;
}

/** Evidence-Gate-Teil: kein PASS/CONDITIONAL aus unbelegten oder fehlenden Belegen. */
export function checkEvidenceBacking(s: AssessmentSnapshot): Violation[] {
  const v: Violation[] = [];
  const byRef = new Map(s.inputs.evidence.map((e) => [e.ref, e]));
  for (const r of s.inputs.relied_on) {
    const e = byRef.get(r);
    if (!e) {
      v.push({ code: 'EVIDENCE_RELIED_ON_MISSING', message: `relied_on ${r} fehlt in inputs.evidence.` });
      continue;
    }
    if ((s.result === 'PASS' || s.result === 'CONDITIONAL') && !isBacked(e)) {
      v.push({ code: 'EVIDENCE_UNBACKED_POSITIVE_RESULT', message: `result=${s.result} stuetzt sich auf ${r} (status=${e.status}, Quellen=${e.source_count}).` });
    }
  }
  return v;
}
