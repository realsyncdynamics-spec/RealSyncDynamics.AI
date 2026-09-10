# CLAUDE.md
# RealSyncDynamicsAI — kurzer Arbeitskontext für Claude Code

Diese Datei muss **kurz bleiben** (≤ ~150 Zeilen). Lange Ledger, Deploy-Zahlen und Audit-Kästen gehören **nicht** hierher — sie verbrennen Tokens in jeder Cloud-Session.

Ausführlicher Ist-Stand: `docs/ARCHITECTURE_CURRENT.md`
Altes Lang-Briefing (nur bei Bedarf öffnen): Commit vor diesem Slim-Cut auf `main`
Token-Regeln: `docs/claude/CONTEXT_POLICY.md`

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

## Website bauen — Scope

Default für Landing-/Marketing-Arbeit. **Nur diese Pfade lesen/schreiben:**

- `src/pages/` (Public Pages, eager in `App.tsx`)
- `src/components/` soweit Landing sie importiert
- `src/index.css`, `tailwind.config.ts`, `src/config/seo.ts`
- `packages/siteos-core` nur wenn der Builder betroffen ist

**Nicht anfassen und nicht globben:** `supabase/`, `platform/`, `services/`, `apps/`, `docs/` (außer explizit genannt), Root-`*.sql.bak`, `.archive/`.

Public Marketing = Light-Theme (Slate + Petrol), siehe `AGENTS.md`. App/Dashboard bleibt dunkel. Design-Freeze: bestehende Tokens/Komponenten nicht umstylen ohne Freigabe.

## Harte Verbote

- Keine Secrets, keine Service-Role, keine Admin-Calls im Browser
- Keine destruktiven Migrations
- CLAUDE.md nicht wieder mit Messprotokollen aufblasen
- Kein `npm install` als Session-Hook in Cloud (siehe `.claude/hooks/session-start.sh`)

## Befehle (lokal / wenn nötig)

```bash
npm install          # einmalig, nicht pro Session
npm run dev
npm run build        # Vite → dist/
```

Nach UI-Arbeit: nur betroffene Dateien ändern, kleinen PR, keine Repo-weiten Refactors.

## MCP

Website-Sessions: `.mcp.json` bleibt leer (keine Hostinger-/Perplexity-Schemas im Kontext).
Infra-Sessions: Server bewusst wieder eintragen.
