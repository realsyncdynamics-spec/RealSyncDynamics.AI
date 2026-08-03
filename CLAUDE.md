# CLAUDE.md
# RealSyncDynamicsAI — AI Governance Runtime Platform

Diese Datei ist der zentrale Kontext für Claude Code (claude.ai/code).
Sie beschreibt **den tatsächlichen Zustand des Repositories**, nicht den Zielzustand.
Abweichungen zwischen Doku und Code sind Bugs in dieser Datei — bitte hier korrigieren, nicht umgekehrt.

---

## 1. Projektidentität

RealSyncDynamicsAI ist eine **EU-souveräne AI Governance Runtime** für Unternehmen,
Agenten-Systeme und Creator-Verifikation.

**Ziele**
- Verwaltung autonomer KI-Agenten
- Governance, Policies und Compliance
- Auditierbare Entscheidungen (Prüfpfad)
- Schutz gegen Deepfakes
- Nachweisbare Daten- und Content-Provenienz (Herkunftsnachweis)

**Compliance-Fokus**
- EU AI Act
- DSGVO
- TDDDG / TTDSG
- C2PA Content Credentials (Ed25519)
- ISO-27001-orientierte Sicherheitsprinzipien

**Produktprinzip**
RealSyncDynamicsAI ist **kein Chatbot**. Es ist eine Governance-Schicht zwischen
Menschen · Unternehmen · KI-Agenten · Daten · Entscheidungen.

**Phase**: 2 Production-Ready | **Go-live**: 2026-08-01

---

## 2. Architektur (Ist-Zustand)

### Frontend — Vite SPA, **kein Next.js**

