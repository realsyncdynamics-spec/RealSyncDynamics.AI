---
title: Documentation Style Guide
owner: governance
status: active
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-12-31
tags: [style, governance, tone, vocabulary]
---

# Documentation Style Guide

This guide defines the binding rules for tone, vocabulary, and
structure inside the RealSync Knowledge repository. It applies to
every document, every section, and every commit message that
touches a document body.

## Scope

- Markdown documents under `realsync-knowledge/`.
- Templates in `90_templates/`.
- Frontmatter values across the repository.

## Frontmatter Schema

Every document MUST start with the following YAML block. Field
order is fixed for diff readability.

```yaml
---
title:            # short, declarative, no marketing terms
owner:            # role or team accountable for accuracy
status:           # draft | active | deprecated | archived
sensitivity:      # public | internal | confidential
review_cycle:     # monthly | quarterly | yearly
valid_until:      # YYYY-MM-DD
tags:             # YAML list, lowercase, hyphen-separated
---
```

### Allowed Values

`status`
- `draft` — work in progress, not yet authoritative
- `active` — current source-of-truth
- `deprecated` — superseded, kept for traceability
- `archived` — frozen, moved to `99_archive/`

`sensitivity`
- `public` — safe for external publication (rare in this repo)
- `internal` — default; visible only to RealSync personnel
- `confidential` — restricted; excluded from RAG ingestion

`review_cycle`
- `monthly` — runtime specifications, live incident playbooks
- `quarterly` — architecture, compliance, security processes
- `yearly` — company-level context, archived references

## Tone Rules

The repository tone is operational, technical, and deterministic.
Documents describe what is, how it works, and how it is verified.
They do not persuade, sell, or claim outcomes that cannot be
evidenced.

### Prohibited Language

The following phrasing is forbidden anywhere in this repository.
Pull requests containing such phrasing must be rejected.

- "fully compliant"
- "military-grade"
- "bank-grade", "enterprise-grade" (when used as marketing)
- "world-class", "best-in-class"
- "unhackable", "unbreakable", "100% secure"
- "AI-powered" (as a hype qualifier; describe the model and use)
- "trusted by [customers]" without a verifiable source
- Invented customer names, logos, testimonials
- Invented certifications (ISO, SOC 2, etc.) without an issuing
  body, certificate number, and validity date

### Preferred Vocabulary

Use deterministic, falsifiable wording:

| Use this                          | Instead of                       |
|-----------------------------------|----------------------------------|
| evidence-based                    | trusted                          |
| cryptographically verifiable      | secure, tamper-proof             |
| runtime-observable                | transparent                      |
| replayable                        | auditable (when imprecise)       |
| tenant-scoped                     | secure-by-design                 |
| policy-evaluated                  | AI-governed                      |
| logged in `ai_tool_runs`          | tracked                          |
| signed with key `K` (algo `A`)    | digitally signed                 |
| RLS-protected                     | access-controlled                |

German operational terms (per project convention):

| German term         | Used for                                          |
|---------------------|---------------------------------------------------|
| Prüfpfad            | audit trail (replayable evidence chain)           |
| Herkunftsnachweis   | provenance (C2PA-aligned artefact lineage)        |

Either language is acceptable within a document, but a single
document should not mix both freely; pick one and stay consistent.

## Structural Rules

- Use ATX headings (`#`, `##`, …). Do not skip levels.
- One H1 per document, matching the frontmatter `title`.
- Paragraphs are short. Lists are flat where possible.
- Tables are preferred for enumerations of fields, severities,
  states, or mappings.
- Code blocks are fenced with language hints (`yaml`, `bash`,
  `sql`, `ts`, `json`).

## Cross-References

- Use relative paths: `../50_runtime/evidence-chain.md`.
- Do not link to external URLs that are not stable references
  (regulation texts, RFCs, vendor docs are acceptable).
- Do not duplicate content. Link to the source-of-truth document.

## Examples

### Acceptable

> The evidence chain emits one signed event per workflow run.
> Each event is hashed with SHA-256 and stored in `ai_tool_runs`
> with the tenant scope. The signature key is rotated quarterly
> (see `40_security/incident-response.md`).

### Not Acceptable

> Our military-grade evidence chain delivers world-class
> auditability and is trusted by leading enterprises.

The first example is verifiable, scoped, and points to a process.
The second is hype, unverifiable, and would be rejected.

## Commit Messages

Documentation commits use the prefix `docs(knowledge):`. The
subject line states the document touched and the nature of the
change, not the reason. Reasons belong in the pull request
description.
