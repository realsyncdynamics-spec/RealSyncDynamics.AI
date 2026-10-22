# Implementation Status

**SSoT:** `src/product/implementation-status.ts` · **Measured:** `IMPLEMENTATION_MEASURED_AT` (`2026-10-18`).

Registry drives landing/roadmap/CI. Flip `status` → UI. No live claims for preview/coming-soon.

| Status | Meaning |
|---|---|
| `live` | Reachable |
| `preview` | Not production-complete |
| `coming-soon` | Not mounted/wired |

1. No `vollständig` / `voll funktionsfähig` / `complete runtime` on `/`.
2. Preview/coming-soon need a badge.
3. No fake KPIs; no yearly Stripe until prices exist.
4. `/` = Landing v6; static Europe image (three.js Earth only on `/design/landing-v4`, preview); H1 **The Governance OS für DSGVO und EU AI Act.**; CTAs `/audit` (Kostenlosen Website-Check starten) + `/contact-sales?tier=enterprise`; Sphere off `/`; design `/design/*` → `/` (not roadmap); no ISO 27001/NIS2 live without registry entry.
5. `/app` → `CommandCenterDashboard`/`ComplianceStatusView` (not `AgentOsPanel`); `/login`+`/welcome`; shell wraps `AppGate`.
6. Agent OS™ preview — not on `/app/dashboard`.
7. Stripe Checkout E2E live (yearly coming-soon; enterprise inquiry).
8. Beta `beta-phase`: `beta-enroll` live (WP-3, #1874, Growth bis 31.01.2027); WP-4 open → preview. Voice/Telefonie = `voice-telephony` coming-soon; `channel-bots` without phone.
9. `ai-act-classify` live = `/ai-act-klassifikator` + Edge `ai-act-classify`. Inventory = preview `ai-act-inventory-persist` (no plan unlocks; persist incomplete, #1743) — only classifier → `/app/risk-inventory`. `ai-system-registry` live = `/app/ai-systems` (list/create, `update_asset`, `classify_asset`). `kodee` preview = chat all plans, SSH `ai.tool.vps_status` (Agency+).

`#roadmap` ← `ROADMAP_*_ITEMS`. `npm run check:landing-claims`. Related: `scan-funnel.md`, `public-scan-funnel.md`.
