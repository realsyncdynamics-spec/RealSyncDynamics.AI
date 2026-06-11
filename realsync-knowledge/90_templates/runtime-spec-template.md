---
title: <Runtime component> Runtime Specification
owner: runtime
status: draft
sensitivity: internal
review_cycle: monthly
valid_until: <YYYY-MM-DD>
tags: [runtime, specification, <component>]
---

# <Runtime component> Runtime Specification

State the runtime contract for the component. A runtime
specification is binding: code that deviates from it is a finding
of category `policy.violation` or `evidence.gap` depending on
the deviation.

## Goals

- Goal 1
- Goal 2

## Inputs

| Input | Source | Shape | Canonicalisation |
|-------|--------|-------|------------------|
|       |        |       |                  |

## Outputs

| Output | Sink | Shape | Hash strategy |
|--------|------|-------|---------------|
|        |      |       |               |

## Invariants

Each invariant must be verifiable at runtime or by replay.

- Invariant 1 — verification method
- Invariant 2 — verification method

## Event Emission

Which events does this component emit into the evidence chain
(`../50_runtime/evidence-chain.md`)?

| Event type | Trigger | Boundary | References |
|------------|---------|----------|------------|
|            |         |          |            |

## Failure Modes

| Failure mode | Detection | Finding category |
|--------------|-----------|------------------|
|              |           |                  |

## Replay

Is this component replayable from recorded inputs? If partially
replayable, define which derivations are reproducible and which
are not.

## Performance Bounds

| Metric | Target | Hard limit |
|--------|--------|------------|
|        |        |            |

## Open Items

- Item 1
- Item 2
