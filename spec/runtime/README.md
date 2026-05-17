# RealSync Runtime — Specification Suite

**Status:** Draft v1.1 — published 2026-05-16 (extends v1.0 of 2026-05-15)
**Audience:** Platform engineers, integrators, agencies, auditors, certifiers, investors.

This directory defines the **formal contracts** that govern how every component of the RealSync runtime communicates. Anything that produces or consumes a runtime event — whether it lives inside the platform (`realsync-runtime-core`, `realsync-evidence-runtime`, the Supabase Edge Function fleet) or outside of it (DATEV connectors, OCR pipelines, customer-owned agents) — is bound by these standards.

The premise:

> RealSync does not "do compliance". RealSync **standardises governance events** so that compliance becomes a property of the event substrate, not of any one feature.

---

## The ten standards

Core (v1.0):

| | Standard | Abbrev | Purpose |
|---|---|---|---|
| 1 | [Event Specification](event-specification.md) | **ESS** | Wire format of every event on the runtime. |
| 2 | [Agent Contract](agent-contract.md) | **ACS** | Declarative manifest every agent ships with — inputs, outputs, permissions, runtime context. (v1.1: three additional optional manifest blocks — see §9 of ACS.) |
| 3 | [Runtime Context](runtime-context.md) | **RCS** | The tenant- and request-scoped envelope a handler always sees. Closes hallucination, leak and mis-routing classes. |
| 4 | [Evidence Chain](evidence-chain.md) | **ECS** | Hash-chained, append-only audit substrate. Defines `previous_hash` / `current_hash` semantics. |
| 5 | [Human Review Protocol](human-review-protocol.md) | **HRP** | When AI may decide, when it may only prepare, when a human reviewer is mandatory. AI Act-relevant. |
| 6 | [Capability & Permission](capability-permission-standard.md) | **CPS** | Per-agent allow-list, deny-list, escalation rules, runtime isolation, and the six Trust Levels (L0–L5). Security backbone. (v1.1: `pii_access` + `cross_tenant_visibility` extensions to `isolation` — see §9 of CPS.) |
| 7 | [Runtime Policy](policy-specification.md) | **RPS** | Machine-readable governance policies — `guard`, `retention`, `classification`, `escalation`. Tenant-scoped, versioned, evaluable. |

v1.1 additions (referenced from ACS §9):

| | Standard | Abbrev | Purpose |
|---|---|---|---|
| 8  | [Evidence Coupling](evidence-coupling.md) | **EVC** | Per-agent declaration of evidence obligation — `mandatory`, `optional`, `linked`, `forbidden`. |
| 9  | [Escalation Matrix](escalation-matrix.md) | **EM**  | Per-agent severity-tier behaviour — `auto_continue`, `triage_required`, `human_review_required`, `runtime_freeze_possible`. |
| 10 | [Output Constraints](output-constraints.md) | **OC**  | Per-agent output shape and validation — `format`, `schema_validation`, `confidence_score`, `template_locked`, etc. |

Machine-readable JSON Schemas live in [`schemas/`](schemas/). Versioning is documented in [`CHANGELOG.md`](CHANGELOG.md). Terminology — and only the terminology — is fixed in [`glossary.md`](glossary.md).

---

## Conformance language (RFC 2119)

Each spec uses **MUST / MUST NOT / SHOULD / SHOULD NOT / MAY** in the [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) sense, capitalised. Statements outside these keywords are informative and **NOT normative**.

A component is **conformant** with a given spec at a given version when it satisfies every MUST and MUST NOT clause in that version. SHOULD clauses are strongly recommended but a documented deviation is acceptable. MAY clauses describe optional surface area.

---

## Versioning

- Spec versions follow `MAJOR.MINOR`.
- A new MAJOR version **MAY** break wire compatibility. Producers and consumers negotiate via the `spec_version` field on every event, agent manifest and context envelope.
- A new MINOR version **MUST** be backwards-compatible: a v1.0 consumer reading v1.x payloads must remain conformant.
- Specs are immutable once published. Errata go in `CHANGELOG.md` referencing the unchanged published spec.

---

## Scope boundaries

These standards govern:

