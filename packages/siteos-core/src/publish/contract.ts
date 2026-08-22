// SiteOS Publish Gate — der Vertrag.
//
// Normative Grundlage: `docs/architecture/target-architecture.md` §7. Dieser
// Abschnitt bezeichnet sich selbst als die schärfste Einzelfestlegung des
// Dokuments; die Regeln G1–G6 werden hier eins zu eins umgesetzt und nicht
// neu erfunden.
//
// ── Der Kern in einem Satz ───────────────────────────────────────────────
//
//   approved === publishable    ← unzulässig
//
// Eine Freigabe im Sinne von „jemand hat auf Genehmigen geklickt" ist nicht
// dasselbe wie „darf veröffentlicht werden". Zwischen beidem steht diese
// Auswertung, und sie läuft serverseitig.
//
// ── Warum die Ableitung nur hier steht ───────────────────────────────────
//
// G2 verlangt, dass das Frontend `publishable` **rendert** und nie aus
// Einzelfeldern ableitet. Zwei Ableitungswege driften auseinander, und im
// Zweifel gewinnt der falsche. Deshalb gibt es in diesem Modul genau eine
// Funktion, die die Regel kennt: `derivePublishable()`. Alles andere baut
// darauf auf.
//
// Dieses Paket ist abhängigkeitsfrei und läuft unverändert in der SPA, in
// Deno-Edge-Functions und in Vitest — damit alle drei dieselbe Definition
// benutzen und nicht jeweils ihre eigene.

import type { RuntimeFinding, Severity } from '../types.ts';

/**
 * Ergebnis der Governance-Bewertung.
 *
 * `pending` ist ein eigener Zustand und **nicht** dasselbe wie `blocked`:
 * blockiert heisst „geprüft und durchgefallen", ausstehend heisst „noch nicht
 * fertig geprüft". Für die Veröffentlichung wirken beide gleich — nur
 * `passed` trägt — aber für die Anzeige und den Prüfpfad ist der Unterschied
 * wesentlich.
 */
export type PublishStatus = 'passed' | 'blocked' | 'pending';

/**
 * Ob die Transformation das dahinterliegende System unangetastet gelassen hat.
 *
 * Eigenes Feld und ausdrücklich **nicht** Teil von `policy_compliant`: Bei
 * einer Transformation ist die sichtbare Oberfläche der leicht prüfbare Teil.
 * Der gefährliche Teil ist alles, was daran hängt — Formularziele,
 * Zahlungswege, Buchungsstrecken, Einwilligungen, Schnittstellen. Eine
 * Änderung, die optisch und rechtlich sauber ist, aber ein Formularziel
 * verliert, ist ein Produktionsausfall.
 *
 * `unknown` ist ein zulässiges Ergebnis und blockiert. Das ist ehrlicher als
 * eine geratene Zusage.
 */
export type BackendPreservation = 'preserve_all' | 'changed' | 'unknown';

/**
 * Warum eine Veröffentlichung nicht möglich ist.
 *
 * G2 verlangt, dass das Frontend die Begründung anzeigt. Eine Begründung als
 * freier Text wäre nicht prüfbar und nicht übersetzbar — deshalb sind es
 * stabile Codes. Wie bei Befund-Codes gilt: **nie umbenennen**, nur ergänzen.
 */
export type PublishBlockCode =
  | 'evaluation_missing'
  | 'evaluation_timeout'
  | 'evaluation_stale'
  | 'artifact_mismatch'
  | 'artifact_missing'
  | 'scan_missing'
  | 'evidence_incomplete'
  | 'backend_changed'
  | 'backend_unknown'
  | 'policy_violation'
  | 'human_approval_required'
  | 'tenant_mismatch';

export interface PublishBlockReason {
  code: PublishBlockCode;
  /** Kurze Erklärung für Menschen. Ersetzt den Code nicht, ergänzt ihn. */
  detail: string;
}

