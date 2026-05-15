// Minimal runtime-side TypeScript types that mirror the published spec
// suite at `spec/runtime/`. This file is a foundation, not the spec —
// the spec is the source of truth.
//
// Phase-A scope: enough types to declare and validate agent contracts
// in code. Full schema-driven validation (via ajv against the JSON
// schemas under spec/runtime/schemas/) is Phase-B work.

// ── ESS v1.0 ───────────────────────────────────────────────────────

export type EventSeverity =
  | 'info' | 'low' | 'medium' | 'high' | 'critical';

export type EventCategory =
  | 'finance' | 'governance' | 'inventory' | 'ai'
  | 'platform' | 'agent' | 'evidence' | 'tax' | 'runtime'
  | 'remediation';

// ── ACS v1.0 ───────────────────────────────────────────────────────

export type AgentType =
  | 'ocr' | 'tax' | 'inventory' | 'compliance'
  | 'evidence' | 'detection' | 'risk' | 'remediation' | 'custom';

export type AiActRole =
  | 'high_risk' | 'limited_risk' | 'minimal_risk' | 'excluded';

// ── CPS v1.0 ───────────────────────────────────────────────────────

export type TrustLevel =
  | 'observe_only'
  | 'annotate'
  | 'recommend'
  | 'prepare'
  | 'execute_with_review'
  | 'autonomous_runtime';

export type Permission =
  | 'event.publish'
  | 'evidence.create' | 'evidence.read' | 'evidence.append'
  | 'chain.append'
  | 'hash.generate'
  | 'policy.evaluate'
  | 'agent.dispatch'
  | 'tenant.read'
  | 'finding.read'
  | 'code.snippet.generate'
  | 'remediation.plan.create'
  | 'github.issue.create'
  | 'github.pr_draft.create'
  | 'pull_request.comment.create'
  | `secret.read.${string}`;

export type Restriction =
  | 'evidence.modify'
  | 'evidence.delete'
  | 'tenant.delete'
  | 'policy.delete'
  | 'finance.export.unattended'
  | 'cross_tenant.read'
  | 'cross_region.egress'
  | 'git.merge'
  | 'production.deploy'
  | 'secret.read'
  | 'secret.write'
  | 'database.migrate'
  | 'legal.submit';

export type NetworkIsolation = 'none' | 'egress_allowlist' | 'egress_off';
export type FsWritesIsolation = 'none' | 'tmp_only' | 'scoped_volume';

export interface CapabilityBlock {
  trust_level: TrustLevel;
  permissions: Permission[];
  restrictions: Restriction[];
  escalation_rules?: Array<{
    action: string;
    requires: Array<Record<string, unknown>>;
  }>;
  isolation: {
    network: NetworkIsolation;
    egress_hosts?: string[];
    fs_writes: FsWritesIsolation;
    secret_scope: string[];
  };
}

// ── v1.1 forward-declarations (specs follow in a separate PR) ──────
//
// These three blocks are not yet in a published spec; they prefigure
// the v1.1 hardening additions ("Trust Boundaries refinement",
// "Escalation Matrix", "Evidence Coupling Rules", "Deterministic
// Output Constraints"). They are declared here so the first agent
// shipping them is self-documenting; the spec itself will catch up
// in spec/runtime/ v1.1.

export type EvidenceMode = 'mandatory' | 'optional' | 'linked' | 'forbidden';

export interface EvidenceCoupling {
  /** Whether the agent's outputs MUST/MAY/MUST NOT produce evidence. */
  mode: EvidenceMode;
  /** When mode = 'mandatory', a hash MUST be computed and persisted. */
  hash_required?: boolean;
  /** When mode = 'mandatory', the entry MUST also append to the chain. */
  ledger_required?: boolean;
}

export interface EscalationMatrix {
  sev_info?:     { auto_continue: boolean };
  sev_low?:      { auto_continue: boolean };
  sev_medium?:   { triage_required?: boolean; auto_continue?: boolean };
  sev_high?:     { human_review_required: boolean };
  sev_critical?: { runtime_freeze_possible: boolean; human_review_required?: boolean };
}

export interface OutputConstraints {
  format: 'strict_json' | 'json' | 'markdown' | 'text';
  schema_validation?: 'required' | 'optional' | 'none';
  free_text_reasoning?: 'forbidden' | 'limited' | 'allowed';
  confidence_score?: 'mandatory' | 'optional' | 'forbidden';
  jurisdiction_required?: boolean;
  template_locked?: boolean;
  hallucination_sensitive?: boolean;
}

// ── The full agent manifest ────────────────────────────────────────

export interface AgentContract {
  spec_version: '1.0' | '1.1';
  agent: {
    id: string;                    // canonical, kebab-case
    name: string;                  // human label
    type: AgentType;
    version: string;               // SemVer
    description: string;
    owner: string;
  };
  ai_act_role: AiActRole;
  decides: boolean;                // ACS §6
  capability: CapabilityBlock;

  accepts: Array<{ subject: string; min_severity?: EventSeverity }>;
  returns: Array<{ subject: string; requires_human_review?: boolean }>;

  runtime_context: {
    required: string[];
    optional?: string[];
  };

  // v1.1 forward-declarations — see comment block above.
  evidence_coupling?: EvidenceCoupling;
  escalation_matrix?: EscalationMatrix;
  output_constraints?: OutputConstraints;

  human_review?: {
    required: boolean;
    reviewer_roles: Array<'owner' | 'admin' | 'developer' | 'technical_owner' | 'dpo'>;
  };
}
