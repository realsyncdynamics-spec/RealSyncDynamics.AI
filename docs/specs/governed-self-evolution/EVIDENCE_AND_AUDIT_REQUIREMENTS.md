# Governed Self-Evolution — Evidence and Audit Requirements

## Objective

Evidence must establish what was observed, what was proposed, what was evaluated, what governance decision was made, who approved it, what artifact was promoted and what happened afterwards.

## Required Event Classes

At minimum, evidence must cover:

- signal creation;
- experience capture;
- candidate creation and versioning;
- candidate scope validation;
- evaluation start/completion;
- regression start/completion;
- blast-radius assessment;
- Governance Gate decision;
- human approval/rejection;
- staging;
- promotion;
- activation/deployment reference where applicable;
- monitoring outcome;
- rollback and kill-switch activation where applicable.

## Integrity Requirements

Evidence records must be append-only or otherwise protected against undetected mutation. Each record must have a stable identifier and content digest. Where a chained evidence mechanism is used, each record must reference the prior record required by that mechanism.

Historical approval and promotion evidence must never be rewritten to reflect later outcomes.

## Minimum Attribution

A material event must identify:

- actor or system identity;
- role/capability used;
- timestamp;
- subject artifact;
- artifact version;
- tenant scope;
- decision or event type;
- relevant policy/Gate version;
- evidence references.

## Evidence Completeness Gate

A promotion is invalid unless the required evidence set is complete and integrity-verifiable. Missing evidence is a denial condition, not a warning.

## Auditability

An auditor must be able to reconstruct the lifecycle of a promoted candidate from signal to outcome without relying on mutable operational logs alone.

## Tenant Privacy

Evidence must preserve tenant isolation and must not expose tenant secrets or protected data merely to establish provenance. Cross-tenant evidence aggregation requires explicit classification and authorization.

## Retention

Retention and deletion requirements for evidence are governed by the applicable RSD policy and are outside autonomous evolution scope. Evolution cannot shorten, disable or redefine those requirements.
