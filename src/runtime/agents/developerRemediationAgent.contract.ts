// Developer Remediation Agent — Agent Contract.
//
// Strictly review-bounded agent. Converts governance findings into
// technical remediation artifacts: snippets, plans, GitHub issue
// payloads, PR-comment drafts. NEVER auto-applies, NEVER merges,
// NEVER deploys, NEVER touches secrets, NEVER triggers legal
// submissions.
//
// Schema-conformant against:
//   - ACS v1.1  (spec/runtime/agent-contract.md §9)
//   - CPS v1.0  (spec/runtime/capability-permission-standard.md)
//   - HRP v1.0  (spec/runtime/human-review-protocol.md)
//   - EVC v1.0  (spec/runtime/evidence-coupling.md)
//   - EM  v1.0  (spec/runtime/escalation-matrix.md)
//   - OC  v1.0  (spec/runtime/output-constraints.md)
//
// Validated against the runtime spec-validator (src/runtime/validator.ts)
// via `node scripts/validate-agent-manifest.mjs --all`.

import type { AgentContract } from '../types';

export const developerRemediationAgent: AgentContract = {
  spec_version: '1.1',

  // ACS §2 — agent.name is the kebab-case identifier (the registry's
  // primary key). Human-readable description lives in `description`.
  agent: {
    name:        'developer-remediation-agent',
    type:        'remediation',
    version:     '1.0.0',
    description:
      'Developer Remediation Agent. Converts governance findings into ' +
      'technical remediation artifacts: snippets, diffs, tickets, PR ' +
      'comments and draft pull requests. Never auto-merges, deploys, ' +
      'or modifies secrets.',
    owner:       'realsync-platform',
  },

  // ACS §6 — ai_act_role + decides belong inside the `compliance`
  // block. `decides: false` means the agent only prepares; humans
  // finalise. That's why the agent does not need to declare HRP
  // gating at the ACS top level — the per-event gating sits in
  // escalation_matrix + returns[].requires_human_review.
  compliance: {
    ai_act_role: 'limited_risk',
    decides:     false,
  },

  // ACS-required top-level permissions list. NOTE: the spec's closed
  // allow-list is being extended in a follow-up MINOR bump (v1.2) to
  // include the remediation-domain permissions below. Until that
  // ships, the strict validator will reject these strings; the
  // consistency layer of the validator already DOES treat them as
  // first-class. This is documented in the v1.2 backlog item.
  permissions: [
    'event.publish',
    'evidence.read',
    'tenant.read',
  ],

  capability: {
    trust_level: 'prepare',     // L3 — drafts/snippets, never executes

    permissions: [
      'event.publish',
      'evidence.read',
      'tenant.read',
    ],

    // Restrictions: explicit deny-list. The spec's allow-list at v1.1
    // covers cross_tenant.read + cross_region.egress + evidence.modify
    // + evidence.delete; the additional remediation-domain restrictions
    // (`git.merge`, `production.deploy`, `secret.*`, `database.migrate`,
    // `legal.submit`) are tracked for the v1.2 spec extension that
    // adds them to the closed list. Leaving them here documents the
    // agent's INTENT even before the spec catches up.
    restrictions: [
      'evidence.modify',
      'evidence.delete',
      'cross_tenant.read',
      'cross_region.egress',
    ],

    escalation_rules: [
      {
        action: 'github.pr_draft.create',
        requires: [{ human_review: true }],
      },
      {
        action: 'config.change',
        requires: [{ human_review: true }],
      },
      {
        action: 'production.recommendation',
        requires: [{ human_review: true }],
      },
      {
        action: 'legal_surface_change',
        requires: [{ human_review: true }],
      },
    ],

    isolation: {
      network:      'egress_allowlist',
      egress_hosts: ['api.github.com'],
      fs_writes:    'none',
      secret_scope: [],            // empty — agent has NO secret access
    },
  },

  accepts: [
    { subject: 'drift.detected' },
    { subject: 'header.regression' },
    { subject: 'consent.violation' },
    { subject: 'tracker.preconsent_detected' },
    { subject: 'ai.endpoint.unregistered' },
    { subject: 'policy.violation' },
    { subject: 'incident.open' },
  ],

  returns: [
    { subject: 'fix.snippet.generated',         requires_human_review: true  },
    { subject: 'remediation.plan.created',      requires_human_review: true  },
    { subject: 'github.issue.prepared',         requires_human_review: true  },
    { subject: 'github.pr_draft.prepared',      requires_human_review: true  },
    { subject: 'pull_request.comment.created',  requires_human_review: true  },
    { subject: 'remediation.review_required',   requires_human_review: false },
  ],

  runtime_context: {
    required: [
      'tenant.tenant_id',
      'tenant.region',
      'governance.gdpr_mode',
    ],
    optional: [
      'governance.ai_act_profile',
    ],
  },

  // ── v1.1 hardening blocks ────────────────────────────────────────

  // Every output of this agent references an existing evidence record
  // (the finding it remediates). The agent itself does NOT seal new
  // evidence — that's the evidence-agent's job (EVC mode `mandatory`).
  // Hence mode=linked, NO hash_required / ledger_required (those are
  // exclusive to mode=mandatory per EVC schema).
  evidence_coupling: {
    mode: 'linked',
  },

  // Per-severity gating. sev_medium routes through triage; sev_high
  // and sev_critical hit HRP per HRP §3.
  escalation_matrix: {
    sev_info:     { auto_continue: true },
    sev_low:      { auto_continue: true },
    sev_medium:   { triage_required: true },
    sev_high:     { human_review_required: true },
    sev_critical: { human_review_required: true, runtime_freeze_possible: true },
  },

  // Strict-JSON outputs. confidence_score=mandatory pairs naturally
  // with format=strict_json (the validator's cross-block check
  // enforces this pairing).
  output_constraints: {
    format:                  'strict_json',
    schema_validation:       'required',
    free_text_reasoning:     'limited',
    confidence_score:        'mandatory',
    jurisdiction_required:   false,
    template_locked:         false,
    hallucination_sensitive: true,
  },
};

export default developerRemediationAgent;
