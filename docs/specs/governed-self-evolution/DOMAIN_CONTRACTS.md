# Governed Self-Evolution — Domain Contracts

**Status:** Architecture contract draft  
**Implementation:** Not authorized by this document

## Contract Principles

All contracts are versioned, tenant-scoped where applicable, deny-by-default, and evidence-addressable. No contract grants runtime or deployment authority.

## Core Artifacts

### EvolutionSignal

Represents an observed condition that may justify an improvement proposal.

Required fields:

- `id`
- `version`
- `tenant_id` or explicit global classification
- `source`
- `observed_at`
- `signal_type`
- `description`
- `evidence_refs[]`
- `classification`
- `scope`

A signal is read-only input and cannot directly activate a change.

### ExperienceCapsule

Represents a normalized, privacy-safe description of an experience relevant to evolution.

Required fields:

- `id`
- `version`
- `tenant_scope`
- `source_signal_refs[]`
- `context_summary`
- `observed_behavior`
- `outcome`
- `constraints`
- `evidence_refs[]`
- `created_at`

It is not executable and is not a deployment artifact.

### StrategyGene

Represents a versioned strategy definition that can be evaluated as a candidate input.

Required fields:

- `id`
- `version`
- `strategy_class`
- `scope`
- `preconditions`
- `allowed_effects`
- `prohibited_effects`
- `evaluation_profile`
- `rollback_profile`
- `provenance_refs[]`

A registry entry does not imply activation.

### EvolutionCandidate

Represents a proposed, bounded change.

Required fields:

- `id`
- `version`
- `tenant_scope`
- `source_experience_refs[]`
- `strategy_refs[]`
- `change_scope`
- `risk_class`
- `blast_radius_target`
- `evaluation_plan`
- `regression_plan`
- `rollback_plan`
- `evidence_refs[]`
- `status`

Candidates are data, not changes.

### EvaluationRun

Records an isolated evaluation of a candidate.

Required fields:

- `id`
- `candidate_ref`
- `environment_ref`
- `started_at`
- `completed_at`
- `result`
- `metrics`
- `failure_reasons[]`
- `evidence_refs[]`

An evaluation result cannot itself authorize promotion.

### RegressionResult

Records compatibility and regression outcomes against the required baseline.

Required fields:

- `id`
- `candidate_ref`
- `baseline_ref`
- `test_suite_ref`
- `result`
- `failed_checks[]`
- `evidence_refs[]`

### BlastRadiusAssessment

Records the bounded impact analysis.

Required fields:

- `id`
- `candidate_ref`
- `affected_surfaces[]`
- `affected_tenants`
- `risk_class`
- `estimated_scope`
- `limits_checked`
- `result`
- `assessor`
- `evidence_refs[]`

The candidate cannot raise the limits used to assess itself.

### GovernanceDecision

Records the Governance Gate result.

Required fields:

- `id`
- `candidate_ref`
- `decision`
- `policy_version`
- `gate_version`
- `conditions[]`
- `decided_at`
- `decision_actor`
- `evidence_refs[]`

Possible decisions are explicitly enumerated; unknown decisions fail closed.

### ApprovalRecord

Binds human approval to an exact candidate and evidence set.

Required fields:

- `id`
- `candidate_ref`
- `candidate_version`
- `evidence_digest`
- `approver_role`
- `approver_ref`
- `decision`
- `approved_at`

Approval is invalid if the candidate or evidence set changes after approval.

### PromotionRecord

Records a controlled transition from approved candidate to staged/promoted artifact.

Required fields:

- `id`
- `candidate_ref`
- `approved_candidate_version`
- `artifact_version`
- `promotion_stage`
- `promoted_at`
- `promotion_actor`
- `evidence_refs[]`

Promotion cannot exist without the required Governance Decision and Approval Record.

### RollbackRecord

Records reversal of a promoted artifact.

Required fields:

- `id`
- `promotion_ref`
- `rolled_back_version`
- `restored_version`
- `reason`
- `trigger`
- `executed_at`
- `evidence_refs[]`

Rollback must be deterministic and independently auditable.

### EvidenceRecord

Represents an append-only evidence reference.

Required fields:

- `id`
- `event_type`
- `subject_ref`
- `timestamp`
- `actor`
- `content_digest`
- `previous_evidence_ref` where applicable
- `integrity_metadata`

Evidence integrity controls are outside autonomous evolution scope.

## Contract Invariants

1. Every promotion references a successful Governance Decision.
2. Every production-effective promotion references the required human Approval Record.
3. Every promotion references a concrete artifact version.
4. Every rollback references a prior Promotion Record.
5. Every material transition produces evidence.
6. Tenant scope is explicit and cannot silently broaden.
7. Contract versions are immutable once referenced by an approval or promotion record.
8. Unknown or malformed lifecycle states fail closed.
