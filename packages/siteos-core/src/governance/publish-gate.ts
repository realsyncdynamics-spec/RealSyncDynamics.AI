// SiteOS Publish Gate — der normative Contract aus
// `docs/architecture/target-architecture.md` §7, als abhängigkeitsfreier Kern.
//
// ## Warum dieser Code hier liegt und nicht im Handler
//
// §7 verlangt genau eine Definition von `publishable` für SPA, Deno und Tests.
// Zwei Ableitungswege driften auseinander, und im Zweifel gewinnt der falsche —
// deshalb steht die Regel einmal hier, und der Rest der Plattform ruft sie auf.
//
// ## Die Rollenverteilung
//
// Dieses Modul **rechnet**, es **ermittelt nicht**. Die Tatsachen
// (`PublishGateFacts`) sammelt die Edge Function aus der Datenbank; hier wird
// aus ihnen die Entscheidung abgeleitet. Das trennt die prüfbare Regel von der
// Beschaffung — und macht die Regel testbar, ohne eine Datenbank zu brauchen.
//
// ## Fail-closed (G3)
//
// Jeder unbekannte Eingang führt zu „nicht veröffentlichbar". „Wir wissen es
// nicht" ist kein Freigabegrund. Das gilt besonders für `backend_preservation`:
// ein fehlender Vergleich ist `unknown` und blockiert, statt zu raten.

/** Ergebniszustand der Gate-Auswertung (§7 Contract). */
export type PublishGateStatus = 'passed' | 'blocked' | 'pending';

/**
 * Erhaltung des Backends (§7 „Warum `backend_preservation` ein eigenes Feld
 * ist"). Bewusst NICHT Teil von `policy_compliant`: eine Änderung kann optisch
 * und rechtlich sauber sein und trotzdem ein Formularziel verlieren.
 */
export type BackendPreservation = 'preserve_all' | 'changed' | 'unknown';

/**
 * Maschinenlesbare Begründung. G2 verlangt, dass das Frontend `publishable`
 * **und die Begründung** rendert, ohne selbst abzuleiten — ohne benannte Gründe
 * bliebe ihm nur, aus den Einzelfeldern einen Text zu bauen, also genau die
 * zweite Ableitung, die G2 verbietet.
 */
export type PublishGateReasonCode =
  | 'EVIDENCE_INCOMPLETE'
  | 'POLICY_VIOLATION'
  | 'BACKEND_CHANGED'
  | 'BACKEND_UNKNOWN'
  | 'HUMAN_APPROVAL_REQUIRED'
  | 'ARTIFACT_MISMATCH';

export interface PublishGateReason {
  code: PublishGateReasonCode;
  /** Kurztext in Produktsprache, direkt anzeigbar. */
  message: string;
  /**
   * Anker auf die Tatsache, die den Grund trägt (Evidence-Art, Policy-Kennung,
   * Backend-Fähigkeit). Ohne Anker ist ein Grund nicht nachprüfbar.
   */
  ref: string | null;
}

/** Das persistierte Ergebnis. Felder 1:1 aus dem Contract in §7. */
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
   * G6: Eine Evaluation gilt für genau einen Artefakt-Hash. Der Hash gehört
   * deshalb in das Ergebnis selbst — sonst könnte eine Freigabe später einem
   * anderen Inhalt zugeordnet werden, ohne dass es auffällt.
   */
  artifact_sha256: string;
  blueprint_sha256: string;

  /** Begründung zu G2. Bei `publishable: true` leer. */
  reasons: PublishGateReason[];
}

// ── Eingangstatsachen ───────────────────────────────────────────────────────

/**
 * Nachweislage. `expected` sind die Evidence-Arten, die für dieses Artefakt
 * vorliegen müssen; `present` die tatsächlich im Vault verketteten.
 */
export interface EvidenceFacts {
  expected: string[];
  present: string[];
}

export interface PolicyViolationFact {
  /** Kennung der verletzten Regel, z. B. `dsgvo.consent.tracking`. */
  policy_key: string;
  /** Nur blockierende Verstöße setzen `policy_compliant` auf false. */
  blocking: boolean;
  message: string;
}

