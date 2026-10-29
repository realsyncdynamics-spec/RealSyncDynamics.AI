---
title: Technik und Infrastruktur
owner: Plattform-Betrieb
reviewed: 2026-10-15
status: aktiv
---

# Technik und Infrastruktur

| Schicht | Ist-Stand | Einstieg |
|---|---|---|
| Frontend | Vite 6, React 19, TS strict, Tailwind 4, `react-router-dom` (kein Next.js) | `src/App.tsx` |
| App-Shell | `GovernanceBrowserShell`, Navigation `shellNav.ts`, `governanceModules.ts` | `src/components/governance-os/` |
| Designsystem | Tokens im `@theme`-Block, `rs-*`-Farben, harte Kanten | `src/index.css`, `src/components/ui/` |
| Backend | Supabase EU: Postgres + RLS, ~197 Edge Functions | `supabase/` |
| Deploy Web | Cloudflare Pages (`dist/`), Workflow nach Merge auf main | `.github/workflows/deploy-cloudflare-pages.yml` |
| Deploy Backend | Migrationen + Functions nach Merge (`supabase/**`) | `.github/workflows/deploy.yml` |
| Worker | `workers/govard-gateway`, `workers/siteos-preview`; `wrangler-workers.toml` nicht deployt | `workers/` |
| KI | Anthropic / Google / OpenAI oder lokal; jeder Aufruf geloggt | `supabase/functions/_shared/ai.ts`, `ai-gateway` |
| Zeitpläne | pg_cron (~19 Jobs), GitHub-Actions-Zeitpläne, Govard-Cron | Command Center → Routinen |

Betriebsgrenzen: Service-Role nur in Edge Functions; kein Vercel; VPS
abgeschaltet (E-V5/E-V6/E-V9 offen); Architekturüberblick in
`docs/ARCHITECTURE_CURRENT.md` (nur gezielt lesen).

## Prüfungen

`npm run lint` (= `tsc --noEmit`) · `npm test` (vitest, **nur `test/**`**) ·
`npm run test:db` (echtes Postgres) · `npm run e2e` · Guards `npm run check:*`
(u. a. `check:context`, `check:fabrication`, `check:dashboard`, `check:edge-refs`).

Verknüpft: [Entwicklung und Arbeitsregeln](entwicklung-und-regeln.md) ·
[AI-OS-Architektur](../README.md#bestandsaufnahme-und-architektur)
