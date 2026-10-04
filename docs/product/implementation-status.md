# Implementation Status (Public Product Registry)

**SSoT:** `src/product/implementation-status.ts`  
**Measured:** see `IMPLEMENTATION_MEASURED_AT` in that file (last: `2026-10-04`).

## Why

The public landing must only promise what is reachable. Status lives in one
registry. Landing sections, roadmap, badges, and CI claim hygiene all read it.
Flipping `status` moves an item between Live / Preview / Coming Soon in the UI.

## Status meanings

| Status | Meaning |
|---|---|
| `live` | Route or surface reachable for real use on this tree / production |
| `preview` | Code or draft PR exists; not production-complete |
| `coming-soon` | Planned / labeled — not mounted or not wired |

## Rules

1. Do not claim `vollständig` / `voll funktionsfähig` / `complete runtime` on `/`.
2. Preview / coming-soon items must show a badge — never as unqualified PRODUCT.
3. No fake KPIs. No yearly Stripe prices until Stripe prices exist.
4. Public `/` is Landing v4 „Klassisch“ (`LandingV4.tsx` + `landing-v4-classical.css`).
   Live hero is the three.js Earth scene (`heroEarthScene.ts` / `mountHeroEarth`).
   Locked H1: **AI Compliance Operations OS for Europe**. Primary CTA: Free Audit
   → `/audit`; secondary: Live Dashboard → `/demo-tour/dashboard`. Interactive
   Governance Sphere stays off `/`. Design routes `/design/ledger`,
   `/design/tribunal`, `/design/governance-ai`, `/design/titan` redirect to `/`
   and must not appear as reachable roadmap links. Do not invent ISO 27001 /
   NIS2 as registry-live frameworks unless a dedicated live registry entry exists.
5. Canonical dashboard remains `/app` → `CommandCenterDashboard` (via
   `DashboardRouter`) rendering `ComplianceStatusView` — not the older
   `ComplianceStatusDashboard` wrapper that mounts `AgentOsPanel`.
   Auth: `/login` (Magic-Link) and `/welcome` are live gates; `?next=` resumes
   after login (including already-signed-in `getSession`). Callbacks from
   `/login` return to `/welcome`. `GovernanceBrowserShell` always wraps
   `AppGate` so sibling `/app/*` shell routes are not anonymous empties.
6. RealSync Agent OS™ first slice remains **preview** code in-tree
   (`docs/product/realsync-agent-os.md`, `AgentOsPanel`) — **not** mounted on
   live `/app/dashboard`. Never a second dashboard, never live mesh specialists
   beyond Compliance.
7. Stripe Checkout E2E is **live**: checkout/webhook/portal wired, Vault
   Stripe secrets provisioned, live `public.products` defaults (`price_1UEm*`).
   Monthly self-service for starter/growth/agency; yearly remains coming-soon;
   enterprise stays inquiry.
8. `ai-act-classify` **live** means only the public classifier at
   `/ai-act-klassifikator` + Edge Function `ai-act-classify`. Persisting a
   classification into the tenant register/inventory is a separate **preview**
   entry (`ai-act-inventory-persist`): `ai_classification.limited` is granted
   by no plan (PR #1743 lock copy), and the save path is not production-complete.

## Automation

- `#roadmap` on Landing v4 renders from this registry
  (`ROADMAP_LIVE_ITEMS` / `ROADMAP_PREVIEW_ITEMS` / `ROADMAP_COMING_SOON_ITEMS`).
- `npm run check:landing-claims` (CI: CTA Enforcement workflow) fails if landing
  copy asserts forbidden live claims or treats a non-live registry item as live
  without a Preview / Coming Soon marker.

## Related

- Public scan funnel positioning: `docs/product/scan-funnel.md`
- Longer historical scan notes: `docs/product/public-scan-funnel.md`
