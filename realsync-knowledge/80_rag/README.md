---
title: RAG Folder Index
owner: governance
status: active
sensitivity: internal
review_cycle: quarterly
valid_until: 2026-12-31
tags: [index, rag]
---

# 80_rag

Retrieval-Augmented-Generation contracts. Documents here define
the rules under which RealSync Knowledge content is ingested,
retrieved, and surfaced.

| Document                | Contract                                     |
|-------------------------|----------------------------------------------|
| `rag-ingestion-spec.md` | Ingestible set, chunking, lifecycle, hints   |

The folder does not contain ingestion pipeline implementation
code or model configuration — those live in service repositories
and reference this folder as the contract source.
