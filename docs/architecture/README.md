# RealSyncDynamics.AI — Runtime Architecture Index

> Single source of truth for all architecture documents.
> Updated with every architecture PR.

---

## Product Layer Overview

The platform target model has **five layers** — see
[`target-architecture.md`](./target-architecture.md), the canonical target
architecture:

| Layer | Name | Description |
|---|---|---|
| Layer 1 | Customer Experience | `/app` control plane and `/app/siteos` transformation workspace |
| Layer 2 | SiteOS / Control Plane | Digital assets, asset lifecycle, projects, workflows, integrations |
| Layer 3 | Governance Engine | Policy + Evidence + Context + Risk → Decision → Approval → Action |
| Layer 4 | Agent / Automation | Skills, workflows, agents, continuous monitoring, remediation |
| Layer 5 | Infrastructure | Customer systems: website, CMS, GitHub, Cloudflare, CRM, identity, APIs |

The runtime layering used by the documents below is the **inner** view of layers
2–3 and stays valid:

| Runtime Layer | Name | Description |
|---|---|---|
| Layer 1 | Public Conversational Entry | Anonymous governance agent, KI-Pill, AssistentChip |
| Layer 2 | Governance Runtime | RuntimeEvent standard, policy engine, shadow validation, evidence anchoring |
| Layer 3 | Evidence Infrastructure | Evidence Graph, Audit Bundles, Replay, Drift Detection |

---

## Document Registry

| # | File | Title | Layer | Status | Description |
|---|---|---|---|---|---|
| 1 | [`runtime-event-standard.md`](./runtime-event-standard.md) | RuntimeEvent Standard v0 | Layer 2 | `adopted` | Defines the shared event vocabulary: 18 event types, 8 sources, helper `createRuntimeEvent()`. Foundation of all runtime communication. |
| 2 | [`runtime-event-shadow-validation-rfc.md`](./runtime-event-shadow-validation-rfc.md) | Shadow Validation RFC | Layer 2 | `proposed` | Rollout plan for schema validation without breaking existing ingestion. Phase 2a → 2c before strict enforcement. |
| 3 | [`evidence-graph-rfc.md`](./evidence-graph-rfc.md) | Evidence Graph Architecture RFC | Layer 3 | `proposed` | Semantic architecture of the causal governance history graph. Defines 9 node types, 9 relation types, immutability + replay contract. |
| 4 | [`agent-os.md`](./agent-os.md) | Agent OS Architecture | Layer 2 | `experimental` | Phase 0 foundations for the agent operating system: agent lifecycle, tool sandboxing, memory primitives. |
| 5 | [`governance-os-blueprint.md`](./governance-os-blueprint.md) | Governance OS Blueprint v1 | cross | `experimental` | High-level blueprint for the full Governance OS. Describes the three product layers and their interaction model. |
| 6 | [`roadmap.md`](./roadmap.md) | Architecture Roadmap | cross | `adopted` | Phase-by-phase build sequence from RuntimeEvent foundation to Governance Intelligence. |
| 7 | [`runtime-governance-social.md`](./runtime-governance-social.md) | Runtime → Governance → Social | cross | `experimental` | Describes the transition path from compliance scanning to runtime governance to social proof and trust signals. |
| 8 | [`runtime-kernel-rfc.md`](./runtime-kernel-rfc.md) | Operational Governance Kernel v0 | Layer 2 | `proposed` | runtime_events Foundation, Replay Isolation, subject_ref Lifecycle, Memory Decay, tenant_cost_ledger. Master-RFC für den Governance-Runtime-Kernel mit konkreten Schema-Diffs + Code-Stubs. |
| 9 | [`target-architecture.md`](./target-architecture.md) | Zielarchitektur (Plattformmodell) | cross | `adopted` | **Kanonische Zielarchitektur.** Fünf Ebenen, Trennung `/app` ↔ `/app/siteos`, Asset Lifecycle, Continuous Observation, Governance Engine, normativer SiteOS-Publish-Gate-Contract, Truth Layer (keine erfundenen Kennzahlen), AI Gateway statt hart verdrahtetem Provider, Free Baseline auf dem bestehenden `gdpr-audit`-Flow, Skills/Workflows, Integrationen, Pricing-Achsen (BASE + MODULE + SCALE), Delta Ist→Ziel und Phasen A–C. Löst den Produktebenen-Teil von `docs/ARCHITECTURE.md` ab. |
| 10 | [`asset-lifecycle-contract.md`](./asset-lifecycle-contract.md) | Asset Lifecycle Contract (Phase B1) | Layer 2 | `proposed` | Datenvertrag für `Audit → Asset → Findings → Evidence → Subscription → Observation Run`. Legt `governance_assets` als kanonisches Asset fest, `websites` als Projektion, `governance_evidence` als Nachweisquelle der Beobachtung, `scan_runs` als Observation Run und `scan_schedules` als Monitoring-Beziehung. Lifecycle-Zustände werden serverseitig abgeleitet, nie als Statusspalte geführt. Enthält sechs verifizierte Schema-Defekte für B2. |
| 11 | [`agent-runtime-contracts.md`](./agent-runtime-contracts.md) | Agent Runtime Contracts v0.1 | Layer 4 | `proposed` | Gemeinsame Typen für Voice/Chat/WhatsApp: AgentSession, ToolRequest, PolicyDecision (`ALLOW` / `DENY` / `REQUIRE_CONFIRMATION`), Consent, EvidenceEvent, AgentAction. Sitzt über dem bestehenden Gateway (`ok`/`denied`) ohne `evaluate()` zu brechen. Package: `packages/agent-runtime-contracts`. |
| 12 | [`voice-agent-v0.1.md`](./voice-agent-v0.1.md) | Voice Agent v0.1 | Layer 4 | `proposed` | Voice als kontrollierte Agent-Schnittstelle in der Governance Runtime. LLM/STT/TTS schlagen nur vor. Ziel: `voice.realsyncdynamicsai.de` bzw. `/app/voice` — nicht die eingefrorene Public Landing (Baseline `339b08e7`). |
| 13 | [`grok-export-audit.md`](./grok-export-audit.md) | Audit: Grok-Export → RealSyncDynamics.AI | Layer 4 | `adopted` | Gemessener Abgleich des Grok-Prototyps `orbit-dove-quiet-timber` (`185b3bf`) gegen dieses Repo: was von den Contracts bereits portiert ist, welche Governance-Logik fehlt, fünf konkurrierende Policy-Verdict-Modelle, widersprüchliche Genesis-Konvention gegenüber dem Evidence Vault, Namenskollision `agent_sessions`, fehlende Consent-Persistenz. Ergebnis: Übernahme als serverseitige Entscheidungsschicht, null neue Dependencies, Vercel-/Neon-/Better-Auth-Stack wird verworfen. |
| 14 | [`policy-verdict-audit.md`](./policy-verdict-audit.md) | Phase 1 — Policy- und Verdict-Landschaft | Layer 3 | `adopted` | Read-only Bestandsaufnahme aller Policy-Implementierungen mit nachverfolgten Aufrufern und Produktionsstatus: sechs Implementierungen, fünf Vokabulare, Namensfalle `policyEngine.ts` / `policy-engine.ts`, handkopiertes Duplikat ohne Paritätstest. Enthält den Vorschlag für das kanonische Verdict-Mapping (verlustbehaftet bei `warn`/`log` — daher `advisory` + `sourceVerdict`), die Ursache des `/websites`-RLS-Fehlers, eine Tenant-Autorisierungslücke in `website-domain-manager` und die KEEP/ADAPT/REJECT/INTEGRATE-Matrix. |

