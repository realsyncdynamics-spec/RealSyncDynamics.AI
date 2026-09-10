# P1 — Landing Governance Runtime Surface

Branch: `feat/landing-governance-runtime-surface`

## Scope

Adds a public Runtime Surface immediately after the landing hero, without changing the P0 hero positioning, SEO metadata, pricing, authentication, checkout, or infrastructure.

The surface communicates the operational governance loop:

`DISCOVER → ASSESS → GOVERN → ENFORCE → EVIDENCE → AUDIT`

It uses a clearly labelled example state and does not claim tenant-specific live metrics for anonymous visitors.

## Files

- `src/components/landing/LandingGovernanceRuntimeSurface.tsx`
- `src/components/landing/LandingChannelTools.tsx`
- `test/landing/governance-runtime-surface.test.ts`

## Validation

The repository exposes `npm run lint`, `npm run test`, and `npm run build` for validation. This connector session can modify and inspect GitHub sources but cannot execute the repository's Node/Vite toolchain, so CI should be treated as the executable validation gate.

## Merge policy

Do not merge automatically. Review the rendered landing page and CI first.
