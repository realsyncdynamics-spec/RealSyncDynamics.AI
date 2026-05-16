# Runtime Spec — CHANGELOG

All notable changes to the RealSync Runtime specification suite are listed here. Spec versions are immutable once published; errata against a published version go in this file referencing the unchanged spec text.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). MAJOR/MINOR follow each individual spec's versioning rules (see README §Versioning).

---

## [Unreleased]

Nothing yet.

---

## v1.1 — 2026-05-16

Backwards-compatible MINOR bump. Adds three optional manifest blocks on the agent contract and two optional fields on the CPS isolation block. A v1.0 manifest remains conformant under v1.1; the new fields default to safe behaviour when omitted.

### Standards introduced at v1.1

| Spec | File | Version | Purpose |
|---|---|---|---|
| Evidence Coupling | [`evidence-coupling.md`](evidence-coupling.md) | 1.0 | Per-agent evidence obligation (`mandatory` / `optional` / `linked` / `forbidden`) |
| Escalation Matrix | [`escalation-matrix.md`](escalation-matrix.md) | 1.0 | Per-severity-tier behaviour (`auto_continue` / `triage_required` / `human_review_required`, `runtime_freeze_possible` for critical) |
| Output Constraints | [`output-constraints.md`](output-constraints.md) | 1.0 | Per-agent output shape + validation (`format`, `schema_validation`, `confidence_score`, `template_locked`, `hallucination_sensitive`) |

### Existing standards revised at v1.1

| Spec | File | Old → New | Change |
|---|---|---|---|
| Agent Contract | [`agent-contract.md`](agent-contract.md) | 1.0 → 1.1 | New §9 — registers the three v1.1 blocks above as optional manifest fields. v1.1 also defines cross-block consistency rules the registry MUST enforce at registration. |
| Capability & Permission | [`capability-permission-standard.md`](capability-permission-standard.md) | 1.0 → 1.1 | New §9 — extends `isolation` block with `pii_access` (`none` / `minimised` / `scoped` / `full`) and `cross_tenant_visibility` (`forbidden` / `aggregate_only` / `full`). |

### JSON Schemas added at v1.1

- `schemas/evidence-coupling.schema.json`
- `schemas/escalation-matrix.schema.json`
- `schemas/output-constraints.schema.json`

### JSON Schemas updated at v1.1 (backwards-compatible additive changes)

- `schemas/agent-contract.schema.json` — adds optional `evidence_coupling`, `escalation_matrix`, `output_constraints` (each via `$ref` to its dedicated schema).
- `schemas/capability.schema.json` — adds optional `isolation.pii_access`, `isolation.cross_tenant_visibility`.

### Reference implementation status at v1.1

| Spec | Implemented in | Conformance |
|---|---|---|
| EVC | `src/runtime/agents/developerRemediationAgent.contract.ts` (PR #264) declares `evidence_coupling: { mode: 'linked' }` | partial (declaration only; runtime enforcement Phase B) |
| EM  | Same contract declares `escalation_matrix` per-tier | partial (declaration only) |
| OC  | Same contract declares `output_constraints: { format: 'strict_json', ... }` | partial (declaration only) |
| ACS v1.1 | Same contract declares `spec_version: '1.1'` and the three new blocks | declaration-conformant |
| CPS v1.1 | None yet — `pii_access` and `cross_tenant_visibility` need to be added to existing agent manifests as a follow-up | not yet |

### Backwards-compatibility guarantee

A consumer that reads only the v1.0 fields **MUST** continue to function correctly when reading a v1.1 manifest. The MINOR bump enforces that:

- All v1.1 additions are **optional** at the schema level.
- Defaults for omitted v1.1 fields are documented in the respective spec sections (ACS §9a, CPS §9a/§9b).
- A v1.0 consumer reading a v1.1 manifest **MUST** ignore unknown fields (per ESS §6 / README §Versioning).

---

## v1.0 — 2026-05-15

Initial publication of the seven-standard suite.

### Standards introduced at v1.0

| Spec | File | Version |
|---|---|---|
| Event Specification | [`event-specification.md`](event-specification.md) | 1.0 |
| Agent Contract | [`agent-contract.md`](agent-contract.md) | 1.0 |
| Runtime Context | [`runtime-context.md`](runtime-context.md) | 1.0 |
| Evidence Chain | [`evidence-chain.md`](evidence-chain.md) | 1.0 |
| Human Review Protocol | [`human-review-protocol.md`](human-review-protocol.md) | 1.0 |
| Capability & Permission | [`capability-permission-standard.md`](capability-permission-standard.md) | 1.0 |
| Runtime Policy | [`policy-specification.md`](policy-specification.md) | 1.0 |

### JSON Schemas introduced at v1.0

- `schemas/event.schema.json` — ESS event envelope
- `schemas/agent-contract.schema.json` — ACS manifest
- `schemas/runtime-context.schema.json` — RCS envelope
- `schemas/evidence-chain.schema.json` — ECS chain link
- `schemas/capability.schema.json` — CPS `capability` block
- `schemas/policy.schema.json` — RPS policy document

### Reference implementation status at v1.0

| Spec | Implemented in | Conformance |
|---|---|---|
| ESS | `services/realsync-runtime-core/src/consumers/event.consumer.js` | partial (envelope fields not yet enforced) |
| ACS | `services/realsync-runtime-core/src/services/agent.service.js` | partial (registry exists, manifest schema not yet enforced) |
| RCS | `services/realsync-runtime-core/src/routes/auth.js` | partial (forward-auth issues `X-Tenant-ID`, full envelope not yet materialised) |
| ECS | `services/realsync-evidence-runtime/src/services/evidence.service.js` | partial (hash chain present, `previous_hash` link not yet wired) |
| HRP | `supabase/functions/governance-agent/index.ts` (anon-mode rate-limit only) | not yet |
| CPS | – | not yet |
| RPS | `services/realsync-runtime-core/src/services/policy.service.js` (toy rule engine) | not yet |

Conformance gaps are the explicit roadmap of the Phase-B implementation work.

### Glossary

The initial glossary is published in [`glossary.md`](glossary.md). The deprecated-terms table is normative: future spec text **MUST NOT** use the listed non-preferred forms.

---

## Conventions for future entries

- Patch-level errata: a published spec at `MAJOR.MINOR` is **immutable**. An errata is documented here as e.g. `### Errata against ESS v1.0` with a date, the affected section, and a non-textual clarification (no change to the spec file).
- Spec extensions: a new minor version `MAJOR.(MINOR+1)` adds backwards-compatible fields and operators. The previous file is renamed to `event-specification-v1.0.md` and the current file becomes the new minor version.
- Breaking changes: a new major version creates a parallel directory (`spec/runtime/v2/`) so consumers can negotiate. The v1 tree remains for the duration of the longest active retention period.