---

## Status Definitions

| Status | Meaning |
|---|---|
| `adopted` | Implemented and active in production code |
| `proposed` | RFC under review — not yet implemented |
| `experimental` | Implemented but not production-stable |
| `deprecated` | Superseded by a newer document |
| `planned` | Intended but not yet written |

---

## Phase Gates

What must happen before advancing between phases:

**Phase A → B** (Foundation → Runtime Consistency):
- All RuntimeEvent adoption PRs merged (#373–#375 ✅)
- Shadow Validation RFC reviewed (#376)
- Evidence Graph RFC reviewed (#378)

**Phase B → C** (Runtime Consistency → Evidence Layer):
- Typed Evidence Layer implemented (#379)
- EvidenceBundleBuilder RFC accepted
- Storage backend chosen (see `evidence-graph-rfc.md` §7)

**Phase C → D** (Evidence Layer → Governance Intelligence):
- `AuditBundleNode` export working
- Replay validation implemented
- Drift detection over ≥30 day window

---

## Planned Documents (not yet written)

| # | Planned File | Layer | Description |
|---|---|---|---|
| P1 | `anon-governance-mode.md` | Layer 1 | Security spec for anonymous agent: rate-limits, read-only tools, audit logging |
| P2 | [`evidence-bundle-builder.md`](./evidence-bundle-builder.md) | Layer 3 | `proposed` — EvidenceBundleBuilder RFC: anchor-chain traversal, hash-chain, export formats (JSON / PDF-ready / CSV) |
| P3 | `audit-copilot.md` | cross | Conversational audit flow: from scan → finding → remediation suggestion |
| P4 | `runtime-canvas.md` | Layer 1 | RuntimeCanvas: demo/live mode switching, event feed architecture |
| P5 | `drift-detection.md` | Layer 3 | Tenant drift detection over time windows using Evidence Graph |

---

## Key Decisions

Brief table of the most important architectural decisions and why they were made:

| Decision | Rationale |
|---|---|
| anon vs tenant mode | Prevents mixing Public UX with Tenant Governance |
| read-only tools in public mode | Reduces abuse and liability risk |
| RuntimeEvent first | Shared language before AI automation |
| No big-bang PRs | Keeps architecture reviewable and reversible |
| Shadow validation before rejection | Prevents hard runtime breaks |
| `supersedes` not `delete` | Enables forensic auditability and replay |
| Publish gate evaluated server-side | A client-derived `publishable` is manipulable and therefore not evidence |
| Asset lifecycle instead of scan runs | A scan is a tool of the observation layer, not the product |
| Price by governance depth, not site count | Site count punishes small, complex customers and misses delivered value |
| `governance_assets` canonical, `websites` a projection | The platform will monitor more than websites; a website-shaped asset table forces the same migration again later |
| Lifecycle derived, never a status column | A stored `continuously_monitored` claims a state the data may not carry — the Phase A problem one layer down |
| Anonymous baseline re-run, not claimed | Re-attributing anonymous `email`/`ip_hash` to a tenant changes the processing purpose; the first authenticated run starts the evidence chain |
| RuntimeCanvas marked as Demo | Prevents misleading live-telemetry claims |
| LLM never decides | Voice/Chat/WhatsApp tools are proposals. `PolicyDecision.decidedBy` is always `policy-engine`. |
| Voice is a channel, not a product | Differentiation is governed agents (Prüfpfad, Tenant Isolation, Evidence), not a Vapi clone. Landing remains frozen. |

---

## Maintenance

- Update Status column when a `proposed` RFC is implemented
- Add new documents here BEFORE opening a PR
- `deprecated` docs stay in the registry with status `deprecated`
