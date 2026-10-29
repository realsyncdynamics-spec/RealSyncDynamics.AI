# CLAUDE.md — kurzer Arbeitskontext für Claude Code

Kurz halten. Ledger und Audit-Kästen gehören nach `docs/`. Budget: `npm run check:context`.

@AGENTS.md

## Stack (Ist)

- **Vite 6 + React 19 + TS strict + Tailwind 4**, Routing in `src/App.tsx`. Kein Next.js/shadcn.
- Supabase EU (Postgres, RLS, Edge Functions). Deploy **Cloudflare Pages**, kein Vercel.
- AI: Anthropic/Google/OpenAI oder Ollama (eu_local), jeder Call geloggt.
- SiteOS: `/builder/:slug`. Voice-Runtime: `apps/agent-runtime`. Live: https://realsyncdynamicsai.de
- Startseite: `src/pages/LandingV6.tsx` (Stand 26.10.; Umstellung auf K4 als eigener PR).
  Beta-Schalter `src/config/beta.ts`.

## Kontext sparen

- Nur das passende Profil lesen. Nie einlesen: `.archive/`, `*.sql.bak`, Lockfiles,
  `*.generated.ts`, Reports. Kein Root-Glob; `supabase/`, `apps/`, `docs/` nur bei Bedarf.

## Befehle

`npm run dev` · `npm run lint` · `npm test` · `npm run build`. Kein `npm install` durch Agenten.

## Git

Kein Push auf `main`, Squash-Merge, Branch per Merge von `origin/main` aktualisieren.
Rebase/Force-Push nur mit Freigabe. Playbook `docs/MERGE_CONFLICT_CONCEPT.md`.
`.mcp.json` bleibt in Website-Sessions leer.
