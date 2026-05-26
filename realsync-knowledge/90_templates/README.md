---
title: Templates Folder Index
owner: governance
status: active
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-12-31
tags: [index, templates]
---

# 90_templates

Canonical templates for new documents in the RealSync Knowledge
repository. Every new document MUST start from one of these
templates.

| Template                       | Use for                                       |
|--------------------------------|-----------------------------------------------|
| `architecture-template.md`     | System or subsystem architecture              |
| `compliance-template.md`       | Regulation / obligation mapping               |
| `incident-template.md`         | Post-incident records                         |
| `runtime-spec-template.md`     | Runtime contracts under `50_runtime/`         |
| `deployment-template.md`       | Deployment playbooks under `60_playbooks/`    |
| `product-template.md`          | Product fact sheets under `10_products/`      |

Template invariants:

- Frontmatter present and complete.
- Required section structure defined and documented.
- No marketing language; operational tone only.
- Designed to chunk cleanly for RAG ingestion (see
  `../80_rag/rag-ingestion-spec.md`).

A change to a template is a controlled change: existing
documents based on the template do not retroactively change,
but new documents adopt the new structure from the change date
forward.
