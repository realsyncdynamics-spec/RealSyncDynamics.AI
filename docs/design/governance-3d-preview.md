# Governance OS 3D Hero – isolated preview v0.2

Review route: /design/governance-3d

- Public route / stays on LandingV3.
- Visual-only R3F core: three glass shells, internal network and expanding modules.
- GSAP 3.15.1 ScrollTrigger animates scene progress and hero copy.
- No tenant data, fictitious audit scores, payments, or changed backend.
- /audit and /governance-runtime are existing app routes and are only linked.
- No remote HDR environment download.
- Low-motion mode uses static CSS cube; WebGL failure uses the same fallback.
- All 3D is lazy-loaded behind the preview page route.

Do not promote to / without human approval and passing full CI and device checks.
Validation still required: npm ci, npm run lint, npm run build, vitest focused tests,
Playwright desktop/mobile, WCAG reduced-motion and focus checks, deployment preview.
Check the production-gate PR independently before any release.

## QA continuation from closed PR #2349 (20 November 2026)

The earlier draft PR #2349 was closed without merging. This continuation rebases the
same reviewed files on the current main without altering the production homepage.
Additional acceptance gates: dedicated mobile Lighthouse config, isolated PR workflow,
and forced WebGL-unavailable end-to-end test. This route stays a review surface.
A green Lighthouse job does not prove mobile GPU frame time; manual QA still required.

## Mobile-first performance iteration

On `(max-width: 760px), (pointer: coarse)`, the page defaults to a CSS glass-cube
placeholder instead of initializing WebGL/Three.js or GSAP automatically.
A keyboard-accessible button enables the full 3D and scroll animation on demand.
Desktop continues to load the real 3D automatically after the first paint.
`prefers-reduced-motion` always uses the static visual, without an activation button.

Before this iteration the dedicated mobile Lighthouse runs scored 41 and 45/100;
the new score must be verified on the new commit, not assumed. The 3D opt-in
exists to preserve feature parity without spending mobile GPU resources before
user intent.
