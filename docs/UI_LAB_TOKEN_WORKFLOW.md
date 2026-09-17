# UI Lab — Token-Export und Impact-Analyse

Stand: 2026-09-18  
Referenz: [multica-ai/multica#8388](https://github.com/multica-ai/multica/pull/8388) (Prinzip, kein Copy)  
Leitplanke: anbinden statt zweites System. Kein Policy-Worker, kein KV, kein Landing-Touch.

## Quelle der Wahrheit

Es gibt **keine** neue `dashboard-tokens.css`.

| Datei | Rolle |
|---|---|
| `src/index.css` `@theme` | Plattform-Tokens (Obsidian, Titanium, Radius-Lock) |
| `src/styles/context-themes.css` `.dashboard-context` | Dashboard-Scope inkl. Dichte-Tokens |
| `src/styles/design-tokens.ts` | TS-Spiegel, nicht Lab-Source |
| `src/features/governance/dashboard/command-center-density.css` | Legacy-Selektor, darf nur noch `var(--dash-*)` setzen |

Landing (`src/pages/MainLanding.tsx`, `.landing-context`, `enterprise-hero.css`) und SiteOS-Renderer sind **forbidden**.

## Lab-Vertrag

1. Defaults kommen aus CSS-Source, nie aus einem zweiten Theme-File.
2. Draft speichert nur Diffs (`light` / `dark` / `shared`).
3. `previewCss` ist Overlay im Frame. `exportCss` ist Merge-Patch.
4. Lab schreibt nie Source.
5. Fixtures, keine RLS-Zahlen, kein Netz.
6. Impact entscheidet Mergebarkeit. Export allein reicht nicht.

## Erster Token-Schnitt (in Graph)

- `--dash-title-size` / `--dash-title-size-sm`
- `--dash-kpi-min-height`
- `--context-radius-card` (Constraint: muss `0` bleiben)

Schwestergruppe KPI: `governance-score`, `risk-index`, `evidence-health`, `audit-readiness` — gleiche Höhe.

Out of graph: `src/features/dashboard/components/ScoreCard.tsx`, `WorkspaceHome` ScoreCard, SiteOS, Landing.

## Impact-Status

| Status | Bedeutung | Merge |
|---|---|---|
| `ok` | Binding `var`, Surface im Graph, Constraint hält | ja |
| `legacy` | Selektor setzt nur noch `var(--dash-*)` | Token-Wert ja, Selektor-Delete nein |
| `override` | Call-site schlägt Token | Diff sichtbar, Effekt ggf. null |
| `unmapped` | Token ohne Binding | nein |
| `blocked` | Hardcoded Selektor-px, Forbidden-Pfad, Radius > 0 | nein |

## Review-Gate

Merge nur wenn Impact keine `blocked`/`unmapped`-Zeile hat. High-Risk (`--context-radius-card`) explizit abhaken. Kontrast-Samples sind kein A11y-Siegel.

## Nächster Schnitt (nicht dieser PR)

- Route `/app/ui-lab` mit iframe-Preview
- `h1` und KPI-Cards direkt auf `var()`, danach `command-center-density.css` löschen
- Apply-to-source bleibt geplant
