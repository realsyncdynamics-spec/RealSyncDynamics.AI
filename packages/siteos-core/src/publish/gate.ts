// SiteOS Publish Gate — Contract §7 der Zielarchitektur.
//
// Die schärfste Einzelfestlegung des Produkts: Ob eine Site veröffentlicht
// werden darf, wird **abgeleitet**, nicht gesetzt. Es gibt kein Flag, das
// jemand umlegt.
//
// ## Warum diese Datei im abhängigkeitsfreien Kern liegt
//
// Regel G1 verlangt die Auswertung serverseitig, Regel G2 verbietet dem
// Frontend, `publishable` aus Einzelfeldern nachzurechnen. Beides zusammen
// hieße normalerweise: die Definition lebt in der Edge Function, und das
// Frontend kennt nur das Ergebnis.
//
// Die Ableitung steht trotzdem hier — weil „zwei Ableitungswege driften"
// (G2) genau dann eintritt, wenn die Regel zweimal geschrieben wird. Sie
// steht **einmal** und läuft in Deno wie in Vitest. Das Frontend importiert
// den *Typ*, nicht die Funktion: Es rendert `publishable` und die
// Begründung, es ruft `evaluatePublishGate` nicht auf.
//
// ## Fail-closed (G3)
//
// Jede Unsicherheit blockiert. `backend_preservation: 'unknown'` ist ein
// zulässiges Ergebnis und verhindert die Veröffentlichung — „wir wissen es
// nicht" ist kein Freigabegrund.
//
// ## Bindung an genau ein Artefakt (G6)
//
// Eine Evaluation gilt für einen Artefakt-Hash. Ändert sich das Bündel,
// verfällt sie. Deshalb trägt das Ergebnis den Hash mit, und eine Freigabe
// zählt nur, wenn sie für **diesen** Hash erteilt wurde. Sonst trüge eine
// alte Freigabe einen neuen Inhalt — der klassische Weg, ein Gate
// auszuhebeln.

import type { Dimension, RuntimeFinding, SiteBlueprint } from '../types.ts';

// ─────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────

export type PublishGateStatus = 'passed' | 'blocked' | 'pending';

/**
 * Erhaltung des Backends bei einer Transformation.
 *
 * Eigenes Feld, nicht Teil von `policy_compliant`: Die sichtbare Oberfläche
 * ist der leicht prüfbare Teil. Der gefährliche Teil ist alles, was daran
 * hängt — Formularziele, Zahlungswege, Buchungsstrecken,
 * Tracking-Einwilligungen, Schnittstellen. Eine Änderung, die optisch und
 * rechtlich sauber ist, aber ein Formularziel verliert, ist ein
 * Produktionsausfall.
 */
export type BackendPreservation = 'preserve_all' | 'changed' | 'unknown';

