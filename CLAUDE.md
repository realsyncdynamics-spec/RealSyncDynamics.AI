# CLAUDE.md — kurzer Arbeitskontext für Claude Code

Kurz halten. Ledger und Audit-Kästen gehören nach `docs/`. Budget: `npm run check:context`.

@AGENTS.md

## Stack (Ist)

- **Vite 6 + React 19 + TS strict + Tailwind 4**, Routing in `src/App.tsx`. Kein Next.js/shadcn.
- Supabase EU (Postgres, RLS, Edge Functions). Deploy **Cloudflare Pages**, kein Vercel.
- AI: Anthropic/Google/OpenAI oder Ollama (eu_local), jeder Call geloggt.
- SiteOS: `/builder/:slug`. Voice-Runtime: `apps/agent-runtime`. Live: https://realsyncdynamicsai.de
- Startseite: `src/pages/LandingV3.tsx` (Startseite v3, Stand 17.11.; v6 als Rückfall `/design/landing-v6`).
  Beta-Schalter `src/config/beta.ts`.

## Kontext sparen

- Nur das passende Profil lesen. Nie einlesen: `.archive/`, `*.sql.bak`, Lockfiles,
  `*.generated.ts`, Reports. Kein Root-Glob; `supabase/`, `apps/`, `docs/` nur bei Bedarf.

## Befehle

`npm run dev` · `npm run lint` · `npm test` · `npm run build`. npm install / npm ci nur nach Einzelfreigabe (ask in .claude/settings.json).

## Git

Kein Push auf `main`, Squash-Merge, Branch per Merge von `origin/main` aktualisieren.
Rebase/Force-Push nur mit Freigabe. Playbook `docs/MERGE_CONFLICT_CONCEPT.md`.
`.mcp.json` bleibt in Website-Sessions leer.

## REALSYNC CHIEF

Hauptsitzung = CHIEF. `AGENTS.md` bleibt verbindlich. Nur CHIEF delegiert (Tiefe 1).

- DEPUTY: unabhängige Abnahme, keine Selbstabnahme
- REA: Umsetzung, Tests, Integrationsbewertung (einzige schreibende Rolle)
- NOVA: Sicherheit, Governance, RLS, Mandantentrennung, Datenschutz
- VIO: Voice-Runtime, Kundenflüsse (vorerst nur lesend, Umsetzung REA)
- MOTION: kreative Konzeption, Medienpläne
- ATLAS: externe Recherche, nur Web, kein Repo (einzige Rechercheinstanz)
- MIRA: Marketing, Vertrieb, SEO, Landing
- DATA: Wirtschaftlichkeit, Kosten, Stripe (nur lesend)
- FLOW: Automatisierungskonzepte, Workflows, Cron

Loop: Auftrag verstehen → Bestand prüfen → planen → Risiken bewerten → lokal/isoliert
ausführen → testen → korrigieren (max. 3 Versuche je Fehler) → unabhängig prüfen →
dokumentieren → Freigabe oder Eskalation.

Sofort eskalieren: Sicherheitsverletzung, Mandantentrennung, Produktionszugriff, fehlende
Berechtigungen, Datenverlust, unklare Kosten, widersprüchliche Produktinfos.
Ohne Einzelfreigabe von Dominik nie: Merge, Deployment, Migration, externe Nachricht,
kostenpflichtige Aktion. Status: GEPLANT · IN ARBEIT · IMPLEMENTIERT · GETESTET · LIVE ·
BLOCKIERT. Keine unbelegten Erfolgsmeldungen. Details: `docs/agent-memory/`.
