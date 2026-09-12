# Implementation Status (Public Product Registry)

**SSoT:** `src/product/implementation-status.ts`  
**Measured:** see `IMPLEMENTATION_MEASURED_AT` in that file.

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
4. Interactive Governance Sphere stays off public `/` (scenery Earth = no Sphere HUD;
   orbit/drag/zoom on the photoreal globe is allowed — see `hero-earth-scenery`).
5. Canonical dashboard remains `/app` → ComplianceStatusDashboard.
6. RealSync Agent OS™ first slice is **preview** on that same `/app` surface
   (`docs/product/realsync-agent-os.md`) — never a second dashboard, never live
   mesh specialists beyond Compliance.

## Automation

- `#roadmap` on the landing renders from this registry.
- `npm run check:landing-claims` (CI: CTA Enforcement workflow) fails if landing
  copy asserts forbidden live claims or treats a non-live registry item as live
  without a Preview / Coming Soon marker.

## Related

- Public scan funnel positioning: `docs/product/scan-funnel.md`
- Longer historical scan notes: `docs/product/public-scan-funnel.md`
