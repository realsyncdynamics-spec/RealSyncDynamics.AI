# CLAUDE.md
# RealSyncDynamicsAI — kurzer Arbeitskontext für Claude Code

Diese Datei muss **kurz bleiben** (≤ ~150 Zeilen). Lange Ledger, Deploy-Zahlen und Audit-Kästen gehören **nicht** hierher — sie verbrennen Tokens in jeder Cloud-Session.

Nur bei Bedarf öffnen (nie ganz reinziehen): `docs/ARCHITECTURE_CURRENT.md`,
`docs/claude/CONTEXT_POLICY.md`. Budget-Ratsche: `npm run check:context` (CI) —
Budget nicht anheben.

---

## Produkt

EU-souveräne AI-Governance-Runtime (DSGVO, EU AI Act). Live: https://realsyncdynamicsai.de
Kein Chatbot. Governance-Schicht zwischen Mensch, Firma, Agenten, Daten.

## Stack (Ist)

- Frontend: **Vite 6 + React 19 + TS strict + Tailwind 4**. **Kein Next.js, kein RSC, kein shadcn.**
- Routing: `react-router-dom` in `src/App.tsx`
- Backend: Supabase EU (Postgres + RLS + Edge Functions). Service-Role **nur** in Edge Functions.
- Deploy: **Cloudflare Pages** (`dist/` via GitHub Actions / wrangler). **Kein Vercel.**
- AI: Anthropic / Google / OpenAI (Cloud) oder Ollama (eu_local). Jeder Call wird geloggt.
- SiteOS Workspace: `/builder/:slug` (Puck-Editor). Erstbau `/unified-entry/transformation` leitet dorthin. Client sendet nur Reihenfolge + redaktionelle Felder an `siteos/edit`.

## Website bauen — Scope

Default für Landing-/Marketing-Arbeit. **Nur diese Pfade lesen/schreiben:**

- `src/pages/` (Public Pages, eager in `App.tsx`)
- `src/components/` soweit Landing sie importiert
- `src/index.css` (Design-Tokens stehen im `@theme`-Block), `src/config/seo.ts`
- `packages/siteos-core` nur wenn der Builder betroffen ist

**Nicht anfassen und nicht globben:** `supabase/`, `platform/`, `services/`, `apps/`, `docs/` (außer explizit genannt), Root-`*.sql.bak`, `.archive/` (dort liegen u. a. die alten Root-Status-/Phase-Dokumente unter `root-docs/` — nur gezielt greppen, nie einlesen).

Startseite `/` = **Landing v7** (Owner 26.10.2026; `src/pages/LandingV7.tsx`: Artefakt „AI Compliance Operations OS for Europe“, Titan/Nacht; Markup `src/components/landing/v7/LandingV7View.tsx`, Inhalte/Preise/CTA-Ziele aus SSoT in `landing-v7-content.ts`, Karte `EuropeMapCanvas.tsx`, Styles `src/styles/landing-v7.css`). v6 bleibt unter `/design/landing-v6`, v5 unter `/design/landing-v5`. Beta-Schalter `src/config/beta.ts` (`VITE_BETA_PHASE=off` beendet die Testphase). Arbeitsplan: `docs/claude/BETA_V5_WORKPLAN.md` (nur den jeweiligen WP-Abschnitt lesen). v4 bleibt unter `/design/landing-v4`, v2 unter `/design/landing-v2`. Weiterentwicklung (Dominiks Entscheidung vom 10.10.2026): Frontend und Landingpage gezielt verbessern. V7 ist der aktuelle Ausgangspunkt, kein Selbstzweck: Sie darf angepasst oder ersetzt werden, wenn die Änderung nachvollziehbare Vorteile bei Verständlichkeit, Bedienbarkeit, Barrierefreiheit, Performance oder technischer Wartbarkeit bringt. Bestehende Funktionen erhalten und Änderungen gegen den aktuellen Stand prüfen. Frühere Designfassungen sind keine verbindliche Vorlage. Merge und Deploy benötigen weiterhin eine separate Freigabe.

## Harte Verbote

- Keine Secrets, keine Service-Role, keine Admin-Calls im Browser
- Keine destruktiven Migrations
- CLAUDE.md nicht wieder mit Messprotokollen aufblasen (`check:context`)
- Kein `npm install` als Session-Hook in Cloud (siehe `.claude/hooks/session-start.sh`)
- Lockfiles / `*.generated.ts` / Reports nicht per Read öffnen (`.claude/settings.json`)

## Befehle (lokal / wenn nötig)

```bash
npm install          # einmalig, nicht pro Session
npm run dev
npm run build        # Vite → dist/
```

Nach UI-Arbeit: nur betroffene Dateien ändern, kleinen PR, keine Repo-weiten Refactors.

## Git / Merge

Kein Direkt-Push auf `main`. Squash-only, Branch per `npm run sync:main` auf `origin/main` rebasen. Konflikte lokal lösen, nicht im GitHub-Web-Editor. Playbook: `docs/MERGE_CONFLICT_CONCEPT.md`. Hygiene: `npm run merge:hygiene`.

## MCP

Website-Sessions: `.mcp.json` bleibt leer (keine Hostinger-/Perplexity-Schemas im Kontext).
Infra-Sessions: Server bewusst wieder eintragen.