| Baustein | Stand |
|---|---|
| Build | **Vite 6.2** (`vite.config.ts`, Output → `dist/`) |
| UI | **React 19** + TypeScript 5.8 (`"strict": true`) |
| Routing | **react-router-dom 7.17** (Client-Side, `src/App.tsx`) |
| Styling | **Tailwind 4.1** (`@tailwindcss/vite`, `tailwind.config.ts`) |
| Icons / Motion / 3D | lucide-react · framer-motion, motion · @react-three/* |
| PDF | @react-pdf/renderer |
| Monitoring | Sentry 8.55 (`@sentry/react`, Release-Tracking) |
| Billing | Stripe (Edge Functions, Metered Billing) |
| Automation | n8n (Webhook-Trigger, `governance-incidents` → `workflow_runs`) |

> ⚠️ **Es gibt keine Server Components, kein `app/`-Verzeichnis, kein Next.js und kein shadcn/ui.**
> Vorschläge mit „Server Component", „RSC", „`use client`" oder „shadcn add" passen nicht zu diesem Repo.
> SEO wird über **Prerendering** gelöst (`scripts/prerender.mjs`, `npm run build:full`).

**Prinzipien**
- Public Pages (`src/pages/`) → **eager imports** in `src/App.tsx` (kritischer Rendering-Pfad, SEO)
- Auth-gated Features (`src/features/`) → **`lazy()`** hinter `ProtectedRoute` / `RequireAal2`
- Keine Secrets im Frontend. Nur `VITE_*`-Variablen sind clientseitig — und die sind **per Definition public**.
- Keine Admin-/Service-Role-Zugriffe aus dem Browser.

### Backend

**Primär: Supabase Cloud (EU / Frankfurt)**
- PostgreSQL 16
- **169 Edge Functions** (`supabase/functions/`, Deno/V8)
- **243 Migrations** (`supabase/migrations/`)
- RLS auf allen App-Tabellen · Realtime Subscriptions

**Node/TypeScript-Services** (containerisiert — **kein Go im Repo**)
- `apps/agent-runtime` — Agent Runtime
- `services/realsync-runtime-core` — Runtime-Kern
- `services/realsync-evidence-runtime` — Evidence-/Beweis-Verarbeitung
- `services/openclaw-agent` — Agent-Worker (systemd-Unit vorhanden)
- `services/playwright-scanner` — Scan-Service (DSGVO-Audit)
- `packages/sdk` — öffentliches SDK (CJS + ESM Builds)
- `connectors/` — externe Integrationen · `worker/` — Legacy-Jobs (deprecated → Edge Functions + Cron)

**Architekturprinzip**
```
Frontend (SPA) → Edge Functions / Service-APIs → Services → PostgreSQL
```
Der Browser spricht **nie** direkt mit privilegierten Ressourcen.

### AI-Provider
Anthropic SDK (Claude) · Google GenAI · OpenAI · **Ollama (EU-lokal, Fallback)**.
Jeder externe Call wird in `ai_tool_runs` / `workflow_runs` geloggt.

### Deployment

**Production: Cloudflare**
- **Cloudflare Pages** (`wrangler.toml` → `pages_build_output_dir = "dist"`)
- Deploy via GitHub Actions → `wrangler pages deploy dist`
- Cloudflare Workers / KV / R2 wo sinnvoll (Phase 3, siehe `PHASE_3_CLOUDFLARE_OPTIMIZATION.md`)
- Edge-Config: `_headers`, `_redirects`

**Infrastructure**
- Docker (`docker/`, `Dockerfile.frontend`, `deploy/`, `infra/`)
- Traefik Reverse Proxy · Hostinger VPS für Services · n8n für Automation
- Secrets: Pages via GitHub-Actions-Env (`VITE_*`) · Workers via `wrangler secret put`

**❌ NICHT verwenden**
- Vercel · `@vercel/analytics` · `@vercel/speed-insights` · Vercel-spezifische APIs
- Kein `vercel.json`, keine Vercel-Deploy-Tools — auch nicht „nur zum Testen".

---

## 3. Datenarchitektur

### Multi-Tenancy — nicht verhandelbar

Jede business-relevante Tabelle:
```sql
tenant_id UUID NOT NULL REFERENCES tenants(id)
```
Und **immer**: RLS aktiviert · Policies definiert · Änderungen auditierbar.

**RLS-Pattern**: Zugriff nur, wenn `tenant_id` zum Tenant des `auth.uid()` gehört.
Service-Role umgeht RLS — deshalb **ausschließlich in Edge Functions**.

### Kern-Tabellen (Auszug)

- **Registry**: `ai_systems`, `tenants`, `profiles`
- **Policy Engine**: `ai_policies`, `policy_packs`, `governance_controls`
- **Evidence Stream**: `ai_evidence_events`, `audit_jobs`, `audit_evidence`, `evidence_retention`
- **Governance**: `governance_approvals`, `governance_webhooks`, `governance_incidents`, `runtime_events`
- **Integration**: `workflow_runs`, `ai_tool_runs`, `connectors`, `vendors`, `dpias`, `dsr_tracker`
- **Operations**: `incidents`, `operations_inventory`, `enterprise_agent_runs`, `vps_connections`

### Migrations

- Ort: `supabase/migrations/`, Format `YYYYMMDDHHMMSS_description.sql`
- **Immer additiv.** Keine destruktiven Änderungen ohne ausdrückliche Bestätigung.
- Bestehende RLS-Policies und öffentliche API-Contracts **niemals** brechen.
- Lokal testen: `supabase db reset` → `npm run test:db`

---

## 4. Security — harte Regeln

**NIEMALS**
- API-Keys / Secrets / Credentials committen (`.env.local` nutzen, nie `.env`)
- Service-Role-Keys in Client-Code
- Auth oder RLS „temporär" umgehen
- Tabellen ohne RLS anlegen

**IMMER**
- Environment Variables verwenden
- RLS aktivieren und Tenant-Isolation prüfen
- Input an jeder Vertrauensgrenze validieren
  (**zod ist derzeit keine Dependency** — nicht ohne Absprache einführen)
- Multi-Tenant-Queries mit `tenant_id`-Filter

---

## 5. AI Governance Modell

Jeder Agent braucht vier Dimensionen — fehlt eine, ist er nicht governance-fähig:

- **Identity** — Wer ist der Agent? Wem gehört er? Welche Berechtigungen?
- **Runtime** — Welche Modelle? Welche Tools? Welche Aktionen wurden ausgeführt?
- **Policy** — Welche Regeln gelten? Welches Risiko-Level?
- **Observability** — Logs, Events, Entscheidungen, Kosten.

### Module (Phase 2)
- **Audit** (95%) — DSGVO-Scan, Recheck-Cron, Email-Drip, Share-Token
- **Policy Packs** (100%) — DSGVO, EU AI Act, branchenspezifisch; Auto-Empfehlung nach Tenant-Branche
- **Evidence Vault** (90%) — Ingestion, Retrieval, Hash-Chain-Verifizierung, PDF/JSON-Export, Compliance-Hold
- **Governance Runtime** (85%) — Sentinel-Loop, SLO-Tracking, Auto-Mapping (Asset → Control-Status), Incident-Dispatch
- **Provenance / C2PA** (80%) — Ed25519-Signatur, Custody-Auto-Capture, externe Verifizierung

### Dashboard-Module (modulare Reihenfolge)
1. **Agent Registry** — Liste, Status, Risiko, Details
2. **Agent Identity** — Ownership, Permissions, Credentials
3. **Runtime Monitoring** — Sessions, Events, Tool Calls
4. **Policy Engine** — Regeln, Enforcement, Violations
5. **Audit System** — Immutable Logs, Hash Chains, Evidence
6. **Observability** — Metrics, Costs, Performance
7. **Integrations** — APIs, Webhooks, External Providers

---

## 6. Code Standards

**TypeScript**
- Strict Mode ist aktiv (`tsconfig.json: "strict": true`) — nicht abschalten.
- Kein `any` ohne Begründung im Kommentar.
- Alle Funktionsparameter typisiert.

**React**
- Funktionale Komponenten, Hooks sauber gekapselt (`src/hooks/`)
- Wiederverwendbare Komponenten in `src/components/`
- Bestehende Patterns wiederverwenden statt neue erfinden

**SQL**
- Jede Migration nachvollziehbar und additiv
- RLS-Logik kommentieren: *warum*, nicht *was*

**Daten**
- **Single Source of Truth**: `src/config/*.ts` (`pricing.ts`, `seo.ts`, `industries.ts`, `competitor-comparisons.ts`)
- Niemals duplizieren — Änderungen in der Config propagieren überall
- Config-Objekte sind immutable `const` — nicht mutieren

---

## 7. Repository-Struktur

Vor jeder Änderung erst analysieren:

```
src/
  pages/         104+ Seiten (1 Datei = 1 Route), public, eager imports
  features/      Auth-gated Module (billing, governance, …), lazy-loaded
  components/    Shared UI
  config/        Single Source of Truth (pricing, seo, industries)
  core/          Provider (TenantProvider, DemoModeProvider, …)
  lib/           Utilities (auth, tracking)
  hooks/         React Hooks
  enterprise-os/ Workspace-Layouts, Governance-Branding
  flow/          Seitenbasierter Flow (/flow/*)
  governance/    Governance-UI
  runtime/       Agent-Integration, Telemetry-Typen
  security/      Security-Utilities
  sdk/           Client-SDK-Anbindung
supabase/
  functions/     169 Edge Functions (einziger Ort für Service-Role-Keys)
  migrations/    243 Migrations
apps/agent-runtime      Agent Runtime (Node/TS, Docker)
services/               runtime-core · evidence-runtime · openclaw-agent · playwright-scanner
packages/sdk            Öffentliches SDK (CJS + ESM)
connectors/             Externe Integrationen
deploy/ docker/ infra/  VPS-Stack (Traefik, Ollama, n8n)
scripts/                Build-, Release-, QA-Skripte
test/ tests/ e2e/       Vitest + Playwright
```

### Routing-Struktur
- `/` → MainLanding (**Design-Locked**, siehe §10)
- `/app/*` → Auth-gated Dashboard (Onboarding-First-Gate)
- `/flow/*` → Seitenbasierter Flow (Trial, Onboarding, Assessment)
- `/governance/*` → Public Features (Runtime, Docs, Score, Browser)
- `/<branche>-landing` → Branchen-LPs
- `/preview` · `/pricing` · `/contact-sales`

### Neue Seite hinzufügen
1. **Public**: Datei in `src/pages/`, eager import in `src/App.tsx`, `<Route path="…" element={<NewPage />} />`
2. **Protected**: Modul in `src/features/<name>/`, `lazy()`-Import, `<ProtectedRoute>`-Wrapper
3. **Dynamisch** (`/branchen/:slug`): `useParams()` + zentrale Config aus `src/config/`

---

## 8. Befehle

| Zweck | Befehl |
|---|---|
| Dev-Server | `npm run dev` (http://localhost:3000, HMR) |
| Build | `npm run build` (Vite → `dist/` + Legal-Pages) |
| Build inkl. Prerender | `npm run build:full` |
| Lint / Types | `npm run lint` (`tsc --noEmit`) |
| Tests | `npm test` (Vitest) |
| Tests (Watch) | `npm run test:watch` |
| Einzelner Test | `npm test -- pfad/zur/datei.test.ts` |
| DB-Tests | `npm run test:db` (lokale Supabase) |
| E2E | `npm run e2e` (Playwright) |
| E2E interaktiv | `npm run test:e2e:ui` · Report: `npm run test:e2e:report` |
| Prod-Check | `npm run check:production` |
| Smoke (deployed) | `npm run smoke:production` |
| QA Smoke | `npm run qa:smoke` · Governance: `npm run qa:governance` · Load: `npm run qa:load` |
| Edge-Function-Drift | `npm run check:edge-functions` |

### Nach jeder Änderung
```bash
npm run lint      # tsc --noEmit — muss grün sein
npm run build     # muss durchlaufen
npm test          # betroffene Tests
```
Bei UI-Änderungen zusätzlich `npm run e2e`.

---

## 9. Git Workflow & Arbeitsweise

**Keine direkten Änderungen an `main`.** Branch-Format: `<task-type>/<short-desc>` (z. B. `feature/agent-registry`).

**Vor jedem Commit**: Diff zeigen · Änderungen erklären · Tests ausführen.
PR als Draft öffnen, Review anfordern, dann mergen. Deploy erfolgt via GitHub Actions.

### Vorgehen bei komplexen Aufgaben
1. Architektur analysieren (bestehende Patterns lesen)
2. Plan erstellen und zeigen
3. Modular umsetzen
4. Diff zeigen
5. Tests ausführen
6. **Erst danach** committen

Bei Governance-Code zusätzlich dokumentieren: Zweck der Funktion · Sicherheitsrelevanz ·
betroffene EU-AI-Act-Anforderung · DSGVO-Bezug.

---

## 10. Design-System & Design-Lock

### 🔒 Design-Lock: `src/pages/MainLanding.tsx`
**GESPERRT (Baseline: Commit `3b972f3`, 2026-07-01).**
- **Erlaubt ohne Rückfrage**: nur Texte/Copy, Button-Beschriftungen, Link-Ziele.
- **Nur mit ausdrücklicher Genehmigung**: jede Design-, Layout-, Struktur-, Farb-, Komponenten-,
  Spacing- oder Icon-Änderung, Sektions-Umbau, Theme-Wechsel, Seiten-Ersatz.
- Im Zweifel: **fragen, nicht ändern.**

### Aktive Design-Tokens (`tailwind.config.ts` — verbindlich)
- **App / Dashboard**: Hard-Edge Industrial UI, keine abgerundeten Ecken
  Obsidian `#0A0A0B` · Titanium `#E2E2E2` · Security-Blue `#0052FF`
- **Public Landing Pages**: „European Enterprise Trust" Light-Theme
  Slate-Neutrals `#F8FAFC–#0F172A` · Petrol `#0F766E` als Akzent
  Ruhige Karten/Chips/Panels, 10–14px Radius (`rounded-chip`, `rounded-card`, `rounded-panel`)
  Eigene, weiße `LandingNavbar`
- **Monospace** durchgängig für Metadaten (IDs, Codes, Technisches)

### Vorgeschlagene Richtung (noch NICHT im Token-Set)
Eine Amazon-inspirierte Enterprise-Variante (Dark Header, klare Navigation,
Amazon-Orange `#FF9900`, Dark `#131921`, Neon-Cyan `#4DF2FF`, Neon-Magenta `#FF2FCF`)
ist als Richtung diskutiert, aber **nicht implementiert** — diese Farben existieren
weder in `tailwind.config.ts` noch im CSS. Vor Verwendung: erst Tokens definieren
und Design-Lock-Freigabe einholen. Nicht ad hoc in einzelne Komponenten einstreuen.

---

## 11. Auth & Multi-Tenancy

1. Sign-up über Supabase Auth (Email/Password oder OAuth)
2. Geschützte Routen via `ProtectedRoute` / `RequireAal2`
3. Session in localStorage, validiert über `useSupabaseAuth()`
4. Service-Role-Operationen **ausschließlich** in Edge Functions

- `TenantProvider` umschließt geschützte Routen
- Ein User gehört zu genau einem Tenant (Workspace)
- Alle Queries über RLS nach `tenant_id` gefiltert
- Kontext: `useAuth()` → `{ id, email, tenantId }` · `useTenant()` → Workspace, Members, Plan
- Einladungen: `InvitesView`, `AcceptInviteView`

---

## 12. Konventionen

- **Sprache**: Deutsch für Kommentare und Doku (Standard-Englisch, wo etabliert)
- **Terminologie**: „Prüfpfad" statt „Audit Trail" · „Herkunftsnachweis" statt „Provenance"
- Kommentare erklären **warum**, nicht **was** — besonders bei RLS-Logik und Compliance-Regeln
- E2E-Tests für kritische Flows (Sign-up, Checkout, Compliance-Pfade)

### ✅ DO
- Public-Page-Imports eager halten · Auth-gated Features lazy laden
- Daten zentral in `src/config/`
- `npm run lint` und `npm run check:production` vor dem Commit
- Bestehende Patterns wiederverwenden

### ❌ DON'T
- Shared Config mutieren · Service-Role-Keys im Client
- Tabellen ohne RLS · öffentliche Route-Contracts brechen (Redirects OK, URL-Änderungen nicht)
- Daten duplizieren · Secrets committen
- Vercel-Abhängigkeiten einführen · Next.js-Patterns in die Vite-SPA tragen

---

## 13. Debugging

- **RLS**: Policies via `supabase db pull` inspizieren · lokal `supabase db reset && npm run test:db`
- **Edge Functions**: `supabase functions serve` zeigt Fehler lokal · Logs im Supabase Dashboard
- **Routing (Prod)**: `npm run diagnose:domain` · `npm run smoke:production`
- **Frontend-Fehler**: Sentry (Release-Tracking, Error-Aggregation)

---

## 14. Aktuelle Ziele

- 🔄 **Phase 3 vorbereiten**: Cloudflare-Optimierung (Cache, KV, R2), Social-Orchestrator, Dashboard-UI-Rest
- ⚠️ Migrations sauber additiv halten (RLS nicht brechen)
- ⚠️ Tests (Vitest/Playwright) für neue Features ergänzen
- ⚠️ Refactorings ohne Breaking Changes an öffentlichen Routen
