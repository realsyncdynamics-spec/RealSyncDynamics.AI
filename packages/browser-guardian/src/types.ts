// Browser Guardian · gemeinsame Typen.
//
// Grundsatz: Das Sprachmodell schlägt Aktionen nur vor. Ob eine Aktion
// läuft, entscheiden Policy Engine (policy.ts) und Executor (guardian.ts)
// außerhalb des Modells. Kein Typ hier trägt eine Entscheidung „vom Modell".

/** Aktionen, die der Executor kennt. Alles andere ist unbekannt ⇒ deny. */
export type BrowserAction =
  | { type: 'navigate'; url: string }
  | { type: 'scroll'; direction: 'up' | 'down'; amount?: number }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'select'; selector: string; value: string }
  | { type: 'extract'; selector?: string }
  | { type: 'wait'; milliseconds: number }
  | { type: 'screenshot' };

export type BrowserActionType = BrowserAction['type'];

export const KNOWN_ACTION_TYPES: readonly BrowserActionType[] = [
  'navigate', 'scroll', 'click', 'type', 'select', 'extract', 'wait', 'screenshot',
];

/**
 * Datenklassen (Festlegung 3). Reihenfolge = Schutzbedarf.
 * `unclassified` ist keine fünfte Klasse, sondern „nicht festgestellt" und
 * wird wie ein Schutzbedarf über `public` behandelt (fail-closed).
 */
export type DataClass = 'public' | 'internal' | 'confidential' | 'personal';
export type TargetClass = DataClass | 'unclassified';

export const DATA_CLASS_LABEL_DE: Record<TargetClass, string> = {
  public: 'öffentlich',
  internal: 'intern',
  confidential: 'vertraulich',
  personal: 'personenbezogen',
  unclassified: 'nicht klassifiziert',
};

/**
 * Entscheidungen der Browser-Policy. Bewusst OHNE `log_only` und `warn`:
 * eine Browser-Aktion läuft, wartet auf einen Menschen oder läuft nicht.
 * `NEEDS_REVIEW` (Festlegung 2) ist `require_approval` mit `review`.
 */
export type GuardianDecisionKind = 'allow' | 'require_approval' | 'deny';

export type ReviewKind = 'none' | 'human_approval' | 'data_protection_review';

/** Wirkung einer Aktion — geprüft wird die Wirkung, nicht nur der Typ. */
export type Effect =
  | 'read'        // Seite laden/lesen
  | 'egress'      // Daten verlassen die Sitzung Richtung Zielserver (URL, Eingabe)
  | 'disclose'    // Seiteninhalt verlässt die Seite (Ergebnis, Nachweis, Modell)
  | 'capture'     // Bildaufnahme der Seite
  | 'mutate'      // Zustand auf der Seite/beim Anbieter ändern
  | 'none';

export type ReasonCode =
  | 'POLICY_INVALID'
  | 'CONTEXT_INVALID'
  | 'KILL_SWITCH'
  | 'SESSION_HALTED'
  | 'STEP_LIMIT'
  | 'VOICE_DISABLED'
  | 'UNKNOWN_ACTION'
  | 'INVALID_ACTION'
  | 'URL_SCHEME'
  | 'URL_CREDENTIALS'
  | 'PRIVATE_NETWORK'
  | 'ORIGIN_BLOCKED'
  | 'ORIGIN_PUBLIC'
  | 'ORIGIN_NOT_PUBLIC'
  | 'ORIGIN_UNCLASSIFIED'
  | 'NO_PAGE'
  | 'URL_CARRIES_SENSITIVE_DATA'
  | 'POSSIBLE_ENCODED_EGRESS'
  | 'SESSION_TAINTED'
  | 'MUTATION_REQUIRES_APPROVAL'
  | 'INPUT_PERSONAL_DATA'
  | 'INPUT_SECRET'
  | 'INPUT_PAYMENT_DATA'
  | 'NO_EFFECT';

export interface DecisionReason {
  code: ReasonCode;
  decision: GuardianDecisionKind;
  text_de: string;
}

/** Wer die Aktion vorgeschlagen hat. Ein Modellvorschlag erhält nie mehr Rechte. */
export type ActionSource = 'user' | 'planner';

/** Eingangskanal. `voice` ist bis zur Rechtsklärung gesperrt (Festlegung 6). */
export type InputChannel = 'ui' | 'cli' | 'planner' | 'voice';

/**
 * Kontext kommt aus der lokalen Laufzeit (Anmeldung, Konfiguration),
 * NIE aus dem Modell oder einer Webseite.
 */
export interface GuardianContext {
  tenant_id: string;
  session_id: string;
  actor_id: string;
  kill_switch: boolean;
}

/** Serverseitig bzw. lokal geführter Sitzungszustand. */
export interface SessionState {
  current_url: string | null;
  current_class: TargetClass;
  /** true, sobald nicht-öffentliche oder personenbezogene Inhalte gelesen/eingegeben wurden. */
  tainted: boolean;
  /** true nach einem Prüfpfad-Fehler: keine weiteren Aktionen (fail-closed). */
  halted: boolean;
  step_count: number;
}

export interface GuardianDecision {
  decision: GuardianDecisionKind;
  review: ReviewKind;
  reasons: DecisionReason[];
  effects: Effect[];
  action_type: string;
  target_origin: string | null;
  target_class: TargetClass;
  policy_id: string;
  policy_version: string;
  engine: 'browser-guardian/v1';
}

export interface OriginRule {
  /** Exakter Origin `https://example.com` oder Muster `https://*.example.com`. */
  origin: string;
  data_class: DataClass;
}

/**
 * Mandanten-Richtlinie (lokal versioniert). Ohne `policy_id`/`version`
 * ist sie ungültig ⇒ jede Aktion deny.
 */
export interface GuardianPolicy {
  policy_id: string;
  version: string;
  origins: OriginRule[];
  blocked_origins?: string[];
  /** Darf die feste Freigabedauer nur verkürzen, nie verlängern. */
  approval_ttl_seconds?: number;
  /** Höchstzahl Aktionen je Sitzung; Obergrenze bleibt MAX_SESSION_STEPS. */
  max_session_steps?: number;
}

export interface ActionRequest {
  action: unknown;
  source: ActionSource;
  channel: InputChannel;
}