/**
 * Der Vertrag.
 *
 * Die ersten acht Felder stehen so in §7. Zwei Felder kommen hinzu, und zwar
 * nicht als Ausschmückung, sondern weil die Regeln sie verlangen:
 *
 *  - `artifact_sha256` — G6 bindet eine Evaluation an genau **einen**
 *    Artefakt-Hash. Ohne das Feld liesse sich die Bindung nicht prüfen, und
 *    eine alte Freigabe könnte einen neuen Inhalt tragen. Genau so hebelt man
 *    ein Gate aus.
 *  - `reasons` — G2 verlangt, dass das Frontend `publishable` **und die
 *    Begründung** rendert. Ohne Feld gäbe es nichts zu rendern.
 */
export interface PublishGateContract {
  status: PublishStatus;
  evidence_complete: boolean;
  backend_preservation: BackendPreservation;
  policy_compliant: boolean;
  human_approval_required: boolean;
  /** Rein abgeleitet. Siehe `derivePublishable()`. Nie von Hand setzen. */
  publishable: boolean;
  evaluated_at: string;
  /** Prüfpfad-Anker (G5). Jede Publish-Aktion referenziert genau eine Evaluation. */
  evaluation_id: string;
  /** Artefakt, für das diese Evaluation gilt (G6). */
  artifact_sha256: string;
  reasons: PublishBlockReason[];
}

/**
 * Die **einzige** Stelle, an der die Ableitungsregel steht.
 *
 * ```
 * publishable =
 *     status === "passed"
 *     AND evidence_complete === true
 *     AND backend_preservation === "preserve_all"
 *     AND policy_compliant === true
 *     AND human_approval_required === false
 * ```
 *
 * Es gibt bewusst keinen Parameter, mit dem sich das Ergebnis übersteuern
 * liesse (G4). Eine Ausnahme ist immer ein Approval — also eine Person mit
 * Begründung, die `human_approval_required` erfüllt — nie ein Flag. Ein
 * Override-Flag ohne Person zerstört die Zurechenbarkeit, und genau die ist
 * der Zweck des Gates.
 */
export function derivePublishable(
  contract: Omit<PublishGateContract, 'publishable'>,
): boolean {
  return (
    contract.status === 'passed' &&
    contract.evidence_complete === true &&
    contract.backend_preservation === 'preserve_all' &&
    contract.policy_compliant === true &&
    contract.human_approval_required === false
  );
}

/** Setzt `publishable` konsistent — nie von Hand befüllen. */
export function sealContract(
  contract: Omit<PublishGateContract, 'publishable'>,
): PublishGateContract {
  return { ...contract, publishable: derivePublishable(contract) };
}

/**
 * Fail-closed-Vertrag (G3).
 *
 * Für fehlende Antwort, Zeitüberschreitung, unbekannte Backend-Erhaltung und
 * jeden anderen Fall, in dem die Auswertung nicht zu Ende kam. „Wir wissen es
 * nicht" ist kein Freigabegrund.
 *
 * Der Zustand ist `pending`, nicht `blocked`: Es ist keine bestandene Prüfung
 * mit negativem Ergebnis, sondern eine, die nicht stattgefunden hat. Für die
 * Veröffentlichung wirkt beides gleich.
 */
export function failClosedContract(
  reason: PublishBlockReason,
  context: { evaluation_id: string; evaluated_at: string; artifact_sha256: string },
): PublishGateContract {
  return sealContract({
    status: 'pending',
    evidence_complete: false,
    // Nicht ermittelt heisst nicht erhalten. Der schärfere Wert gewinnt.
    backend_preservation: 'unknown',
    policy_compliant: false,
    human_approval_required: true,
    evaluated_at: context.evaluated_at,
    evaluation_id: context.evaluation_id,
    artifact_sha256: context.artifact_sha256,
    reasons: [reason],
  });
}

