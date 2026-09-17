# Dashboard token workflow (first slice)

Internal design iteration for `/app/dashboard` only. Not a product surface.
Principle: attach to production components. Do not build a second frontend.

## Source of truth

`src/styles/dashboard-tokens.css` declares scoped variables on
`[data-testid="compliance-status-dashboard"]`.

`src/features/governance/dashboard/command-center-density.css` binds those
variables to the Command Center title and the four KPI cards. It must not
contain new literals.

Landing (`MainLanding`) and SiteOS stay out of this graph.

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
| selector | density.css still owns the binding → medium |
| override | Tailwind clamp on `h1` can fight the token → medium |
| hard-edge-zero-radius | `--dash-radius` other than `0px` → blocked |
| four-kpi-equal-height | all four test ids share one token |

Merge only when `report.mergeable` is true. High-risk rows need an explicit
review note. Blocked rows never ship.

## Out of scope

- UI Lab app / `/app/ui-lab` route
- Write-back into source
- Policy Worker, KV, tenant data
- WorkspaceHome ScoreCard and marketing ScoreCard
- Contrast as accessibility certification

## Next

1. Move KPI `min-height` onto the card components (`var()` in class/style).
2. Remove the clamp utility from the Command Center `h1` or make it consume
   the tokens.
3. Delete leftover selector rules from `command-center-density.css` once every
   binding is `var`.
4. Only then consider a workbench overlay.
