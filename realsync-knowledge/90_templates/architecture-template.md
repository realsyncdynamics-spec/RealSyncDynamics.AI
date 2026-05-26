---
title: <System or subsystem name>
owner: <role or team>
status: draft
sensitivity: internal
review_cycle: quarterly
valid_until: <YYYY-MM-DD>
tags: [architecture, <subsystem>]
---

# <System or subsystem name>

Short, declarative description of what the system is and what it
is not. Avoid marketing language. State the system in operational
terms.

## Context

What problem does this system solve? Which other systems depend
on it? Which systems does it depend on?

## Boundaries

| Boundary | Description | Trust zone | Hosting |
|----------|-------------|------------|---------|
|          |             |            |         |

## Data

What data does this system handle? Reference
`../30_compliance/gdpr/data-flow-map.md` where applicable. Do
not duplicate category definitions.

| Category | Source | Storage | Retention |
|----------|--------|---------|-----------|
|          |        |         |           |

## Interfaces

Inbound and outbound interfaces. Specify protocol, payload
shape, authentication, and rate expectations.

| Direction | Peer | Protocol | Auth | Notes |
|-----------|------|----------|------|-------|
|           |      |          |      |       |

## Runtime Invariants

Conditions that must hold at runtime. Each invariant must be
verifiable.

- Invariant 1 — verification method
- Invariant 2 — verification method

## Failure Modes

| Failure mode | Detection | Mitigation | Severity (see `../50_runtime/finding-model.md`) |
|--------------|-----------|------------|--------------------------------------------------|
|              |           |            |                                                  |

## Evidence

Which events does this system emit into the evidence chain
(`../50_runtime/evidence-chain.md`)? Which reports does it
produce or consume?

## Open Items

- Item 1
- Item 2
