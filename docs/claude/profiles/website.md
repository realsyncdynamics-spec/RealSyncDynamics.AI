# Profil: Website (Landing, SEO, UI, Performance)

Ebene 3. Gilt zusätzlich zu `AGENTS.md`, lockert nichts davon.

## Pfade

Schreiben: `src/pages/`, `src/components/` soweit Public Pages sie importieren,
`src/index.css` (Design-Tokens im `@theme`-Block), `src/styles/`, `src/config/seo.ts`.
`packages/siteos-core` nur, wenn der Builder betroffen ist.
Nicht anfassen: `supabase/`, `platform/`, `services/`, `apps/` (dafür gibt es eigene Profile).

## Startseite

Maßgeblich ist das Element von `<Route path="/">` in `src/App.tsx`, nicht dieses Dokument.
Stand 24.10.2026: `src/pages/LandingV6.tsx` (lazy geladen). Markup
`src/components/landing/v6/LandingV6View.tsx`, Logik/CTA-Ziele `useLandingV6.ts`,
Tokens `src/styles/landing-v6.css`. Ältere Fassungen als Vorschau unter `/design/landing-v5`,
`/design/landing-v4`, `/design/landing-v2`. Beta-Schalter `src/config/beta.ts`
(`VITE_BETA_PHASE=off` beendet die Testphase). Arbeitsplan `docs/claude/BETA_V5_WORKPLAN.md`
(nur den jeweiligen WP-Abschnitt lesen).

Weiterentwicklung: Dominiks Entscheidung, Wortlaut in `.github/PR_TRIAGE_POLICY.md`
(Feste Produktentscheidungen, Landing-Basis).

## Inhalte und Design

- Preise und Checkout-Ziele nur aus `shared/pricing.ts`. Preise, Steuer-/Rechtstexte und Claims: Einzel-Freigabe.
- Design-DNA: Hard-Edge (90-Grad-Kanten, Sovereign Grid 40px), Monospace für technische Daten.
  Risk-/Statusfarben semantisch getrennt von Brand-Akzenten.
- Alte Landing-Dateien sind kein Löschbeleg. Vor Cleanup Importgraph, Tests, Registries und
  Vorschau-Routen prüfen. `npm run check:dead` liefert nur Kandidaten.
- Nur betroffene Dateien ändern, kleiner PR, keine Repo-weiten Refactors.

## Prüfungen

`npm run lint`, `npm test`, `npm run build`, `npm run check:landing-claims`, bei Routen `npm run check:sitemap`.

## Eskalation

`src/App.tsx`, Hero- und Landing-Komponenten sind Hotspots: offene PRs prüfen, seriell mergen.
Merge deployt heute automatisch auf Cloudflare Pages → Deploy-Freigabe nötig.
