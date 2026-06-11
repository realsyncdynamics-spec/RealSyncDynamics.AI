---
title: Finding Model Runtime Specification
owner: runtime
status: draft
sensitivity: internal
review_cycle: monthly
valid_until: 2026-06-30
tags: [runtime, finding, governance, evidence]
---

# Finding Model Runtime Specification

A Finding is a typed, tenant-scoped, evidence-linked statement
that a policy, expectation, or invariant has been violated,
exceeded, or otherwise warrants attention. Findings are the
governance interface between the evidence chain and human
review.

## Finding Entity Schema

```yaml
finding:
  id:              # ULID
  tenant_id:       # RLS scope
  category:        # see category table
  subcategory:     # free string, lowercase, hyphenated
  severity:        # info | low | medium | high | critical
  title:           # short, declarative, no marketing
  description:     # operational description, evidence-based
  status:          # open | acknowledged | mitigated | accepted | closed
  detected_at:     # ISO-8601 with timezone
  detected_by:     # system | scheduled | manual | external
  owner:           # role or user accountable for resolution
  evidence_refs:   # list of evidence chain event ids
  report_refs:     # list of report hashes
  remediation:     # plan, may be empty for `info`
  due_at:          # ISO-8601 date, nullable for `info`
  resolved_at:     # ISO-8601 with timezone, nullable
  resolution:      # short text, evidence-based
```

## Severity Model

| Severity   | Definition                                                              | Default due window |
|------------|-------------------------------------------------------------------------|--------------------|
| `info`     | Observational; no action required, kept for traceability                | none               |
| `low`      | Minor deviation; mitigation expected                                    | 30 days            |
| `medium`   | Noticeable deviation; mitigation required                               | 14 days            |
| `high`     | Material deviation; mitigation required, status reported to leadership  | 5 business days    |
| `critical` | Active or imminent harm; treated as an incident (see `../40_security/incident-response.md`) | 24 hours |

`critical` findings always trigger the incident response flow.
The reverse is not always true — an incident produces a finding,
but a finding does not always produce an incident.

## Categories

| Category             | Description                                                       |
|----------------------|-------------------------------------------------------------------|
| `evidence.integrity` | Hash mismatch, signature failure, broken `prev_hash`              |
| `evidence.gap`       | Missing event where one is required by the runtime contract      |
| `replay.discrepancy` | Replay re-derivation does not match recorded `output_hash`        |
| `policy.violation`   | Policy evaluation failed for a governance-relevant action         |
| `compliance.gdpr`    | DSGVO-relevant deviation (retention, export, erasure)             |
| `compliance.ai-act`  | EU AI Act classification or obligation deviation                  |
| `security.access`    | RLS denial pattern, suspicious authentication                     |
| `security.config`    | Misconfiguration of secrets, keys, or network boundaries          |
| `runtime.outage`     | Availability impact captured as a finding                         |
| `quality.drift`      | Model output quality or output-shape drift                        |

Subcategories are free-form but should be reused across findings
of the same root cause.

## Lifecycle

```
open -> acknowledged -> mitigated -> closed
                    \-> accepted -> closed
```

| Transition                | Required input                                                          |
|---------------------------|-------------------------------------------------------------------------|
| `open → acknowledged`     | `owner` assigned, `remediation` plan present                            |
| `acknowledged → mitigated`| Evidence reference proving the mitigating action (commit hash, event id)|
| `mitigated → closed`      | Verification event from the evidence chain                              |
| `acknowledged → accepted` | Documented risk acceptance with `owner` and expiry date                 |
| `accepted → closed`       | Acceptance expired or risk no longer present                            |

`accepted` is an explicit, time-bounded decision. It is not a
synonym for "ignored" and MUST carry a rationale.

## Mapping to Reports

Reports (`../50_runtime/evidence-chain.md`) reference findings
by id. A report describes:

- which findings are included by category and severity filter;
- the event range over which findings were detected;
- the projection (counts, status breakdown, top categories).

A finding may appear in multiple reports. The finding's identity
is stable; reports are projections.

## Evidence Linkage

Every finding MUST reference at least one event id from the
evidence chain in `evidence_refs`, except for findings created
manually as part of post-incident review (`detected_by:
manual`). Manual findings MUST still carry enough context to be
reconstructed.

Findings without an evidence reference and without manual
provenance are themselves a meta-finding of category
`evidence.gap`.

## Cross-Tenant Considerations

Findings are tenant-scoped. Platform-level findings (for example,
a key rotation that affects all tenants) are stored under the
platform tenant id and projected per-tenant by reports as
needed.

## Open Items

- Finding ingestion API (edge function endpoint).
- Automatic finding generation from `policy_evaluation` events.
- Acceptance-expiry sweeper job.
