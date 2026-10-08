# Implementation Status

**SSoT:** `src/product/implementation-status.ts` · **Measured:** `IMPLEMENTATION_MEASURED_AT` (`2026-10-04`).

Registry drives landing/roadmap/CI. Flip `status` → UI. No live claims for preview/coming-soon.

| Status | Meaning |
|---|---|
| `live` | Reachable |
| `preview` | Not production-complete |
| `coming-soon` | Not mounted/wired |

1. No `vollständig` / `voll funktionsfähig` / `complete runtime` on `/`.
2. Preview/coming-soon need a badge.
3. No fake KPIs; no yearly Stripe until prices exist.
4. `/` = Landing v4; three.js hero; H1 **AI Compliance Operations OS for Europe**; CTAs `/audit` + `/governance-runtime`; Sphere off `/`; design `/design/*` → `/` (not roadmap); no ISO 27001/NIS2 live without registry entry.
5. `/app` → `CommandCenterDashboard`/`ComplianceStatusView` (not `AgentOsPanel`); `/login`+`/welcome`; shell wraps `AppGate`.
6. Agent OS™ preview — not on `/app/dashboard`.
7. Stripe Checkout E2E live (yearly coming-soon; enterprise inquiry).
8. `ai-act-classify` live = `/ai-act-klassifikator` + Edge `ai-act-classify`. Inventory = preview `ai-act-inventory-persist` (no plan unlocks; persist incomplete, #1743).

`#roadmap` ← `ROADMAP_*_ITEMS`. `npm run check:landing-claims`. Related: `scan-funnel.md`, `public-scan-funnel.md`.