/**
 * Ergebnis des Backend-Vergleichs zwischen Vorher- und Nachher-Artefakt.
 *
 * `null` an Stelle dieses Objekts bedeutet: der Vergleich hat nicht
 * stattgefunden. Das ist `unknown` und blockiert (G3) — es ist kein Fehler
 * und wird auch nicht als solcher behandelt, weil ein noch nicht gelaufener
 * Vergleich ein normaler Zwischenstand ist.
 */
export interface BackendComparisonFact {
  /**
   * Backend-gebundene Fähigkeiten der Ausgangsversion: Formularziele,
   * Zahlungswege, Buchungsstrecken, Tracking-Einwilligungen, Schnittstellen.
   */
  before: string[];
  /** Dieselben Fähigkeiten in der transformierten Version. */
  after: string[];
}

export interface ApprovalFact {
  /**
   * Ob für dieses Artefakt eine menschliche Freigabe verlangt ist. Ergibt sich
   * aus Policy und Risikoklasse — nicht aus einem Nutzerwunsch.
   */
  required: boolean;
  /** Wer freigegeben hat. `null`, solange keine Freigabe vorliegt. */
  granted_by: string | null;
  granted_at: string | null;
}

export interface PublishGateFacts {
  artifact_sha256: string;
  blueprint_sha256: string;
  evidence: EvidenceFacts;
  policy: { violations: PolicyViolationFact[] };
  /** `null` ⇒ `backend_preservation: 'unknown'` ⇒ blockiert (G3). */
  backend: BackendComparisonFact | null;
  approval: ApprovalFact;
}

export interface EvaluateOptions {
  /** Testbarkeit: feste Zeit statt `Date.now()`. */
  now?: Date;
  /** Testbarkeit: feste Kennung statt `crypto.randomUUID()`. */
  evaluationId?: string;
}

// ── Ableitung ───────────────────────────────────────────────────────────────

/**
 * Die Ableitungsregel aus §7 — wörtlich und ohne Zusatzbedingung.
 *
 * Sie steht bewusst als eigene, exportierte Funktion da: Tests prüfen die
 * Regel direkt gegen den Dokumenttext, und ein späterer Aufrufer, der nur ein
 * gespeichertes Ergebnis nachrechnen will, braucht dafür nicht die ganze
 * Tatsachenbeschaffung.
 */
export function derivePublishable(
  evaluation: Pick<
    PublishGateEvaluation,
    'status' | 'evidence_complete' | 'backend_preservation' | 'policy_compliant' | 'human_approval_required'
  >,
): boolean {
  return (
    evaluation.status === 'passed' &&
    evaluation.evidence_complete === true &&
    evaluation.backend_preservation === 'preserve_all' &&
    evaluation.policy_compliant === true &&
    evaluation.human_approval_required === false
  );
}

/**
 * Leitet die Backend-Erhaltung aus dem Vergleich ab.
 *
 * Verloren gegangene Fähigkeiten sind der gefährliche Fall — eine Seite, die
 * ihr Formularziel verliert, ist ein Produktionsausfall. Neu hinzugekommene
 * Fähigkeiten sind dagegen kein Verlust und blockieren nicht.
 */
export function deriveBackendPreservation(
  backend: BackendComparisonFact | null,
): { value: BackendPreservation; lost: string[] } {
  if (!backend) return { value: 'unknown', lost: [] };
  const after = new Set(backend.after);
  const lost = backend.before.filter((capability) => !after.has(capability));
  return { value: lost.length === 0 ? 'preserve_all' : 'changed', lost };
}

/**
 * Wertet das Gate aus. Serverseitig aufzurufen (G1) — der Client sendet keine
 * Teilergebnisse und rechnet nichts nach.
 */