export interface PublishGateEvaluation {
  status: PublishGateStatus;
  evidence_complete: boolean;
  backend_preservation: BackendPreservation;
  policy_compliant: boolean;
  human_approval_required: boolean;
  publishable: boolean;
  evaluated_at: string;
  evaluation_id: string;
  /**
   * Artefakt, für das diese Bewertung gilt (G6). Nicht Teil des Contracts
   * in §7, aber ohne ihn ist G6 nicht durchsetzbar: Eine Evaluation ohne
   * Gegenstand lässt sich auf jedes Artefakt beziehen.
   */
  artifact_sha256: string;
  /**
   * Begründung im Klartext. Das Frontend rendert sie (G2) und leitet
   * nichts ab. Leer, wenn veröffentlichbar.
   */
  blockers: string[];
  /** Hinweise ohne Sperrwirkung — sichtbar, aber nicht blockierend. */
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────
// Eingaben
// ─────────────────────────────────────────────────────────────────────

/**
 * Nachweislage für genau diesen Artefakt-Hash. Beides wird serverseitig
 * festgestellt, nicht vom Aufrufer behauptet.
 */
export interface EvidenceState {
  /** Evidence-Snapshot zu diesem Hash geschrieben? */
  snapshotWritten: boolean;
  /** Custody-Kette (Herkunftsnachweis) für diesen Hash fortgeschrieben? */
  custodyLinked: boolean;
}

/**
 * Ausgangslage für die Backend-Feststellung.
 *
 * `greenfield` ist kein Schlupfloch: Wo es keine Vorgängerseite gibt, kann
 * auch nichts verlorengehen. Die Feststellung ist dort beweisbar, nicht
 * geraten — anders als bei einer Transformation ohne Vergleich.
 */
export type BackendState =
  | { kind: 'greenfield' }
  | {
      kind: 'transformation';
      /** Ergebnis des Vergleichs gegen die Ausgangsseite; `null` = nicht durchgeführt. */
      comparison: BackendComparison | null;
    };

export interface BackendComparison {
  /** Formularziele der Ausgangsseite, die im Ergebnis fehlen. */
  lostFormTargets: string[];
  /** Zahlungswege, die fehlen. */
  lostPaymentPaths: string[];
  /** Buchungsstrecken, die fehlen. */
  lostBookingPaths: string[];
  /** Schnittstellen/Endpunkte, die fehlen. */
  lostApiEndpoints: string[];
  /** Einwilligungs-/Tracking-Kategorien, die fehlen. */
  lostConsentCategories: string[];
}

/**
 * Entscheidung des Policy Decision Point (PDP) zu genau dieser
 * Veröffentlichung.
 *
 * ## Warum das eine Eingabe ist und kein Aufruf
 *
 * Diese Datei liegt im abhängigkeitsfreien Kern und läuft in Browser, Deno
 * und Vitest. Ein Aufruf des PDP von hier aus würde beides brechen: die
 * Abhängigkeitsfreiheit und die Reinheit der Ableitung (gleiche Eingabe ⇒
 * gleiches Ergebnis). Die Edge Function fragt den PDP und reicht die
 * Antwort herein — genau wie sie Nachweis, Backend-Lage und Freigabe
 * herstellt, statt sie vom Aufrufer entgegenzunehmen.
 *
 * ## Warum das Feld nicht optional ist
 *
 * Wäre es optional, hieße ein vergessenes Feld „keine Policy-Prüfung
 * stattgefunden" — und das Gate liefe still ohne die Regeln des Mandanten
 * weiter. Genau diese Klasse von Ausfall soll das Gate verhindern. Pflicht
 * im Typ heißt: Der Compiler findet jede Aufrufstelle, die schweigt.
 */
export type PublishPolicyDecision = 'allow' | 'warn' | 'block' | 'require_approval' | 'log_only';

export interface PublishPolicyReason {
  policy_id: string;
  action: PublishPolicyDecision;
  /** Begründung im Klartext, wie sie der PDP formuliert hat. */
  text_de: string;
}

/**
 * Lage der Policy-Auswertung.
 *
 * `unavailable` ist ein zulässiges Ergebnis und sperrt — aus demselben Grund
 * wie `backend_preservation: 'unknown'`: „Wir wissen es nicht" ist kein
 * Freigabegrund (G3). Die Unterscheidung zwischen „eine Regel hat gesperrt"
 * und „die Regeln waren nicht erreichbar" geht dabei nicht verloren; sie
 * steht im Sperrgrund, den das Frontend rendert (G2).
 */
export type PolicyEngineState =
  | {
      kind: 'evaluated';
      decision: PublishPolicyDecision;
      reasons: PublishPolicyReason[];
      matchedPolicyIds: string[];
      /** Fassung des ausgewerteten Regelstands — Anker für die Nachvollziehbarkeit. */
      snapshotVersion: string;
    }
  | {
      kind: 'unavailable';
      /** Warum der PDP nicht geantwortet hat. Erscheint als Sperrgrund. */
      reason: string;
    };

/**
 * Menschliche Freigabe. Zählt nur für den Hash, für den sie erteilt wurde
 * (G6), und trägt immer Person und Begründung (G4) — ein Override-Flag
 * ohne beides zerstört die Zurechenbarkeit.
 */
export interface ApprovalState {
  grantedForArtifactSha256: string | null;
  grantedBy: string | null;
  reason: string | null;
}

export interface PublishGateInput {
  blueprint: SiteBlueprint;
  /** Befunde der Analyse — frisch erhoben, nicht aus dem Speicher gelesen. */
  findings: RuntimeFinding[];
  artifactSha256: string;
  evidence: EvidenceState;
  backend: BackendState;
  /**
   * Antwort des PDP auf „darf dieser Stand veröffentlicht werden?".
   * Serverseitig eingeholt (G1), nie vom Aufrufer behauptet.
   */
  policy: PolicyEngineState;
  approval: ApprovalState;
  /** Anker im Prüfpfad (G5). */
  evaluationId: string;
  evaluatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────
// Regeln
// ─────────────────────────────────────────────────────────────────────

/**
 * Dimensionen mit unmittelbarer Rechtswirkung. Ein schwerer Befund hier ist
 * kein Qualitätsmangel, sondern ein Rechtsverstoß im Auslieferungszustand —
 * er sperrt.
 */
const LEGALLY_BLOCKING: ReadonlySet<Dimension> = new Set<Dimension>(['gdpr', 'eu-ai-act', 'tdddg']);

/**
 * Dimensionen, die eine Person entscheiden lassen statt zu sperren.
 *
 * Barrierefreiheit ist verbindlich (BFSG), aber die Abwägung, ob ein
 * schwerer Befund die Veröffentlichung aufhält, ist eine Entscheidung mit
 * Kontext — anders als eine fehlende Rechtsgrundlage, die keine hat.
 */
const APPROVAL_DIMENSIONS: ReadonlySet<Dimension> = new Set<Dimension>(['accessibility', 'security']);

const SEVERE = new Set(['critical', 'high']);

/**
 * Wertet den Publish Gate aus.
 *
 * Rein ableitend und ohne Seiteneffekt: gleiche Eingabe ⇒ gleiches Ergebnis.
 * Das ist die Voraussetzung dafür, dass die Bewertung später nachvollzogen
 * werden kann — ein Gate, dessen Ergebnis sich nicht reproduzieren lässt,
 * belegt nichts.
 */
export function evaluatePublishGate(input: PublishGateInput): PublishGateEvaluation {
  const blockers: string[] = [];
  const warnings: string[] = [];

  // ── Nachweis ──────────────────────────────────────────────────────
  const evidenceComplete = input.evidence.snapshotWritten && input.evidence.custodyLinked;
  if (!input.evidence.snapshotWritten) {
    blockers.push('Kein Evidence-Snapshot für dieses Artefakt. Eine Veröffentlichung ohne Nachweis ist nicht belegbar.');
  }
  if (!input.evidence.custodyLinked) {
    blockers.push('Herkunftsnachweis (Custody-Kette) für dieses Artefakt nicht fortgeschrieben.');
  }

  // ── Backend ───────────────────────────────────────────────────────
  const backendPreservation = deriveBackendPreservation(input.backend);
  if (backendPreservation === 'unknown') {
    blockers.push(
      'Erhaltung des Backends nicht festgestellt. Der Vergleich gegen die Ausgangsseite fehlt — ohne ihn ist nicht belegt, dass Formulare, Zahlungswege und Schnittstellen erhalten sind.',
    );
  }
  if (backendPreservation === 'changed') {
    blockers.push(...describeBackendLosses(input.backend));
  }

  // ── Policy ────────────────────────────────────────────────────────
  const legalFindings = input.findings.filter(
    (finding) => LEGALLY_BLOCKING.has(finding.dimension) && SEVERE.has(finding.severity),
  );
  // Ein kritischer Befund sperrt unabhängig von seiner Dimension. „Kritisch"
  // heißt bereits, dass die Auslieferung so nicht stattfinden soll.
  const criticalElsewhere = input.findings.filter(
    (finding) => finding.severity === 'critical' && !LEGALLY_BLOCKING.has(finding.dimension),
  );

  const findingsClean = legalFindings.length === 0 && criticalElsewhere.length === 0;
  for (const finding of [...legalFindings, ...criticalElsewhere]) {
    blockers.push(`${finding.code} (${finding.dimension}, ${finding.severity}): ${finding.title}`);
  }

  // ── Policy des Mandanten (PDP) ────────────────────────────────────
  //
  // Bis hierher prüft das Gate ausschließlich seine eigene, fest verdrahtete
  // Befundtabelle. Das ist die Untergrenze — was das Produkt für jeden
  // Mandanten für unzulässig hält. Es ist aber nicht die Regel DES
  // Mandanten: Wer festlegt „keine Veröffentlichung ohne Freigabe des
  // Datenschutzbeauftragten", hatte bis zu dieser Ergänzung keinen Weg,
  // das auf die Veröffentlichung wirken zu lassen.
  //
  // Die PDP-Entscheidung wirkt deshalb auf **bestehende** Vertragsfelder,
  // nicht auf ein neues: `block` macht die Konformität zunichte,
  // `require_approval` erzeugt Freigabepflicht, `warn` einen Hinweis. Ein
  // sechstes Feld hätte die normative Ableitungsregel aus §7 geändert —
  // und die steht nicht zur Disposition.
  const policyEngineBlocks =
    input.policy.kind === 'unavailable' || input.policy.decision === 'block';

  if (input.policy.kind === 'unavailable') {
    blockers.push(
      `Die Richtlinien des Mandanten konnten nicht ausgewertet werden (${input.policy.reason}). Ohne Auswertung ist die Regelkonformität nicht festgestellt — das ist kein Freigabegrund.`,
    );
  } else if (input.policy.decision === 'block') {
    // Ohne Begründungstexte bliebe die Sperre unerklärt. Das wäre für den
    // Betroffenen dasselbe wie ein Fehler.
    blockers.push(
      ...(input.policy.reasons.length > 0
        ? input.policy.reasons.map((r) => `Richtlinie ${r.policy_id}: ${r.text_de}`)
        : ['Eine Richtlinie des Mandanten untersagt die Veröffentlichung dieses Stands.']),
    );
  } else if (input.policy.decision === 'warn') {
    warnings.push(...input.policy.reasons.map((r) => `Richtlinie ${r.policy_id}: ${r.text_de}`));
  }

  // `policy_compliant` heißt „als konform festgestellt", nicht „verstößt
  // nicht". Der Unterschied zählt beim Ausfall des PDP: Dort ist nichts
  // festgestellt, und `false` ist die einzige Antwort, die nichts behauptet,
  // was niemand geprüft hat.
  const policyCompliant = findingsClean && !policyEngineBlocks;

  // ── Freigabepflicht ───────────────────────────────────────────────
  const approvalReasons = deriveApprovalReasons(input.blueprint, input.findings);

  // Eine Richtlinie, die Freigabe verlangt, ist der von G4 vorgesehene Weg
  // für eine Ausnahme: eine Person entscheidet, mit Namen und Begründung.
  if (input.policy.kind === 'evaluated' && input.policy.decision === 'require_approval') {
    approvalReasons.push(
      ...(input.policy.reasons.length > 0
        ? input.policy.reasons.map((r) => `Richtlinie ${r.policy_id}: ${r.text_de} — Freigabe erforderlich.`)
        : ['Eine Richtlinie des Mandanten macht diese Veröffentlichung freigabepflichtig.']),
    );
  }
  const approvalGranted =
    input.approval.grantedForArtifactSha256 === input.artifactSha256 &&
    input.approval.grantedBy !== null &&
    input.approval.reason !== null;

  const humanApprovalRequired = approvalReasons.length > 0 && !approvalGranted;
  if (humanApprovalRequired) blockers.push(...approvalReasons);

  // Eine Freigabe für einen *anderen* Hash ist kein Fehler des Nutzers,
  // aber sie zählt nicht (G6). Das gehört gesagt, sonst wirkt die
  // Sperre wie ein Fehler.
  if (
    input.approval.grantedForArtifactSha256 !== null &&
    input.approval.grantedForArtifactSha256 !== input.artifactSha256
  ) {
    warnings.push(
      'Eine vorhandene Freigabe bezieht sich auf einen früheren Stand und ist mit der letzten Änderung verfallen.',
    );
  }

  for (const finding of input.findings) {
    if (finding.severity === 'medium' && LEGALLY_BLOCKING.has(finding.dimension)) {
      warnings.push(`${finding.code}: ${finding.title}`);
    }
  }

  // ── Ableitung (§7, wörtlich) ──────────────────────────────────────
  const status: PublishGateStatus = !policyCompliant || !evidenceComplete || backendPreservation !== 'preserve_all'
    ? 'blocked'
    : humanApprovalRequired
      ? 'pending'
      : 'passed';

  const publishable =
    status === 'passed' &&
    evidenceComplete &&
    backendPreservation === 'preserve_all' &&
    policyCompliant &&
    humanApprovalRequired === false;

  return {
    status,
    evidence_complete: evidenceComplete,
    backend_preservation: backendPreservation,
    policy_compliant: policyCompliant,
    human_approval_required: humanApprovalRequired,
    publishable,
    evaluated_at: input.evaluatedAt,
    evaluation_id: input.evaluationId,
    artifact_sha256: input.artifactSha256,
    blockers,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Teilableitungen
// ─────────────────────────────────────────────────────────────────────

function deriveBackendPreservation(state: BackendState): BackendPreservation {
  if (state.kind === 'greenfield') return 'preserve_all';
  if (state.comparison === null) return 'unknown';

  const losses = [
    state.comparison.lostFormTargets,
    state.comparison.lostPaymentPaths,
    state.comparison.lostBookingPaths,
    state.comparison.lostApiEndpoints,
    state.comparison.lostConsentCategories,
  ];
  return losses.some((list) => list.length > 0) ? 'changed' : 'preserve_all';
}

function describeBackendLosses(state: BackendState): string[] {
  if (state.kind !== 'transformation' || state.comparison === null) return [];
  const c = state.comparison;

  const entries: [string, string[]][] = [
    ['Formularziel', c.lostFormTargets],
    ['Zahlungsweg', c.lostPaymentPaths],
    ['Buchungsstrecke', c.lostBookingPaths],
    ['Schnittstelle', c.lostApiEndpoints],
    ['Einwilligungskategorie', c.lostConsentCategories],
  ];

  return entries
    .filter(([, list]) => list.length > 0)
    .map(([label, list]) => `${label} geht verloren: ${list.join(', ')}`);
}

/**
 * Gründe, die eine Person entscheiden lassen — statt automatisch zu sperren
 * oder automatisch durchzuwinken.
 */
function deriveApprovalReasons(blueprint: SiteBlueprint, findings: RuntimeFinding[]): string[] {
  const reasons: string[] = [];

  if (blueprint.compliance.dpiaRequired) {
    reasons.push('Datenschutz-Folgenabschätzung ist indiziert (Art. 35 DSGVO) — Freigabe durch eine verantwortliche Person erforderlich.');
  }
  if (blueprint.compliance.specialCategories) {
    reasons.push('Die Site verarbeitet besondere Kategorien personenbezogener Daten (Art. 9 DSGVO) — Freigabe erforderlich.');
  }

  for (const finding of findings) {
    if (APPROVAL_DIMENSIONS.has(finding.dimension) && SEVERE.has(finding.severity)) {
      reasons.push(`${finding.code} (${finding.dimension}, ${finding.severity}): ${finding.title} — Freigabe erforderlich.`);
    }
  }

  return reasons;
}
