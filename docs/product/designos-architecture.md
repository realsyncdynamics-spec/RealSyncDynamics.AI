# DesignOS — Kernel capability of RealSync OS

**Phase A.** Architecture / kernel only. No editor, no second backend, no parallel runtime.

> DesignOS is a capability of the RealSync OS Kernel, not an independent application runtime. SiteOS remains the canonical web artifact, rendering and execution substrate. All AI-driven design mutations must pass through the RealSync OS planning, policy, approval, execution, observation and verification lifecycle.

## Line

```
Command Center     Intent & Orchestration
DesignOS           Creative kernel capability
RealSync Code      Engineering interface (not this phase)
SiteOS             Web artifact / renderer / publish gate
Governance Runtime Control plane (policy, risk, approval)
Evidence Layer     Proof
```

```
USER INTENT
   ↓
RealSync OS Kernel
  ├─ Planner
  ├─ Policy Engine
  └─ Approval
       ↓
Design Plan
       ↓
Design Agents (declarative — designer, ux, brand, copy, responsive)
       ↓
Semantic Design State
       ↓
SiteOS Blueprint (pure mapping)
       ↓
Governance / Evidence
```

## Hard boundaries (Phase A)

Not built:

- visual builder / canvas editor
- own design runtime
- own deployment
- own blueprint store
- own audit store
- fake Figma / Canva
- DOM as the primary model
- bypass of policy / approval
- fake executions, fake SEO scores, fake WCAG scores

SiteOS `packages/siteos-core` remains the renderer when bound. The kernel only produces a `siteos.blueprint` document in session artifacts. It is not persisted and not published.

## Semantic state

The design state is not the DOM.

```
Page
 ├── Header
 ├── Hero
 │    ├── Heading
 │    ├── Copy
 │    └── CTA
 ├── Features
 └── Footer
```

Types live in `src/os/design/types.ts`:

`DesignProject` · `DesignDocument` · `DesignNode` · `DesignToken` · `DesignAsset` · `DesignVariant` · `DesignComment` · `DesignChange`

Mutations append `DesignChange` records. Generated nodes carry provenance (`agent`, `policyVersion`).

## Four kernel blocks

| Block | Path | Job |
|---|---|---|
| types | `src/os/design/types.ts` | Canonical design graph |
| planner | `src/os/design/planner.ts` | Intent → design steps |
| designState | `src/os/design/designState.ts` | Versioned semantic state |
| designPolicy | `src/os/design/designPolicy.ts` | Rights, risk, approval, deny-by-default |

Agents (`designAgents.ts`) are declarations, not a second runtime.

## Input modes

| Mode | Phase A behaviour |
|---|---|
| PROMPT → DESIGN | Kernel-local: brand, tokens, tree, structural a11y/SEO, blueprint mapping |
| URL → DESIGN | Mode detected. Extractor `NOT IMPLEMENTED` (no crawler bound) |
| SCREENSHOT → DESIGN | Mode detected. Vision extractor `NOT IMPLEMENTED` |
| CODE → DESIGN | Mode detected. Parser `NOT IMPLEMENTED` |

No pixel clone. No fake import.

## Policy (deny by default)

```
READ        website, brand, analytics, design
WRITE       design, frontend, content
RESTRICTED  customer data, personal data
APPROVAL    production changes, external publication
DENY        production database, secrets, unrestricted personal data
```

AI-generated nodes: provenance → policy → evidence. Publish is never implied by a mapped blueprint.

## SiteOS adapter

`src/os/adapters/siteos/designToBlueprint.ts` is a pure function.

Design tokens → SiteOS theme. Semantic sections → blueprint sections. Inverse: `blueprintToDesign.ts`.

Renderer, runtime scan and publish stay SiteOS. Unbound: `NOT IMPLEMENTED`.

## Next (not this phase)

- **B** Design runtime UI (canvas is a surface of the OS, not the OS)
- **C** Bind mapped blueprint to live SiteOS builder / preview / scan
- **D** Critique loop (observe screenshot/DOM → modify)
- **E** Canva / Figma / Microsoft as connectors
