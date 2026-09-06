/**
 * Domänentypen des Govard Gateway — bewusst frei von Cloudflare-Typen,
 * damit Policy Engine und State Machine als reine Logik testbar bleiben
 * (siehe test/govard/ im Root). Das Env-Binding liegt in env.ts.
 */

// ---------------------------------------------------------------
// Command State Machine
// ---------------------------------------------------------------
export type CommandState =
  | "RECEIVED"
  | "EVALUATED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "EXECUTING"
  | "EXECUTED"
  | "FAILED"
  | "DENIED";

/**
 * Zentrale Übergangstabelle. Jeder Zustandswechsel läuft über
 * OrgRepository.transition(), das gegen diese Tabelle prüft — ein Command
 * kann damit nie an der Governance-Evaluation vorbei ausgeführt werden
 * (RECEIVED → EXECUTED existiert nicht).
 */
export const TRANSITIONS: Record<CommandState, readonly CommandState[]> = {
  RECEIVED:         ["EVALUATED"],
  EVALUATED:        ["PENDING_APPROVAL", "APPROVED", "DENIED"],
  PENDING_APPROVAL: ["APPROVED", "DENIED"],
  APPROVED:         ["EXECUTING"],
  EXECUTING:        ["EXECUTED", "FAILED"],
  EXECUTED:         [],
  FAILED:           [],
  DENIED:           [],
} as const;

export function canTransition(from: CommandState, to: CommandState): boolean {
  return TRANSITIONS[from].includes(to);
}

export interface Command {
  id: string;
  org_id: string;
  actor_id: string;
  source: string;
  intent: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  state: CommandState;
  evaluation_hash: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ---------------------------------------------------------------
// Policies
// ---------------------------------------------------------------
export type PolicyAction = "DENY" | "REQUIRE_APPROVAL" | "WARN";
export type PolicyResult = "PASS" | "VIOLATION" | "NOT_APPLICABLE";

export type PolicyRule =
  | { type: "ALLOWED_INTENTS"; intents: string[] }
  | { type: "MAX_BUDGET"; currency: string; value: number }
  | { type: "MAX_RECIPIENTS"; value: number }
  | { type: "REQUIRE_APPROVAL_FOR_INTENT"; intents: string[] }
  | { type: "ALLOWED_RECIPIENT_DOMAINS"; domains: string[] }
  | { type: "TIME_WINDOW"; from_hour: number; to_hour: number; tz: string };

/** Unveränderlich. Eine Evaluation zitiert immer diese Version, nie die mutierbare Policy-Zeile. */
export interface PolicyVersion {
  id: string;
  org_id: string;
  policy_id: string;
  version: number;
  name: string;
  rule: PolicyRule;
  action: PolicyAction;
  rule_hash: string;
}

export interface EvaluatedPolicy {
  policy_id: string;
  policy_version_id: string;
  version: number;
  name: string;
  rule_hash: string;
  action: PolicyAction;
  result: PolicyResult;
  reason?: string;
}

export interface PolicyEvaluation {
  decision: "ALLOW" | "DENY" | "APPROVAL";
  evaluated: EvaluatedPolicy[];
  violations: EvaluatedPolicy[];
  /** sha256 über { payload_hash, decision, evaluated[] }. Bindet die Freigabe an den Payload. */
  evaluation_hash: string;
  evaluated_at: string;
  policy_set_size: number;
}

// ---------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------
export type EvidenceEventType =
  | "COMMAND_RECEIVED"
  | "POLICY_EVALUATED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "EXECUTION_STARTED"
  | "EXECUTION_SUCCEEDED"
  | "EXECUTION_FAILED"
  | "CHAIN_SEALED";

export interface EvidenceInput {
  org_id: string;
  command_id: string | null;
  actor_id: string | null;
  event_type: EvidenceEventType;
  payload: unknown;
}

export interface EvidenceRecord extends EvidenceInput {
  id: string;
  sequence: number;
  previous_hash: string;
  event_hash: string;
  created_at: string;
}

export interface AppendResult {
  sequence: number;
  event_hash: string;
  previous_hash: string;
  projected: boolean;
}

// ---------------------------------------------------------------
// Auth
// ---------------------------------------------------------------
/**
 * agent    — darf Commands einreichen und eigene Ressourcen lesen
 * approver — darf zusätzlich Freigaben entscheiden (Approval Inbox)
 * admin    — darf zusätzlich Policies verwalten und die Chain siegeln
 *
 * Governance-Grund: Ein Agent-Key darf sich nie selbst freigeben.
 */
export type ApiRole = "agent" | "approver" | "admin";

export interface Principal {
  org_id: string;
  actor_id: string;
  role: ApiRole;
}

export class GovardError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
  }
}
