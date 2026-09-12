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
4. Interactive Governance Sphere stays off public `/`. Hero visual is photoreal
   Earth as full-bleed backdrop (`hero-earth-scenery` / HeroEarthBackdrop) —
   Europe on the limb (UK/FR/DE/IT city lights) + gold route network, deep-space
   starfield + distant planets — no Sphere HUD, no muddy gold wash over type,
   pointer-events-none behind cream copy. Live H1: line 1 “AI Compliance
   Operations OS for”, line 2 gold Europe. Fold: H1 + Discover loop + value line
   + Free Audit starten + Live Dashboard ansehen. Header: Produkt · Evidence ·
   Preise · Login. Assistent chip hidden on `/`.
5. Canonical dashboard remains `/app` → ComplianceStatusDashboard.
   Auth: `/welcome` is the gate; `?next=` resumes after login (including
   already-signed-in `getSession`). `GovernanceBrowserShell` always wraps
   `AppGate` so sibling `/app/*` shell routes are not anonymous empties.
6. RealSync Agent OS™ first slice is **preview** on that same `/app` surface
   (`docs/product/realsync-agent-os.md`) — never a second dashboard, never live
   mesh specialists beyond Compliance.
7. Stripe checkout E2E stays **preview** until Vault secrets (`STRIPE_*`,
   webhook signing) are set in Supabase Dashboard — code path is wired.

## Automation

- `#roadmap` on the landing renders from this registry.
- `npm run check:landing-claims` (CI: CTA Enforcement workflow) fails if landing
  copy asserts forbidden live claims or treats a non-live registry item as live
  without a Preview / Coming Soon marker.

## Related

- Public scan funnel positioning: `docs/product/scan-funnel.md`
- Longer historical scan notes: `docs/product/public-scan-funnel.md`