- ✅ The runtime event substrate (the wire).
- ✅ Agent interfaces (the inputs and outputs).
- ✅ Evidence-grade audit (the immutable history).
- ✅ Human-in-the-loop boundaries (the AI-Act surface).

They deliberately do **NOT** govern:

- ❌ UI / UX of the consumer dashboard.
- ❌ Business pricing / packaging / plans.
- ❌ Storage choice (Postgres vs. ClickHouse vs. S3) — the spec defines a wire, not a backend.
- ❌ Provider choice for any specific LLM / OCR / payment integration.

The runtime is a substrate. The product is the substrate plus its integrations. The specs only constrain the substrate.

---

## How the standards relate at runtime

```
                  ┌──────────────────────────────────────────────────┐
                  │            Runtime Context (RCS)                 │
                  │  tenant, region, gdpr_mode, ai_act_profile, …    │
                  └──────────────────────────────────────────────────┘
                                       │ envelope on every call
                                       ▼
   ┌──────────────┐  emits event  ┌──────────────┐  consumed by  ┌─────────────────┐
   │   Producer   │ ───(ESS)────▶ │   Event Bus  │ ───(ESS)────▶ │   Consumer      │
   └──────────────┘               └──────────────┘               └─────────────────┘
          │                              │                              │
          │ manifest = ACS + CPS         │ Policy Engine evaluates      │ manifest = ACS + CPS
          ▼                              │ matching RPS policies        ▼
       ┌────────────┐                    │     (guard, retention,    ┌────────────┐
       │ ACS + CPS  │                    │      classification,      │ ACS + CPS  │
       │ Trust Lvl  │                    │      escalation)          │ Trust Lvl  │
       └────────────┘                    │                           └────────────┘
                                         ▼
                  ┌──────────────────────────────────────────────────┐
                  │       Evidence Chain Specification (ECS)         │
                  │  append-only, hash-linked, immutable audit       │
                  └──────────────────────────────────────────────────┘

       Any event whose `compliance.human_review.required = true` OR which
       triggers an RPS policy with action `require_human_review` enters
       the Human Review Protocol (HRP) before its automation effects fire.
```

### Nesting of security gates

The three security specs (CPS, RPS, HRP) nest deliberately, from narrowest to broadest:

```
       per-agent (CPS)
          per-tenant (RPS)
             per-AI-Act-decision (HRP)
```

- **CPS** bounds *what an agent can do* (`permissions`, `restrictions`, `escalation_rules`, `isolation`, `trust_level`).
- **RPS** bounds *what a tenant lets happen* (`conditions` → `actions`, evaluated at every event).
- **HRP** bounds *what may be automated under the AI Act* (decision-equivalent events require human approval).

An action that passes all three gates is the runtime's tightest security trace.

---

## Reference implementations

These specs are not vapourware. The following components implement them in this repository:

| Service | Implements | Notes |
|---|---|---|
| `services/realsync-runtime-core/` | ESS producer, RCS forward-auth, ACS agent registry | NATS bus, Postgres registry |
| `services/realsync-evidence-runtime/` | ECS append-only chain, ESS consumer | hash chain in `audit_stream`, content-hash on `evidence_records` |
| `supabase/functions/governance-agent/` | HRP-aware tool use | tool calls flag `human_review.required` when entering decision branches |

A component is welcome to implement a spec without using any of the reference code. The wire is the contract.

---

## Reading order

For a first pass, read in this order:

1. **Glossary** — fix the vocabulary.
2. **Event Specification (ESS)** — the wire.
3. **Runtime Context (RCS)** — what every handler sees.
4. **Evidence Chain (ECS)** — why a hash matters.
5. **Agent Contract (ACS)** — how a producer or consumer declares itself.
6. **Capability & Permission (CPS)** — what each agent can and cannot do, plus the six Trust Levels.
7. **Evidence Coupling (EVC)** — which agents must seal, which may, which must not.
8. **Escalation Matrix (EM)** — per-severity behaviour: continue / triage / review / freeze.
9. **Output Constraints (OC)** — output shape, schema validation, confidence, template-lock.
10. **Runtime Policy (RPS)** — machine-readable governance policies.
11. **Human Review Protocol (HRP)** — the AI Act boundary.
