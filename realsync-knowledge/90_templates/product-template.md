---
title: Product — <Product name>
owner: product
status: draft
sensitivity: internal
review_cycle: quarterly
valid_until: <YYYY-MM-DD>
tags: [product, <product-slug>]
---

# Product — <Product name>

Technical fact sheet for <product>. Operational description
only. No marketing copy, no roadmap commitments, no customer
references.

## Purpose

What does this product do, in operational terms? Who is the
intended operator or user role?

## Boundaries

Which boundaries from `../30_compliance/gdpr/data-flow-map.md`
does this product touch?

| Boundary | Role in this product |
|----------|----------------------|
|          |                      |

## Features

Stable feature list. Each feature references its architecture
document under `../20_architecture/` and its AI-Act
classification under `../30_compliance/ai-act/risk-classification.md`
if applicable.

| Feature id | Name | Architecture doc | AI Act classification |
|------------|------|------------------|------------------------|
|            |      |                  |                        |

## Data

What tenant data does this product produce, consume, or store?

| Category | Direction | Storage | Retention |
|----------|-----------|---------|-----------|
|          |           |         |           |

## Evidence

Which event types in `../50_runtime/evidence-chain.md` are
emitted by this product? Which finding categories are most
common in operation?

## Dependencies

| Dependency | Type | Boundary | Failure impact |
|------------|------|----------|----------------|
|            |      |          |                |

## Operational SLOs

| Metric | Target | Measurement source |
|--------|--------|--------------------|
|        |        |                    |

SLOs are operational targets and not commercial commitments.

## Open Items

- Item 1
- Item 2
