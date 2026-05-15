// Developer Remediation Agent — Agent Contract.
//
// Strictly review-bounded agent. Converts governance findings into
// technical remediation artifacts: snippets, plans, GitHub issue
// payloads, PR-comment drafts. NEVER auto-applies, NEVER merges,
// NEVER deploys, NEVER touches secrets, NEVER triggers legal
// submissions.
//
// Conforms to:
//   - ACS v1.0  (spec/runtime/agent-contract.md)
//   - CPS v1.0  (spec/runtime/capability-permission-standard.md)
//   - HRP v1.0  (spec/runtime/human-review-protocol.md)
//
// Forward-declares v1.1 hardening blocks (evidence_coupling,
// escalation_matrix, output_constraints) — the spec for those lands
// in a follow-up PR; the fields are declared here so the first agent
// to ship them is self-documenting.

import type { AgentContract } from '../types';

export const developerRemediationAgent: AgentContract = {
  spec_version: '1.1',

  agent: {
    id:          'developer-remediation-agent',
    name:        'Developer Remediation Agent',
    type:        'remediation',
    version:     '1.0.0',
    description:
      'Converts governance findings into technical remediation artifacts: ' +
      'snippets, diffs, tickets, PR comments and draft pull requests. ' +
      'Never auto-merges, deploys, or modifies secrets.',
    owner:       'realsync-platform',
  },

  ai_act_role: 'limited_risk',
  decides:     false,            // prepares only; humans decide

  capability: {
    trust_level: 'prepare',      // L3 — drafts/snippets, never executes

    permissions: [
      'finding.read',
      'evidence.read',
      'code.snippet.generate',
      'remediation.plan.create',
      'github.issue.create',
      'github.pr_draft.create',
      'pull_request.comment.create',
      'event.publish',
      'tenant.read',
    ],

    restrictions: [
      'evidence.modify',
      'evidence.delete',
      'cross_tenant.read',
      'cross_region.egress',
      'git.merge',
      'production.deploy',
      'secret.read',
      'secret.write',
      'database.migrate',
      'legal.submit',
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

  // ── v1.1 hardening additions ──────────────────────────────────────

  // Every output of this agent links to evidence — a remediation
  // suggestion has no value if it cannot be traced back to the finding
  // that justified it.
  evidence_coupling: {
    mode:            'linked',
    hash_required:   true,
    ledger_required: false,        // appended through the chain by evidence-agent
  },

  // The agent's outputs are suggestions. Auto-continue on low/info,
  // triage on medium (a human triages before reviewer takes it),
  // mandatory human review on high, runtime freeze possible on
  // critical (i.e. agent stops accepting input until operator clears
  // the queue).
  escalation_matrix: {
    sev_info:     { auto_continue: true },
    sev_low:      { auto_continue: true },
    sev_medium:   { triage_required: true,        auto_continue: false },
    sev_high:     { human_review_required: true },
    sev_critical: { runtime_freeze_possible: true, human_review_required: true },
  },

  // The agent's outputs MUST be deterministic-shaped JSON the UI can
  // render without LLM-side surprises. Free-text reasoning is bounded
  // to the `notes` / `summary` fields; everything structural is typed.
  output_constraints: {
    format:                  'strict_json',
    schema_validation:       'required',
    free_text_reasoning:     'limited',
    confidence_score:        'mandatory',
    jurisdiction_required:   false,         // not a legal-output agent
    template_locked:         false,
    hallucination_sensitive: true,
  },

  human_review: {
    required:       true,
    reviewer_roles: ['owner', 'admin', 'developer', 'technical_owner'],
  },
};

export default developerRemediationAgent;
