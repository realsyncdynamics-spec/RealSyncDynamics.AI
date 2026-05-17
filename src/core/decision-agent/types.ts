// DecisionAgent — type system.
//
// Mirrors decision_agent_policies + decision_agent_routings.
// Pure types; verbs live in decision.ts.

import type { DecisionRisk, DecisionReversibility } from '../agent-os/types';

// ── Policy ────────────────────────────────────────────────────────

export interface DecisionPolicy {
  tenant_id:                       string;

  /** Auto-approve only if confidence >= floor. Default 0.70. */
  auto_approve_confidence_floor:   number;

  /** Risk levels eligible for auto-approval. 'high'/'critical' are
   *  NEVER eligible regardless of this list (hard rule). */
  auto_approve_risk_levels:        DecisionRisk[];

  /** Reversibility levels eligible. 'irreversible' is NEVER eligible. */
  auto_approve_reversibility:      DecisionReversibility[];

  default_owner_user_id:           string | null;
  default_owner_handle:            string | null;
  default_sla_hours:               number;

  /** Hard kill-switch — when true, never auto-approves. */
  paused:                          boolean;

  created_at:                      string;
  updated_at:                      string;
}

// ── Routing audit log ─────────────────────────────────────────────

export type RoutingAction =
  | 'auto_approved'
  | 'escalated'
  | 'rejected'
  | 'overdue'
  | 'superseded';

export interface RoutingRecord {
  id:                  string;
  decision_id:         string;
  tenant_id:           string;
  action:              RoutingAction;
  reason:              string;
  routed_to_user_id:   string | null;
  routed_to_handle:    string | null;
  due_by:              string | null;
  risk_level:          DecisionRisk | null;
  reversibility:       DecisionReversibility | null;
  confidence_score:    number | null;
  created_at:          string;
}

// ── Persistence hook ──────────────────────────────────────────────

export interface DecisionPersistHook {
  savePolicy?:  (p: DecisionPolicy)  => Promise<void> | void;
  saveRouting?: (r: RoutingRecord)   => Promise<void> | void;
}

// ── Outcome of a review() call ────────────────────────────────────

export interface ReviewOutcome {
  decision_id:  string;
  action:       RoutingAction;
  reason:       string;
  routing:      RoutingRecord;
}

// ── Platform defaults (used when no per-tenant policy exists) ─────

export const PLATFORM_DEFAULT_POLICY: Omit<DecisionPolicy, 'tenant_id' | 'created_at' | 'updated_at'> = {
  auto_approve_confidence_floor: 0.70,
  auto_approve_risk_levels:      ['low'],
  auto_approve_reversibility:    ['reversible'],
  default_owner_user_id:         null,
  default_owner_handle:          null,
  default_sla_hours:             24,
  paused:                        false,
};

// ── Forbidden combinations (hard rules, NOT configurable) ─────────

export const FORBIDDEN_AUTO_APPROVE_RISK:          ReadonlyArray<DecisionRisk> =
  ['high', 'critical'];
export const FORBIDDEN_AUTO_APPROVE_REVERSIBILITY: ReadonlyArray<DecisionReversibility> =
  ['irreversible'];
