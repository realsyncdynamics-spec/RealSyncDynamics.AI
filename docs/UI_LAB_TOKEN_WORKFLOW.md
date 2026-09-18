# Dashboard token workflow (first slice)

Internal design iteration for `/app/dashboard` only. Not a product surface.
Principle: attach to production components. Do not build a second frontend.

## Source of truth

`src/styles/dashboard-tokens.css` declares scoped variables on
`[data-testid="compliance-status-dashboard"]` and binds them:

- `h1.dash-command-title` → `--dash-title-size` / `--dash-title-size-sm`
- `.dash-kpi-card` → `--dash-kpi-min-height`

`command-center-density.css` is retired. Landing (`MainLanding`) and SiteOS
stay out of this graph.

## Export

`exportCss(draft)` emits a patch for the scoped selector. It does not write
files. Empty or blocked drafts emit a comment only.

Merge target: the matching declarations inside `dashboard-tokens.css`.
Do not append a second block.

## Impact gate

`analyzeImpact(draft)` uses the registered manifest in
`src/features/governance/dashboard/ui-lab/impact-manifest.ts`.

| Status | Meaning |
| --- | --- |
| unmapped | token not in the graph → blocked |
| var | production class consumes `var(--dash-*)` |
| four-kpi-equal-height | all four test ids share one token → medium |
| hard-edge-zero-radius | `--dash-radius` other than `0px` → blocked |

Merge only when `report.mergeable` is true. High-risk rows need an explicit
review note. Blocked rows never ship.

## Out of scope

- UI Lab app / `/app/ui-lab` route
- Write-back into source
- Policy Worker, KV, tenant data
- WorkspaceHome ScoreCard and marketing ScoreCard
- Contrast as accessibility certification

## Next

Workbench overlay on the same production components. No second design system.
