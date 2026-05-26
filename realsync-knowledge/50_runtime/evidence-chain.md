---
title: Evidence Chain Runtime Specification
owner: runtime
status: draft
sensitivity: internal
review_cycle: monthly
valid_until: 2026-06-30
tags: [runtime, evidence, prüfpfad, provenance, replay]
---

# Evidence Chain Runtime Specification

The evidence chain (Prüfpfad) is the runtime contract that
records every governance-relevant action taken by the RealSync
platform. It is the basis for replay, audit, finding linkage,
and compliance evidence.

## Goals

- Every governance-relevant event is recorded.
- Every event is content-addressable by hash.
- Every event is bound to a tenant and an actor.
- Every event is reproducible (replayable) from stored inputs.

## Event Creation

An event is created at the boundary where the governance-relevant
action is decided or executed. Boundaries that emit events:

| Boundary          | Event types                                             |
|-------------------|---------------------------------------------------------|
| `edge-functions`  | `ai_tool_run`, `workflow_run`, `gdpr_export`, `gdpr_erase`, `policy_evaluation` |
| `postgres`        | `rls_denial` (via trigger), `migration_applied`         |
| `vps-ollama`      | `local_ai_inference` (forwarded to edge for write)      |
| `vps-n8n`         | `workflow_step` (forwarded to edge for write)           |

Events MUST NOT be created in the SPA. The SPA is untrusted for
evidence purposes.

### Event Schema

```yaml
event:
  id:              # ULID, time-ordered
  tenant_id:       # foreign key, RLS scope
  actor:           # user_id | service_id | system
  feature_id:      # references AI feature inventory, when applicable
  boundary:        # source boundary identifier
  type:            # event type from the table above
  occurred_at:     # ISO-8601 with timezone, source clock
  recorded_at:     # ISO-8601 with timezone, write clock
  input_hash:      # SHA-256 of canonicalised input
  output_hash:     # SHA-256 of canonicalised output (nullable)
  references:      # list of evidence references (see below)
  signature:       # detached signature over the canonical event
  prev_hash:       # SHA-256 of the previous event in the chain
```

The chain is per-tenant. `prev_hash` references the previous
event for the same tenant.

## Hash Generation

- Inputs and outputs are canonicalised before hashing using
  RFC 8785 (JSON Canonicalization Scheme).
- Binary payloads are hashed directly; the resulting hex digest
  is included in the canonical JSON.
- Hashing algorithm: SHA-256.
- The canonical hash of the event itself excludes the
  `signature` field and includes `prev_hash`.

## Evidence References

`references` is a list of typed pointers to external artefacts:

| Type             | Target                                                |
|------------------|-------------------------------------------------------|
| `storage`        | `storage` bucket path + object hash                   |
| `c2pa`           | C2PA assertion hash                                   |
| `db`             | Postgres row reference (table, primary key)           |
| `external`       | Subprocessor reference (vendor, request id)           |
| `prev_event`     | Earlier event id in the same chain                    |

References are opaque to the chain. Resolution and access
control are the responsibility of the consuming system.

## Signature Strategy

- Signatures use Ed25519.
- Keys are tenant-scoped or platform-scoped depending on event
  type. Platform-scoped keys sign cross-tenant events
  (e.g. `migration_applied`).
- Active signing keys are stored in the edge-function secret
  store. Public keys are exposed via a versioned key manifest.
- Key rotation cadence: quarterly for active keys; immediate on
  suspected compromise (`S0` / `S1` incident).
- Rotation produces a new key id; old public keys remain
  published indefinitely to allow verification of historical
  events.

## Replay Logic

Replay is the ability to reconstruct the decision and output of
an event from its recorded inputs.

| Event type            | Replayable? | Replay source                                      |
|-----------------------|-------------|----------------------------------------------------|
| `ai_tool_run` (local) | yes         | model id + version + canonical input              |
| `ai_tool_run` (cloud) | best-effort | provider version may drift; recorded provider id  |
| `workflow_run`        | yes         | workflow definition snapshot + canonical input    |
| `gdpr_export`         | yes         | aggregation query is deterministic over snapshot  |
| `gdpr_erase`          | partial     | anonymisation is one-way; replay only confirms it |
| `policy_evaluation`   | yes         | policy snapshot + canonical input                 |
| `rls_denial`          | no          | denial is a runtime fact, not a re-derivable result |

A replay tool MUST validate:

1. `input_hash` matches the canonicalised replay input.
2. `prev_hash` matches the chain.
3. `signature` verifies against the published key manifest.
4. For replayable types, the re-derived output hash matches
   `output_hash`.

A discrepancy at any step is itself a finding (see
`finding-model.md`).

## Report Linkage

Reports are derived projections over the evidence chain. A report
is described by:

- a query window (start event, end event, or time range);
- a filter (event types, features, tenants);
- a projection (aggregation, anonymisation level).

Every report includes the hash of the event range it covers.
Re-running the same report over the same range MUST produce the
same hash.

Findings (see `finding-model.md`) reference reports by report
hash. A finding survives the regeneration of a report as long as
the underlying event range is unchanged.

## Open Items

- Key manifest publication endpoint and signing.
- Replay tool CLI specification.
- Cross-tenant aggregation rules for platform-scoped reports.
