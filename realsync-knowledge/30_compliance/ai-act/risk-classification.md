---
title: EU AI Act Risk Classification
owner: compliance
status: draft
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-08-31
tags: [ai-act, risk, compliance, governance]
---

# EU AI Act Risk Classification

Operational classification of AI features in the RealSync
platform under Regulation (EU) 2024/1689 (the AI Act). This
document is the input register for AI Act conformity work and
must be kept consistent with the data-flow map in
`../gdpr/data-flow-map.md`.

## Scope

Every AI-driven feature shipped under RealSync is listed in the
inventory below. The list is the authoritative starting point for
risk classification, conformity assessment, and post-market
monitoring.

## AI Feature Inventory

| ID    | Feature                                       | Model(s)               | Boundary        | Subject inputs           |
|-------|-----------------------------------------------|------------------------|-----------------|--------------------------|
| F-001 | Provenance assistant (content classification) | qwen3:4b (Ollama)      | `vps-ollama`    | user-uploaded media      |
| F-002 | Workflow suggestion (n8n template proposal)   | cloud-ai (configurable)| `cloud-ai`      | tenant workflow metadata |
| F-003 | Compliance summariser (DSGVO/AI Act extract)  | cloud-ai (configurable)| `cloud-ai`      | tenant policy text       |
| F-004 | Risk-finding annotation (governance review)   | cloud-ai (configurable)| `cloud-ai`      | finding text, evidence refs |
| F-005 | Kodee assistant (operator support)            | cloud-ai (configurable)| `cloud-ai`      | operator queries         |

The inventory MUST be updated when a feature is added, removed, or
its model boundary changes. Each entry MUST link to an
architecture document under `20_architecture/`.

## Risk Categories

The AI Act distinguishes four risk categories. Each feature is
assigned exactly one category.

| Category               | Definition (operational)                                              |
|------------------------|-----------------------------------------------------------------------|
| `unacceptable`         | Prohibited under Art. 5. MUST NOT be shipped.                         |
| `high-risk`            | Annex III use cases or safety components. Conformity assessment.      |
| `limited-risk`         | Transparency obligations (Art. 50).                                   |
| `minimal-risk`         | No specific AI Act obligations beyond general law.                    |

## Prohibited Use Review

Each feature is reviewed against Art. 5 prohibited practices:

| Practice (Art. 5)                              | F-001 | F-002 | F-003 | F-004 | F-005 |
|------------------------------------------------|-------|-------|-------|-------|-------|
| Subliminal manipulation                        | no    | no    | no    | no    | no    |
| Exploitation of vulnerabilities                | no    | no    | no    | no    | no    |
| Social scoring by public authorities           | no    | no    | no    | no    | no    |
| Predictive policing (individual risk)          | no    | no    | no    | no    | no    |
| Untargeted facial-image scraping               | no    | no    | no    | no    | no    |
| Emotion recognition in workplace/education     | no    | no    | no    | no    | no    |
| Biometric categorisation (sensitive attributes)| no    | no    | no    | no    | no    |
| Real-time remote biometric identification      | no    | no    | no    | no    | no    |

No current feature falls under Art. 5. The table MUST be revised
on every feature addition.

## High-Risk Evaluation

Each feature is screened against Annex III:

| Feature | Annex III area              | Assessment                                  | Outcome      |
|---------|-----------------------------|---------------------------------------------|--------------|
| F-001   | Not in scope                | Content provenance is not an Annex III use case | not high-risk |
| F-002   | Not in scope                | Operational tooling, no protected use case  | not high-risk |
| F-003   | Not in scope                | Internal compliance assistance              | limited-risk |
| F-004   | Not in scope                | Internal governance review                  | limited-risk |
| F-005   | Not in scope                | Operator support                            | limited-risk |

Outcomes are working assumptions and MUST be confirmed by counsel
before product launch. The assessment record (date, reviewer,
rationale) is tracked outside this repository in the legal review
log.

## Transparency Obligations (Art. 50)

For features classified `limited-risk`, the platform must:

- Disclose AI involvement at point of interaction.
- Label AI-generated or AI-assisted output where applicable.
- Preserve user ability to request human review.

These obligations are implemented in the SPA and edge functions.
Implementation references belong in `20_architecture/`.

## Human Oversight

| Feature | Oversight mechanism                                              |
|---------|------------------------------------------------------------------|
| F-001   | Operator confirmation before provenance record is finalised.     |
| F-002   | Suggestion only; no automatic workflow creation.                 |
| F-003   | Output is advisory; final compliance decision remains human.     |
| F-004   | Annotations require human acceptance before finding state change.|
| F-005   | Operator-driven; assistant cannot act on tenant data unattended. |

Human-in-the-loop is a runtime invariant for every AI feature and
is enforced in code, not by policy alone.

## Logging and Evidence Requirements

Every AI invocation MUST produce a row in `ai_tool_runs` with:

- `tenant_id`, `user_id`, `feature_id`
- `model`, `provider`, `boundary`
- input hash, output hash (no payload)
- timestamp, duration, status
- consent state for cloud invocations

The retention default for `ai_tool_runs` is defined in
`../gdpr/data-flow-map.md`.

## Evidence Linkage

The classification of each feature is linked to the evidence
chain (`../../50_runtime/evidence-chain.md`) and to the finding
model (`../../50_runtime/finding-model.md`). A change in
classification MUST be reflected as a finding with category
`compliance.ai-act`.

## Open Items

- Counsel review of high-risk assessment outcomes.
- Conformity assessment template (separate document under
  `30_compliance/ai-act/`).
- Post-market monitoring plan (separate document).
