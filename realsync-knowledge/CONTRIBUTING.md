---
title: Contributing to RealSync Knowledge
owner: governance
status: active
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-12-31
tags: [contributing, process, governance]
---

# Contributing

This document defines the contribution process for the RealSync
Knowledge repository. It applies to every Markdown document, every
template, and every change to the directory structure.

## Principles

- One document, one purpose.
- One pull request, one scoped change.
- Every document starts from a template in `90_templates/`.
- Every document carries frontmatter and an owner.
- No external publication, no customer-facing copy, no hype.

## Contribution Steps

1. **Identify the correct folder.** If the document does not fit any
   existing folder, propose a structure change in a separate pull
   request before adding content.
2. **Pick a template.** Copy the relevant file from `90_templates/`
   as the starting point. Templates define the required sections.
3. **Fill the frontmatter.** All seven fields are required. Use the
   allowed enum values exactly as defined in `docs-style-guide.md`.
4. **Write the body.** Follow the section structure of the template.
   Do not remove required sections — mark them `N/A` with a reason
   if they genuinely do not apply.
5. **Cross-link evidence.** Reference related documents by relative
   path. Do not duplicate content.
6. **Open a pull request.** Title prefix: `docs(knowledge):`.
   Description must state purpose, affected folders, and review
   cadence.

## Review Checklist

A reviewer must verify, in order:

- [ ] Frontmatter present and valid.
- [ ] `owner` is a real, contactable role or team.
- [ ] `sensitivity` classification matches the content.
- [ ] `valid_until` is set and realistic.
- [ ] Required sections of the chosen template are present.
- [ ] No hype, no unverifiable claims (see `docs-style-guide.md`).
- [ ] No customer names, no invented certifications.
- [ ] Cross-references resolve to existing files.
- [ ] If `sensitivity: confidential`, the document is flagged for
      exclusion from RAG ingestion per `80_rag/rag-ingestion-spec.md`.

## Document Lifecycle

| Transition         | Trigger                                              |
|--------------------|------------------------------------------------------|
| `draft → active`   | Reviewed and approved by `owner` + one peer reviewer |
| `active → deprecated` | Superseded by a newer document, link to successor |
| `deprecated → archived` | Moved to `99_archive/`, frontmatter updated     |
| `* → archived`     | Past `valid_until` with no review                    |

Archived documents are retained for traceability and are excluded
from RAG ingestion.

## Naming Conventions

- Lowercase, hyphen-separated filenames: `incident-response.md`.
- No dates in filenames — use frontmatter for versioning context.
- Folder prefixes (`00_`, `10_`, …) define a stable read order; do
  not renumber existing folders without an explicit migration plan.

## Frontmatter Validation

Future tooling will validate frontmatter on pull request. Until
then, contributors must validate manually against the schema in
`docs-style-guide.md`.

## Out of Scope

The following content does NOT belong in this repository:

- Marketing copy, slogans, taglines
- Customer success stories, testimonials
- Public-facing landing-page content
- Pricing pages
- Invented certifications or compliance claims
- Internal personnel data (HR, payroll, contracts)
- Credentials, API keys, secrets of any kind

If a contribution contains any of the above, the pull request must
be closed and the content relocated to the appropriate repository.