/**
 * Prüft, ob eine Evaluation das vorliegende Artefakt überhaupt abdeckt (G6).
 *
 * Wird unmittelbar vor der Veröffentlichung aufgerufen, nicht nur bei der
 * Bewertung: Zwischen Bewertung und Veröffentlichung kann sich das Artefakt
 * geändert haben, und eine Freigabe, die einen anderen Inhalt trug, ist keine
 * Freigabe für diesen.
 */
export function evaluationCoversArtifact(
  contract: PublishGateContract,
  artifactSha256: string,
): boolean {
  return (
    typeof artifactSha256 === 'string' &&
    artifactSha256.length > 0 &&
    contract.artifact_sha256 === artifactSha256
  );
}

/**
 * Gültigkeitsdauer einer Evaluation in Millisekunden.
 *
 * Auch bei unverändertem Artefakt altern die Grundlagen: Ein Scan von gestern
 * sagt nichts über eine Richtlinie, die heute in Kraft trat. Die Frist ist
 * kurz genug, dass eine Freigabe eine Entscheidung bleibt und keine Zusage
 * auf Vorrat wird.
 */
export const EVALUATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function evaluationIsFresh(
  contract: PublishGateContract,
  nowMs: number,
): boolean {
  const evaluatedMs = Date.parse(contract.evaluated_at);
  // Ein unlesbares Datum ist kein frisches Datum (G3).
  if (Number.isNaN(evaluatedMs)) return false;
  const age = nowMs - evaluatedMs;
  // Eine Evaluation aus der Zukunft ist ein Zeichen für eine falsche Uhr oder
  // eine Manipulation — beides kein Freigabegrund.
  if (age < 0) return false;
  return age <= EVALUATION_MAX_AGE_MS;
}

/**
 * Die abschliessende Frage vor der Veröffentlichung.
 *
 * Fasst zusammen, was serverseitig gelten muss: abgeleitet veröffentlichbar,
 * für **dieses** Artefakt bewertet, und nicht veraltet. Wer veröffentlicht,
 * ruft diese Funktion — nicht `contract.publishable` allein.
 */
