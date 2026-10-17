# Implementation Status

**SSoT:** `src/product/implementation-status.ts` · **Measured:** `IMPLEMENTATION_MEASURED_AT` (`2026-10-17`).

Registry drives landing/roadmap/CI. Flip `status` → UI. No live claims for preview/coming-soon.

| Status | Meaning |
|---|---|
| `live` | Reachable |
| `preview` | Not production-complete |
| `coming-soon` | Not mounted/wired |

1. No `vollständig` / `voll funktionsfähig` / `complete runtime` on `/`.
2. Preview/coming-soon need a badge.
3. No fake KPIs; no yearly Stripe until prices exist.
4. `/` = Landing v6 (`LandingV6`/`LandingV6View`/`useLandingV6`, since #1881); H1 **The Governance OS für DSGVO und EU AI Act.**; CTAs `/audit` (Kostenlosen Website-Check starten) + `/contact-sales` (Enterprise anfragen); plan tiles from pricing SSoT (beta → signup); Control Room labelled demo data. v5 (`HeroV5`/`V5Sections`) → `/design/landing-v5`, v4 → `/design/landing-v4`. Sphere off `/`; design `/design/*` (not roadmap); no ISO 27001/NIS2 live without registry entry. Note: `hero-earth-scenery` still describes the v4 three.js hero on `/` — re-measure separately.
5. `/app` → `CommandCenterDashboard`/`ComplianceStatusView` (not `AgentOsPanel`); `/login`+`/welcome`; shell wraps `AppGate`.
6. Agent OS™ preview — not on `/app/dashboard`.
7. Stripe Checkout E2E live (yearly coming-soon; enterprise inquiry).
8. `ai-act-classify` live = `/ai-act-klassifikator` + Edge `ai-act-classify`. Inventory = preview `ai-act-inventory-persist` (no plan unlocks; persist incomplete, #1743).
9. `beta-phase` = live since WP-3 (#1874): `beta-enroll` (owner/admin, idempotent, no Stripe) → Growth `trialing` until 31.01.2027 via `trial_end`; triggered from app shell (`useBetaEnrollment`) after `/welcome?beta=1`. `VITE_BETA_PHASE` unchanged (default on). `beta-enroll` in `PRODUCTION_EDGE_FUNCTIONS`, not in `UNBACKED_CALLERS`.
10. `beta-dashboard-onboarding` = preview (WP-4): dashboard feedback button (`beta_feedback`) + guided first scan still open; feedback today via `/kontakt?topic=beta-feedback`.

`#roadmap` ← `ROADMAP_*_ITEMS`. `npm run check:landing-claims`. Related: `scan-funnel.md`, `public-scan-funnel.md`.
