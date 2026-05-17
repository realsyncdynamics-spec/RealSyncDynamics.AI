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

// ── v1.1 blocks (normative — spec landed in #265) ──────────────────

export type EvidenceMode = 'mandatory' | 'optional' | 'linked' | 'forbidden';

export interface EvidenceCoupling {
  /** Whether the agent's outputs MUST / MAY / MUST link to / MUST NOT
   *  produce evidence. */
  mode: EvidenceMode;
  /** Only valid when mode='mandatory'. */
  hash_required?: boolean;
  /** Only valid when mode='mandatory'. */
  ledger_required?: boolean;
  /** Only valid when mode='linked'. Glob-allowed subject pattern that
   *  the linked evidence record's event_type MUST match. */
  linked_subject?: string;
}

export interface EscalationMatrix {
  sev_info?:     { auto_continue?: boolean; triage_required?: boolean; human_review_required?: boolean };
  sev_low?:      { auto_continue?: boolean; triage_required?: boolean; human_review_required?: boolean };
  sev_medium?:   { auto_continue?: boolean; triage_required?: boolean; human_review_required?: boolean };
  sev_high?:     { auto_continue?: boolean; triage_required?: boolean; human_review_required?: boolean };
  sev_critical?: {
    auto_continue?: boolean;
    triage_required?: boolean;
    human_review_required?: boolean;
    runtime_freeze_possible?: boolean;
  };
  triage_timeout_action?: 'dismiss' | 'process' | 'escalate_to_review';
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
//
// Conforms to agent-contract.schema.json. The schema is the spec;
// this type is a TS mirror so contracts type-check at compile time.

export interface AgentContract {
  spec_version: '1.0' | '1.1';

  agent: {
    /** Canonical kebab-case identifier — the registry's primary key.
     *  Pattern: ^[a-z][a-z0-9-]{1,62}$ */
    name:        string;
    type:        AgentType;
    version:     string;            // SemVer
    description: string;            // Human label / free-text
    owner:       string;            // 'realsync-platform' or tenant-installed
  };

  /** ACS root-level permissions allow-list (closed set per CPS §3).
   *  When `capability` is also present, the two lists complement each
   *  other — the consistency validator unions them. */
  permissions: string[];

  accepts: Array<{ subject: string; min_severity?: EventSeverity }>;
  returns: Array<{ subject: string; requires_human_review?: boolean }>;

  runtime_context: {
    required: string[];
    optional?: string[];
  };

  compliance: {
    ai_act_role: AiActRole;
    decides:     boolean;            // ACS §6
  };

  /** Optional CPS capability block. CPS-conformant agents declare one;
   *  pure ACS v1.0 agents can omit it. */
  capability?: CapabilityBlock;

  // v1.1 normative additions
  evidence_coupling?:  EvidenceCoupling;
  escalation_matrix?:  EscalationMatrix;
  output_constraints?: OutputConstraints;
}
