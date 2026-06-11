---
title: RAG Ingestion Specification
owner: governance
status: draft
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-08-31
tags: [rag, ingestion, retrieval, lifecycle]
---

# RAG Ingestion Specification

Contract for ingesting RealSync Knowledge documents into a
Retrieval-Augmented-Generation pipeline. The pipeline itself is
out of scope; this document defines what is ingestible, how it
is chunked, and how lifecycle changes propagate.

## Ingestible Document Set

A document is ingestible if and only if all of the following
hold:

- It lives under `realsync-knowledge/`.
- It has valid frontmatter per `../docs-style-guide.md`.
- `status` is `active`.
- `sensitivity` is `public` or `internal`.
- `valid_until` is in the future.
- It is not under `99_archive/`.

Documents that fail any condition MUST be excluded by the
ingestion job and a finding of category `evidence.gap` SHOULD be
generated when a document declared `active` fails one of the
other conditions.

## Prohibited Documents for Ingestion

The following documents and categories MUST NEVER be ingested,
regardless of frontmatter:

- Any document with `sensitivity: confidential`.
- Any document under `99_archive/`.
- Any document under a folder explicitly listed in the ingestion
  exclusion list (managed in the ingestion job configuration,
  not in this repository).
- Documents containing live secrets or credentials, even if such
  content was committed in error — the document is excluded and
  treated as an `S1` incident per
  `../40_security/incident-response.md`.

## Handling of Confidential Documents

`sensitivity: confidential` documents are stored in this
repository for traceability but are not ingested. The ingestion
job MUST verify the sensitivity field of every document on every
run and MUST refuse to upgrade a document's effective
sensitivity at retrieval time.

If a confidential document must be exposed to RAG for a specific
operator workflow, a redacted derivative document is created
under the same folder with `sensitivity: internal` and an
explicit reference to the source.

## Chunking Strategy

| Parameter      | Default     | Range            |
|----------------|-------------|------------------|
| Chunk size     | 450 tokens  | 300–600 tokens   |
| Overlap        | 75 tokens   | 50–100 tokens    |
| Splitter       | semantic with heading boundaries | — |
| Maximum chunk size | 800 tokens (hard limit) | — |

Heading boundaries are preferred over token boundaries: a chunk
should not span two H2 sections except as overlap. Tables are
not split mid-row. Code blocks are not split mid-block; if a
code block exceeds the maximum chunk size, the surrounding
chunks include a pointer instead of the code.

## Metadata Extraction

Every chunk inherits the following metadata fields, extracted
from the document frontmatter:

| Field          | Source              | Required |
|----------------|---------------------|----------|
| `doc_id`       | repository path     | yes      |
| `doc_title`    | frontmatter `title` | yes      |
| `owner`        | frontmatter `owner` | yes      |
| `status`       | frontmatter         | yes      |
| `sensitivity`  | frontmatter         | yes      |
| `review_cycle` | frontmatter         | yes      |
| `valid_until`  | frontmatter         | yes      |
| `tags`         | frontmatter         | yes      |
| `section_path` | nearest H1/H2/H3 chain | yes   |
| `chunk_index`  | sequential within doc | yes    |
| `commit_sha`   | git commit of ingestion source | yes |

## Tagging Conventions

- Tags are lowercase, hyphen-separated.
- Tags are stable: a tag is renamed by a single migration commit
  across all affected documents, not piecemeal.
- A document carries no more than 8 tags.
- Reserved tags: `archived`, `confidential`, `do-not-ingest`.

## Document Lifecycle

Lifecycle events propagate to the ingestion job as follows:

| Lifecycle event                | Action by ingestion job              |
|--------------------------------|--------------------------------------|
| New `active` document          | Index on next run                    |
| `draft → active`               | Index on next run                    |
| `active → deprecated`          | Remove from index; keep doc_id for reference resolution |
| `* → archived`                 | Remove from index                    |
| Frontmatter change             | Re-index full document               |
| Body change                    | Re-index affected chunks (delta)     |
| `valid_until` passed           | Mark stale; see below                |

## Stale Document Detection

A document is stale when:

- `valid_until` is in the past, and
- `status` is still `active`.

Stale documents:

1. Are excluded from new retrieval results.
2. Trigger a finding of category `compliance.gdpr` or
   `quality.drift` depending on the document folder.
3. Remain in the repository until the owner refreshes or
   archives them.

## Retrieval Ranking Hints

The ingestion job stores the following hints with each chunk for
the retriever to use:

| Hint                | Meaning                                                |
|---------------------|--------------------------------------------------------|
| `freshness_weight`  | inverse of age since last commit                       |
| `criticality_weight`| higher for `50_runtime/`, `40_security/`, `30_compliance/` |
| `sensitivity_floor` | minimum caller clearance required to surface          |
| `cycle_priority`    | higher for `monthly` cycle documents                  |

The retriever is responsible for combining hints with semantic
similarity. The ingestion job does not rank, it only annotates.

## Validation Rules

Every ingestion run MUST validate:

- Frontmatter present and well-formed.
- Required fields populated with allowed enum values.
- No reserved tags applied incorrectly (`do-not-ingest` on an
  `active` document is a hard fail).
- Cross-references resolve to existing documents.

Validation failures produce a finding of category
`evidence.integrity` referencing the affected commit.

## Open Items

- Embedding model selection (separate decision document under
  `20_architecture/`).
- Retriever scoring formula and evaluation harness.
- Periodic full re-ingestion cadence and trigger.
