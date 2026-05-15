# Runtime Spec — CHANGELOG

All notable changes to the RealSync Runtime specification suite are listed here. Spec versions are immutable once published; errata against a published version go in this file referencing the unchanged spec text.

The format is loosely [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). MAJOR/MINOR follow each individual spec's versioning rules (see README §Versioning).

---

## [Unreleased]

Nothing yet.

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
