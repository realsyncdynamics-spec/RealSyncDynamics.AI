---
title: RealSync Knowledge Repository
owner: governance
status: active
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-12-31
tags: [overview, governance, repository]
---

# RealSync Knowledge

Internal, versioned, governance-ready knowledge base for the RealSync
ecosystem. This repository is the operational source-of-truth for
architecture, compliance, runtime behaviour, security processes, and
reusable governance intelligence across all RealSync projects.

## What this repository IS

- Operational documentation
- Architecture knowledge
- Compliance knowledge (GDPR, EU AI Act)
- Runtime specifications (evidence chain, finding model, replay)
- Security and incident-response process documentation
- Reusable governance intelligence (templates, playbooks)
- Source corpus for future Retrieval-Augmented-Generation (RAG)

## What this repository is NOT

- Not a marketing site
- Not a public documentation portal
- Not a sales deck
- Not a product-feature repository
- Not a landingpage repository

Anything intended for external publication, customer-facing copy, or
sales narrative belongs in a separate repository and must not be
introduced here.

## Repository Structure

| Folder           | Purpose                                                            |
|------------------|--------------------------------------------------------------------|
| `00_company/`    | Company-level operational context (mission, ownership, locations)  |
| `10_products/`   | Per-product technical fact sheets (no marketing)                   |
| `20_architecture/` | System and subsystem architecture documents                      |
| `30_compliance/` | GDPR, EU AI Act, sub-folders per regulation                        |
| `40_security/`   | Security process, incident response, threat model                  |
| `50_runtime/`    | Runtime specifications: evidence chain, finding model, replay      |
| `60_playbooks/`  | Operational playbooks (deployment, rollback, on-call)              |
| `70_sales/`      | Sales-supporting technical fact sheets (no hype, evidence only)    |
| `80_rag/`        | RAG ingestion spec, retrieval rules, lifecycle handling            |
| `90_templates/`  | Canonical templates for new documents                              |
| `99_archive/`    | Deprecated documents retained for traceability                     |

## Metadata Rules

Every Markdown document MUST start with YAML frontmatter using the
fields defined in `docs-style-guide.md`. Documents without
frontmatter are considered invalid and will be rejected by future
ingestion tooling.

Required fields:

```yaml
---
title:
owner:
status:           # draft | active | deprecated | archived
sensitivity:      # public | internal | confidential
review_cycle:     # monthly | quarterly | yearly
valid_until:      # ISO-8601 date
tags:             # YAML list of strings
---
```

## Review Cycles

Documents are reviewed on the cadence declared in their frontmatter:

- `monthly`   — runtime specifications, active incident playbooks
- `quarterly` — architecture, compliance, security processes
- `yearly`   — company-level operational context, archived references

Documents past their `valid_until` date must be reviewed, refreshed,
or moved to `99_archive/` with `status: archived`.

## Contribution Flow

See `CONTRIBUTING.md`. In short:

1. Create a branch.
2. Add or edit a document using a template from `90_templates/`.
3. Validate frontmatter and required sections.
4. Open a pull request with a single, scoped change.
5. Reviewer checks accuracy, sensitivity classification, and tone.

## Future RAG Integration

The repository is structured for downstream ingestion into a
Retrieval-Augmented-Generation pipeline. The ingestion contract,
chunking strategy, lifecycle rules, and prohibited document classes
are defined in `80_rag/rag-ingestion-spec.md`.

## Tone

Operational, technical, deterministic. No hype, no unverifiable
claims, no marketing language. See `docs-style-guide.md` for the
binding wording rules.
