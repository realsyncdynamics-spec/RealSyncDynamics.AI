# CLAUDE.md
# RealSyncDynamicsAI — kurzer Arbeitskontext für Claude Code

Kurz halten (≤ ~150 Zeilen). Ledger, Deploy-Zahlen und Audit-Kästen gehören nach `docs/`.
Budget-Ratsche: `npm run check:context` (CI) — Budget nicht anheben.
Ebene 1 (globale Regeln, Profile, Freigaben) steht in `AGENTS.md` und wird hier importiert:

@AGENTS.md

## Stack (Ist)

- Frontend: **Vite 6 + React 19 + TS strict + Tailwind 4**. **Kein Next.js, kein RSC, kein shadcn.**
- Routing: `react-router-dom` in `src/App.tsx`
- Backend: Supabase EU (Postgres + RLS + Edge Functions). Service-Role **nur** serverseitig.
- Deploy: **Cloudflare Pages** (`dist/` via GitHub Actions / wrangler). **Kein Vercel.**
- AI: Anthropic / Google / OpenAI (Cloud) oder Ollama (eu_local). Jeder Call wird geloggt.
- SiteOS Workspace: `/builder/:slug` (Puck-Editor). Erstbau `/unified-entry/transformation` leitet dorthin. Client sendet nur Reihenfolge + redaktionelle Felder an `siteos/edit`.
- Voice-Runtime: `apps/agent-runtime` (eigene CI, eigener VPS-Deploy).
- Live: https://realsyncdynamicsai.de

## Kontext sparen

- Vor der Arbeit das passende Profil lesen, nicht alle.
- Nie einlesen: `.archive/`, `*.sql.bak`, Lockfiles, `*.generated.ts`, Reports (Read-Deny in `.claude/settings.json`; nicht per Shell umgehen). In `.archive/root-docs/` nur gezielt greppen.
- Kein Repo-Root-Glob. `supabase/`, `platform/`, `services/`, `apps/`, `docs/` nur durchsuchen, wenn Auftrag oder Profil es verlangen.
- Nur bei Bedarf und abschnittsweise öffnen: `docs/ARCHITECTURE_CURRENT.md`, `docs/claude/CONTEXT_POLICY.md`.

## Befehle

```bash
npm run dev
npm run lint         # tsc --noEmit
npm test             # vitest
npm run build        # Vite → dist/
```

Abhängigkeiten stellt das Setup-Skript der Cloud-Umgebung bereit (`docs/claude/CONTEXT_POLICY.md`).
Agenten installieren nicht selbst: `npm install`/`npm ci` sind gesperrt, kein Ausweichen über `npx`, Scratchpad oder globale Pakete.
Kein `npm install` als Session-Hook (`.claude/hooks/session-start.sh`).

## Git / Merge

Kein Direkt-Push auf `main`. Squash-Merge. Branch aktualisieren durch Merge von `origin/main`
(oder „Update branch“ per Merge). Rebase, Force-Push und `npm run sync:main` (rebased; `--push`
= force-with-lease) nur mit Einzel-Freigabe (`.github/PR_TRIAGE_POLICY.md`). Konflikte lokal lösen,
nicht im GitHub-Web-Editor. Playbook: `docs/MERGE_CONFLICT_CONCEPT.md`. Hygiene: `npm run merge:hygiene`.

## MCP

Website-Sessions: `.mcp.json` bleibt leer (keine Hostinger-/Perplexity-Schemas im Kontext).
Infra-Sessions: Server bewusst wieder eintragen.