export function mayPublish(
  contract: PublishGateContract,
  artifactSha256: string,
  nowMs: number,
): { allowed: boolean; reasons: PublishBlockReason[] } {
  const reasons: PublishBlockReason[] = [];

  if (!evaluationCoversArtifact(contract, artifactSha256)) {
    reasons.push({
      code: 'artifact_mismatch',
      detail: 'Die Freigabe wurde für ein anderes Artefakt erteilt.',
    });
  }
  if (!evaluationIsFresh(contract, nowMs)) {
    reasons.push({
      code: 'evaluation_stale',
      detail: 'Die Freigabe ist abgelaufen und muss erneuert werden.',
    });
  }
  if (!derivePublishable(contract)) {
    // Die Einzelgründe stehen bereits im Vertrag; hier werden sie nicht
    // dupliziert, sondern übernommen.
    reasons.push(...contract.reasons);
    if (contract.reasons.length === 0) {
      reasons.push({
        code: 'policy_violation',
        detail: 'Die Bewertung trägt keine Veröffentlichung.',
      });
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

// ─────────────────────────────────────────────────────────────────────────
//  Bewertung aus den Eingaben
// ─────────────────────────────────────────────────────────────────────────

/**
 * Schweregrade, die eine Veröffentlichung unmöglich machen.
 *
 * Versionsrelevant wie Befund-Codes und Scoring-Gewichte: Eine Änderung hier
 * verschiebt, was ausgeliefert werden darf. Nicht ohne Entscheidung anfassen.
 */
export const BLOCKING_SEVERITIES: readonly Severity[] = ['critical'];

/**
 * Schweregrade, die eine menschliche Freigabe erzwingen.
 *
 * Zwischen „geht durch" und „geht gar nicht" liegt der Bereich, in dem jemand
 * hinsehen und unterschreiben muss. Das ist die Ausnahme im Sinne von G4 —
 * eine Person mit Begründung, kein Flag.
 */
export const APPROVAL_SEVERITIES: readonly Severity[] = ['high'];

export interface PublishEvaluationInput {
  evaluation_id: string;
  evaluated_at: string;
  artifact_sha256: string;
  /** Befunde des Governance-Scans für genau dieses Artefakt. */
  findings: RuntimeFinding[];
  /** Wurde für dieses Artefakt überhaupt ein Scan durchgeführt? */
  scan_present: boolean;
  /** Ist die Nachweiskette vollständig geschrieben? */
  evidence_complete: boolean;
  backend_preservation: BackendPreservation;
  /** Liegt eine ausdrückliche menschliche Freigabe vor? */
  human_approval_granted: boolean;
}

/**
 * Baut den Vertrag aus den Eingaben.
 *
 * Reine Funktion ohne Uhr, Zufall oder Netz: Dieselben Eingaben ergeben
 * denselben Vertrag. Das ist die Voraussetzung dafür, dass eine Evaluation
 * später nachvollzogen werden kann — ein Gate, dessen Ergebnis sich nicht
 * reproduzieren lässt, belegt nichts.
 */
export function evaluatePublishGate(input: PublishEvaluationInput): PublishGateContract {
  const reasons: PublishBlockReason[] = [];

  if (!input.artifact_sha256) {
    reasons.push({ code: 'artifact_missing', detail: 'Es liegt kein gültiges Artefakt vor.' });
  }

  if (!input.scan_present) {
    reasons.push({ code: 'scan_missing', detail: 'Für dieses Artefakt liegt kein Governance-Scan vor.' });
  }

  const blocking = input.findings.filter((f) => BLOCKING_SEVERITIES.includes(f.severity));
  const needsApproval = input.findings.filter((f) => APPROVAL_SEVERITIES.includes(f.severity));

  // Ohne Scan ist „keine Befunde" keine Aussage über Konformität, sondern nur
  // die Abwesenheit einer Prüfung.
  const policy_compliant = input.scan_present && blocking.length === 0;
  if (input.scan_present && blocking.length > 0) {
    reasons.push({
      code: 'policy_violation',
      detail: `${blocking.length} kritische Befunde blockieren die Veröffentlichung: ${blocking.map((f) => f.code).join(', ')}.`,
    });
  }

  if (!input.evidence_complete) {
    reasons.push({ code: 'evidence_incomplete', detail: 'Die Nachweiskette ist unvollständig.' });
  }

  if (input.backend_preservation === 'changed') {
    reasons.push({ code: 'backend_changed', detail: 'Die Transformation verändert das dahinterliegende System.' });
  }
  if (input.backend_preservation === 'unknown') {
    reasons.push({ code: 'backend_unknown', detail: 'Die Erhaltung des Backends konnte nicht festgestellt werden.' });
  }

  const human_approval_required = needsApproval.length > 0 && !input.human_approval_granted;
  if (human_approval_required) {
    reasons.push({
      code: 'human_approval_required',
      detail: `${needsApproval.length} Befunde erfordern eine ausdrückliche Freigabe.`,
    });
  }

  // `pending`, solange die Grundlage der Prüfung fehlt — `blocked` erst, wenn
  // geprüft wurde und das Ergebnis negativ ist.
  const status: PublishStatus = !input.scan_present || !input.artifact_sha256
    ? 'pending'
    : reasons.length > 0
      ? 'blocked'
      : 'passed';

  return sealContract({
    status,
    evidence_complete: input.evidence_complete,
    backend_preservation: input.backend_preservation,
    policy_compliant,
    human_approval_required,
    evaluated_at: input.evaluated_at,
    evaluation_id: input.evaluation_id,
    artifact_sha256: input.artifact_sha256,
    reasons,
  });
}
