---
title: Archive Folder Index
owner: governance
status: active
sensitivity: internal
review_cycle: yearly
valid_until: 2026-12-31
tags: [index, archive]
---

# 99_archive

Frozen documents retained for traceability. Documents move here
when:

- They have been superseded by a newer document.
- They have passed their `valid_until` date with no review.
- They are no longer authoritative but must be retained for
  audit or historical reference.

Rules for archived documents:

- `status` MUST be `archived`.
- The frontmatter MUST link to the successor document (if any)
  via a `superseded_by:` field, added at archival time.
- Archived documents are excluded from RAG ingestion (see
  `../80_rag/rag-ingestion-spec.md`).
- Archived documents are NOT edited. Corrections to historical
  content are made by adding an annotation document, not by
  rewriting history.

Archival is a controlled change. A pull request that archives a
document must state why and link to the successor or rationale.