export function evaluatePublishGate(
  facts: PublishGateFacts,
  options: EvaluateOptions = {},
): PublishGateEvaluation {
  const reasons: PublishGateReason[] = [];

  // 1. Nachweislage.
  const present = new Set(facts.evidence.present);
  const missing = facts.evidence.expected.filter((kind) => !present.has(kind));
  const evidenceComplete = missing.length === 0;
  for (const kind of missing) {
    reasons.push({
      code: 'EVIDENCE_INCOMPLETE',
      message: `Nachweis fehlt: ${kind}`,
      ref: kind,
    });
  }

  // 2. Policy. Nur blockierende Verstöße kippen die Konformität; die übrigen
  //    werden trotzdem als Grund geführt, damit sie nicht unsichtbar bleiben.
  const blocking = facts.policy.violations.filter((violation) => violation.blocking);
  const policyCompliant = blocking.length === 0;
  for (const violation of blocking) {
    reasons.push({
      code: 'POLICY_VIOLATION',
      message: violation.message,
      ref: violation.policy_key,
    });
  }

  // 3. Backend-Erhaltung.
  const backend = deriveBackendPreservation(facts.backend);
  if (backend.value === 'unknown') {
    reasons.push({
      code: 'BACKEND_UNKNOWN',
      message: 'Die Erhaltung der backend-gebundenen Funktionen ist nicht festgestellt.',
      ref: null,
    });
  }
  for (const capability of backend.lost) {
    reasons.push({
      code: 'BACKEND_CHANGED',
      message: `Backend-gebundene Funktion geht verloren: ${capability}`,
      ref: capability,
    });
  }

  // 4. Menschliche Freigabe. Verlangt und erteilt ⇒ nicht mehr „required".
  //    G4: Es gibt kein Flag, das die Freigabe ersetzt — nur eine Person.
  const approvalOutstanding =
    facts.approval.required && (!facts.approval.granted_by || !facts.approval.granted_at);
  if (approvalOutstanding) {
    reasons.push({
      code: 'HUMAN_APPROVAL_REQUIRED',
      message: 'Eine menschliche Freigabe liegt noch nicht vor.',
      ref: null,
    });
  }

  // 5. Status. `blocked` ist der festgestellte Negativbefund, `pending` der
  //    noch nicht abgeschlossene Vorgang. Die Unterscheidung ist für den
  //    Nutzer wichtig: „geht nicht" verlangt eine Änderung, „noch nicht"
  //    verlangt nur Warten.
  let status: PublishGateStatus;
  if (!policyCompliant || backend.value === 'changed') {
    status = 'blocked';
  } else if (!evidenceComplete || backend.value === 'unknown' || approvalOutstanding) {
    status = 'pending';
  } else {
    status = 'passed';
  }

  const evaluation: PublishGateEvaluation = {
    status,
    evidence_complete: evidenceComplete,
    backend_preservation: backend.value,
    policy_compliant: policyCompliant,
    human_approval_required: approvalOutstanding,
    publishable: false, // gleich unten abgeleitet, nie direkt gesetzt
    evaluated_at: (options.now ?? new Date()).toISOString(),
    evaluation_id: options.evaluationId ?? crypto.randomUUID(),
    artifact_sha256: facts.artifact_sha256,
    blueprint_sha256: facts.blueprint_sha256,
    reasons,
  };

  // G4: `publishable` ist rein abgeleitet. Es gibt keinen Pfad, der es setzt.
  evaluation.publishable = derivePublishable(evaluation);
  return evaluation;
}

/**
 * G6-Prüfung vor jeder Publish-Aktion: Trägt diese Evaluation noch das
 * Artefakt, das veröffentlicht werden soll?
 *
 * Ohne diese Prüfung wäre das Gate mit einem Handgriff auszuhebeln — freigeben
 * lassen, Artefakt austauschen, mit der alten `evaluation_id` veröffentlichen.
 */
export function isEvaluationValidFor(
  evaluation: Pick<PublishGateEvaluation, 'artifact_sha256' | 'publishable'>,
  artifactSha256: string,
): boolean {
  return evaluation.publishable === true && evaluation.artifact_sha256 === artifactSha256;
}

/**
 * Die letzte Instanz vor dem Publish. Gibt entweder frei oder nennt den Grund —
 * und wirft nie, weil ein blockiertes Gate der Normalfall ist, kein Fehler.
 */
export function assertPublishable(
  evaluation: PublishGateEvaluation,
  artifactSha256: string,
): { allowed: true } | { allowed: false; reasons: PublishGateReason[] } {
  if (evaluation.artifact_sha256 !== artifactSha256) {
    return {
      allowed: false,
      reasons: [
        {
          code: 'ARTIFACT_MISMATCH',
          message:
            'Die Freigabe gilt für ein anderes Artefakt. Das Artefakt hat sich seit der Bewertung geändert.',
          ref: evaluation.artifact_sha256,
        },
      ],
    };
  }
  if (!evaluation.publishable) {
    return { allowed: false, reasons: evaluation.reasons };
  }
  return { allowed: true };
}
