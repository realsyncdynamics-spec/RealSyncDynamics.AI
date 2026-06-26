# RealSyncDynamics.AI

EU-souveräne SaaS-Plattform für Creator und Agenturen.
Provenienz (C2PA), AI-Workflows, VPS-Operations — Multi-Tenant.

## Stack
- Frontend: Vite + React 19, TypeScript, Tailwind 4
- Routing: react-router-dom 7
- Backend: Supabase (Auth, Postgres mit RLS, Edge Functions, Storage)
- AI-Provider: Anthropic / Google / OpenAI (Cloud) · Ollama gemma3:4b (EU-lokal)
- Automation: n8n
- Billing: Stripe
- Monitoring: Sentry
- Tests: Vitest + Playwright (E2E)

## Wichtige Ordner
- `src/`                     — React-SPA
- `supabase/functions/`      — Edge Functions (ai-invoke, stripe-*, gdpr-*, kodee-*, workflow-*)
- `supabase/migrations/`     — DB-Migrations
- `services/`, `connectors/` — Backend-Services und Integrationen
- `worker/`                  — Background-Jobs
- `deploy/`                  — VPS-Stack (Traefik, Ollama, n8n)
- `scripts/`                 — Build- und Release-Skripte
- `test/`, `e2e/`            — Unit- und E2E-Tests

## Befehle
- Dev:        `npm run dev`        (http://localhost:3000)
- Build:      `npm run build`
- Lint/Type:  `npm run lint`       (tsc --noEmit)
- Tests:      `npm test`           (vitest run)
- E2E:        `npm run e2e`        (Playwright)
- Prod-Check: `npm run check:production`

## Konventionen
- Sprache: Deutsch (Code-Kommentare und Doku, sofern nicht Standard-Englisch nötig)
- Terminologie: „Prüfpfad" statt „Audit Trail", „Herkunftsnachweis" statt „Provenance"
- Design-System: App/Dashboard = Hard-Edge Industrial UI (keine abgerundeten Ecken, Obsidian/Titanium-Palette). Öffentliche Landing-/Marketing-Seiten nutzen „European Enterprise Trust" Light-Theme: Slate-Neutrals, ruhige Karten/Chips/Panels mit 10–14px Radius (`rounded-chip` / `rounded-card` / `rounded-panel`), Petrol #0F766E als Akzent, separate `LandingNavbar` (weiß). Monospace bleibt überall Pflicht für Metadaten.
- Farben: Obsidian #0A0A0B · Titanium #E2E2E2 · Security-Blue #0052FF (App/Dashboard). Landing: Slate `slate-*` (#F8FAFC–#0F172A) · Petrol `petrol-700` (#0F766E)
- Compliance: EU AI Act + DSGVO; Service-Role-Keys ausschließlich in Edge Functions
- Multi-Tenancy: alle Tabellen RLS-geschützt; jeder externe Call wird in `ai_tool_runs` / `workflow_runs` geloggt

## Ziele für Claude
- Features in Edge Functions + SPA umsetzen
- Migrations sauber additiv halten (RLS nicht brechen)
- Tests (vitest/playwright) zu neuen Features ergänzen
- Refactorings ohne Breaking Changes an öffentlichen Routen
