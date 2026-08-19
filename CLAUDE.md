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

**Module (Phase 2)**
- **Audit Module** (95%) — DSGVO-Scan, Recheck-Cron, Email-Drip, Share-Token
- **Policy Packs** (100%) — DSGVO, EU AI Act, Industrie-spezifisch; Auto-Empfehlung nach Tenant-Branche
- **Evidence Vault** (90%) — Ingestion, Retrieval, Hash-Chain-Verifizierung, PDF/JSON-Export, Compliance-Hold
- **Governance Runtime** (85%) — Sentinel-Loop, SLO-Tracking, Auto-Mapping (Asset → Control-Status), Incident-Dispatch
- **Provenance (C2PA)** (80%) — Ed25519-Signatur, Custody-Auto-Capture, Externe Verifizierung
- **SiteOS** (Phase 1) — AI-native Website-Ebene: AI Builder (Prompt → geprüfter Blueprint), 8 Runtime-Analysen, 5 Live-Scores, 7 asynchrone Agenten. Kern in `packages/siteos-core` (abhängigkeitsfrei, läuft in Browser/Deno/Node). Architektur + bewusste Abweichungen vom Auftrag: `docs/SITEOS_ARCHITECTURE.md`. **Regel**: Befund-Codes und Scoring-Gewichte sind versionsrelevant — nicht ohne Entscheidung ändern.

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

> **Zielarchitektur**: `docs/architecture/target-architecture.md` — Fünf-Ebenen-Modell,
> Asset Lifecycle, Governance Engine, normativer SiteOS-Publish-Gate-Contract und
> Pricing-Achsen (BASE + MODULE + SCALE). Das ist das **Zielbild**; dieser Abschnitt
> bleibt der Ist-Zustand. Bei Widerspruch gilt für Implementierungsfragen dieser
> Abschnitt, für Richtungsfragen das Zieldokument.

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
- PostgreSQL 17 (Live-Projekt, Stand 2026-08-16)
- **180 Edge Functions** im Repo (`supabase/functions/`, Deno/V8) — **100 davon in Produktion**, siehe §5
- **279 Migrations** (`supabase/migrations/`) — 278 angewendet, siehe §5
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

### Module (Phase 2) — Repo-Vollständigkeit

> #### ⚠️ Repo-Stand ≠ Produktions-Stand
>
> Die Prozentangaben unten beschreiben den **Stand im Repository**, nicht was in
> Produktion läuft.
>
> **Messung vom 2026-08-16**, direkt gegen das Live-Projekt `RealSyncDynamicsLive`
> (`ebljyceifhnlzhjfyxup`, eu-central-1, PostgreSQL 17) erhoben — nicht geschätzt:
>
> | | Repo | in Produktion | Lücke |
> |---|---|---|---|
> | Migrationen | 279 | 278 (neueste `20260820000000`) | **1** |
> | Edge Functions | 180 | 100 | **80** |
> | Tabellen in `public` | — | 341 | — |
>
> **Die Migrations-Seite ist geschlossen.** Frühere Stände dieser Datei nannten
> „118 nie angewendet" — das gilt seit der Reconciliation nicht mehr. Es fehlt
> genau eine: `20260821000000_b2_website_asset_relation` (B2, gemergt am
> 2026-08-16, in Produktion nicht angekommen). Am Schema geprüft, nicht aus der
> Migrationsliste geschlossen: `websites.governance_asset_id`,
> `scan_runs.asset_id` und der Constraint `findings_scan_run_fk` existieren
> live **nicht**.
>
> **Die Function-Seite braucht eine andere Erklärung als bisher.** Der
> Syntaxfehler in `add-auditor` ist über #941 behoben, blockiert also nichts
> mehr. Was zur verbleibenden Lücke belegt ist — und was nicht:
>
> - Alle 80 fehlenden Functions liegen **alphabetisch nach `api-gateway`**,
>   keine einzige davor. Ein sauberer Schnitt bei exakt 100.
> - Ein Zusammenhang mit Typfehlern liess sich **nicht** herstellen. `deno check`
>   ist als Beleg untauglich, solange es nicht in einer Umgebung mit aufgelösten
>   npm-Abhängigkeiten läuft: dort scheitern auch live deployte Functions
>   (`health`, `governance-agent`, `ai-gateway`) — allerdings an der
>   Paketauflösung (`Could not find a matching package for
>   'npm:@supabase/realtime-js'`), nicht an ihrem Code. Wer die These prüfen
>   will, braucht `deno install` gegen die echten Dependencies.
> - Die Organisation läuft auf **Plan `free`**.
>
> Exakt 100 deployte Functions plus harter alphabetischer Schnitt deutet auf das
> **Function-Kontingent des Free-Tarifs**, nicht auf einen Deploy-Bug. Vor einer
> Gegenmaßnahme gegen Supabase' aktuelle Limits gegenprüfen — aber kein Code-Fix
> deployt Function 101. Betroffen sind genau die Module, die diese Liste als
> weitgehend fertig führt: `evidence-vault`, `policy-packs`, `provenance`, alle
> `iso42001-*`.
>
> Der Free-Tarif bedeutet zusätzlich: keine täglichen Backups, kein
> Point-in-Time-Recovery, kein SLA, Projekt-Pausierung bei Inaktivität. Für ein
> Produkt, das Prüfpfad, Evidence-Hash-Ketten und ISO-orientierte Prozesse
> zusagt, ist das ein eigener Governance-Befund — unabhängig vom Limit.
>
> Ein Modul, dessen Backend nie deployt wurde, ist in Produktion **nicht** verfügbar,
> egal wie vollständig der Code im Repo ist. Vor Aussagen zum Produktionsstand daher
> immer gegen die Live-DB bzw. `supabase functions list` prüfen, nicht gegen diese Liste.

- **Audit** (95%) — DSGVO-Scan, Recheck-Cron, Email-Drip, Share-Token
- **Policy Packs** (100%) — DSGVO, EU AI Act, branchenspezifisch; Auto-Empfehlung nach Tenant-Branche
- **Evidence Vault** (90%) — Ingestion, Retrieval, Hash-Chain-Verifizierung, PDF/JSON-Export, Compliance-Hold
- **Governance Runtime** (85%) — Sentinel-Loop, SLO-Tracking, Auto-Mapping (Asset → Control-Status), Incident-Dispatch
- **Provenance / C2PA** (80%) — Ed25519-Signatur, Custody-Auto-Capture, externe Verifizierung
- **Memory Governance / RFC-003** (Phase 3, im Repo vollständig) — temporaler Verfall,
  Klassifikations-Unveränderlichkeit, Aufbewahrung mit Holds. Tabelle `governance_memory`,
  Zustandsautomat `active → cooling → archived → expired → purged`.
  Edge Functions: `governance-memory` (User-API), `memory-decay-worker` (stündlicher Cron),
  `memory-confidence-trigger` (Re-Bewertung bei neuer Evidence).
  UI: `/app/governance/memory`. Spezifikation: `docs/architecture/governance-memory-policy-rfc.md`.
  **Regel**: Die Schwellen (0.5 / 0.2 / 0.8), Aufbewahrungsklassen und Grace-Perioden
  stehen doppelt — in `src/core/governance/rfc003-memory.ts` und in der Migrations-SQL.
  Nie einseitig ändern; `test/governance/rfc003-sql-parity.test.ts` bricht sonst.
  **Betrieb**: Der Decay-Worker tickt nur, wenn der pg_cron-Job `memory-decay-hourly`
  registriert ist (Migration `20260819000000`) — ohne ihn verfällt kein Memory.

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
RealSyncDynamics.AI/
├── src/
│   ├── pages/         108 Seiten (1 Datei = 1 Route), public, eager imports
│   ├── features/      Auth-gated Module (billing, governance, …), lazy-loaded
│   ├── components/    Shared UI
│   ├── config/        Zentrale Konfiguration (seo, industries) — Preise siehe shared/
│   ├── core/          Provider (TenantProvider, DemoModeProvider, …)
│   ├── lib/           Utilities (auth, tracking)
│   ├── hooks/         React Hooks
│   ├── enterprise-os/ Workspace-Layouts, Governance-Branding
│   ├── flow/          Seitenbasierter Flow (/flow/*)
│   ├── governance/    Governance-UI
│   ├── runtime/       Agent-Integration, Telemetry-Typen
│   ├── security/      Security-Utilities
│   └── sdk/           Client-SDK-Anbindung
├── shared/
│   └── pricing.ts     Single Source of Truth für Produkt-, Preis- und Berechtigungsmodell
├── supabase/
│   ├── functions/     180 Edge Functions (einziger Ort für Service-Role-Keys)
│   └── migrations/    279 Migrations
├── apps/
│   └── agent-runtime/ Agent Runtime (Node/TS, Docker)
├── services/          runtime-core · evidence-runtime · openclaw-agent · playwright-scanner
├── packages/sdk       Öffentliches SDK (CJS + ESM)
├── connectors/        Externe Integrationen
├── deploy/ docker/ infra/ VPS-Stack (Traefik, Ollama, n8n)
├── platform/          🏗️ **WEBSITE BUILDER MONOREPO** (siehe unten)
├── scripts/           Build-, Release-, QA-Skripte
└── test/ tests/ e2e/  Vitest + Playwright
```

### 🏗️ Platform-Monorepo (`platform/`) — Website Builder + Governance

In-sich-geschlossener Microservice-Stack für **automatisierte Website-Generierung mit Compliance-Gating**:

**Struktur:**
```
platform/
├── builder_orchestrator/    Python/FastAPI — AI-App-Builder
│                             • Multi-Agent-Task-Graph
│                             • BuildSpec → Code-Generierung
│                             • OpenAPI: /docs
├── governance_backend/       Python/FastAPI — Risk & Compliance Engine
│                             • EU-AI-Act-Konformität
│                             • CI/CD-Gate-Engine
│                             • Audit-Log + Telemetrie
├── nextjs_frontend/          Next.js — Builder-Cockpit + Governance-UI
├── migrations/               SQL-Migrations (Postgres)
├── docker-compose.yml        Lokale Orchestrierung (alle 4 Services)
└── README.md                 Workflow, API-Nutzung, Start-Guide
```

**Start (lokal):**
```bash
cd platform
cp .env.example .env
docker compose up --build
```

**Zugang:**
- Builder-API: http://builder.localhost/docs (Port 8001)
- Governance-API: http://rsd.localhost/docs (Port 8002)
- Frontend: http://app.localhost (Port 3000)
- Traefik-Dashboard: http://localhost:8080

**Zweck:** Die Seite wird **weder** von der Root-package.json noch vom Root-npm noch in den
Root-CI/CD-Workflows verwaltet. Sie ist physisch ein eigenständiges Projekt, das
`docker compose` koordiniert. Änderungen dort brauchen weder `npm run lint` noch
`npm run build` in der Root — nur Docker.

**Modifikationen im `platform/`:**
- Keine Node-Dependencies (alles Python/Deno)
- RLS + Migrations wie im Hauptrepo (selbe DB-Conn in `docker-compose.yml`)
- OpenAPI-First: Endpoints mit `@app.post`, `@app.get` + Schemas in Pydantic
- Prüfpfad: `audit_log` + `workflow_runs` (selbe Tabellen wie Root-Governance)

### Preise, Pläne und Berechtigungen

`shared/pricing.ts` ist die **einzige** Quelle für Plan-Namen, Preise,
Runtime-Limits, Module, Berechtigungen, Feature-Listen und Add-ons.
`src/config/pricing.ts` ist nur noch eine Projektion davon.

- Änderungen ausschließlich in `shared/pricing.ts`, danach `npm run sync:pricing`
- `npm run check:pricing` prüft Deno-Zwilling und DB-Katalog gegen die Quelle
- Zugriff **nie** über Plan-Namen (`if (plan === 'agency')`), sondern über
  `hasPermission()`, `hasModule()`, `limitOf()`
- Es gibt genau sechs **Abo-Pläne**: Free Audit · Starter · Growth · Agency ·
  Enterprise · Partner. Der Name „Scale" ist untersagt.
- Daneben gibt es **Einmalprodukte** (`purchaseMode: 'one_time'`), derzeit
  Governance Launch (349 € einmalig). Sie sind kein Rang der Abo-Leiter:
  nicht in `PLAN_ORDER`, Preis in `price.oneTimeEur`, Persistenz als Grant in
  `entitlement_grants` (nicht `subscriptions` — dort gilt „genau ein Abo pro
  Tenant"), Anzeige über `ONE_TIME_PRICING_TIERS`.

Vollständige Regeln: `docs/product/pricing-governance.md`

### Routing-Struktur
- `/` → MainLanding (**Design eingefroren**, Ergänzen frei, Ändern nur nach Rückfrage — siehe §10)
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

### Doku-Hygiene: erledigte Aufgaben dürfen gelöscht werden

Abgearbeitete und veraltete Aufgaben-Dokumente werden **ohne Rückfrage entfernt** —
die Git-History bleibt als Archiv erhalten.

- **Löschen**: erledigte Checklisten · Tages-/Wochenpläne mit vergangenem Datum ·
  Status-Snapshots abgeschlossener Arbeiten · Dokumente mit ✅-COMPLETE- oder
  ERLEDIGT-Markierung, deren Inhalt nicht mehr gebraucht wird
- **Behalten**: Runbooks, Playbooks, Templates, Specs, Architektur- und
  Compliance-Nachweise — auch wenn die zugehörige Aufgabe erledigt ist
- **Vor dem Löschen prüfen**: Wird die Datei noch referenziert (`grep -rl <name> .`)?
  Bei Verweisen aus bleibenden Dateien entweder Referenz mitkorrigieren oder Datei behalten.
  Keine toten Links hinterlassen.

---

## 10. Design-System & Design-Freeze

### 🔒 Design-Freeze — verbindlich seit 2026-08-19

**Baseline: Commit `339b08e7`** auf `main` — „feat(landing): Enterprise Ultra
Plus frontend". Das ist der Stand, der vom Eigentümer abgenommen wurde und
seit dem 2026-08-19 auf `realsyncdynamicsai.de` ausgeliefert wird. Er gilt als
eingefroren.

> Die erste Fassung dieser Regel nannte `f0c03bd` — den Commit auf dem Branch
> `claude/enterprise-frontend-capability-truth`. PR #1091 wurde als **Squash**
> gemergt, wodurch die fünfzehn Einzel-Commits zu `339b08e7` zusammengefasst
> wurden. `f0c03bd` existiert in `main` deshalb nicht; die Baseline zeigte auf
> einen Commit, den dort niemand findet.
>
> Lehre für den nächsten Freeze: Ein Baseline-Verweis gehört erst gesetzt,
> wenn der Stand auf `main` liegt — vorher ist die SHA nicht die endgültige.

#### 1. Am Design wird nichts mehr geändert

Gesperrt sind: Layout, Grid, Sektionsreihenfolge, Farben, Theme, Typografie-
Skala, Schriftgrößen, Spacing, Radien, Schatten, Verläufe, Animationen,
Icon-Set, Austausch oder Neubau von UI-Komponenten, Neuentwurf einer Seite.

Das gilt **ausnahmslos** und unabhängig davon, wie gut eine Idee erscheint.
Ein Design, das eingefroren ist, wird nicht „nur kurz verbessert".

#### 2. Ergänzungen sind frei

Neue Funktionen, neue Sektionen, neue Texte und neue Buttons dürfen **ohne
Rückfrage hinzugefügt** werden — aber ausschließlich mit den vorhandenen
Komponenten, Klassen und Tokens. Wer etwas hinzufügt, erfindet dafür keine
neue Optik.

#### 3. Bestehendes ändern oder entfernen → vorher fragen

Für jede Änderung **an bereits vorhandenem** Text, Button, Link oder einer
backend-gebundenen Funktion gilt Fragepflicht. Wortlaut des Hinweises:

> **Achtung, Textänderung — sollen wir dies machen? Ja oder nein?**

Bei Funktionen entsprechend „Funktionsänderung". Danach wird **gewartet**, bis
eine Antwort vorliegt. Keine Vorab-Umsetzung „zum Zeigen".

#### 4. Freigabe für Design-Änderungen — die Drei-Fragen-Regel

Soll doch etwas am Design geändert werden, ist das nur über diesen Weg
möglich: Es werden dem Eigentümer **genau drei Fragen** gestellt, die die
geplante Änderung vollständig beschreiben. Erst wenn **alle drei mit Ja**
beantwortet sind, ist die Änderung freigegeben — für genau diesen Umfang, nicht
darüber hinaus.

Ein „Ja" zu einer früheren Änderung gilt nicht für die nächste.

#### Erteilte Freigaben

Damit die nächste Sitzung nicht für einen Regelbruch hält, was abgestimmt war,
wird jede erteilte Freigabe hier festgehalten — mit ihrem Umfang, denn sie gilt
nur für diesen.

**2026-08-19 — Enterprise-Ebene der Startseite**

| Frage | Antwort |
|---|---|
| 1. Zweiter Akzent (Champagner/Gold) als neues Token, nur für VIP-Flächen | **Nein** |
| 2. Neues Materialbild für bestehende Panels (Glas, Haarlinien, gestaffelte Schatten) | **Ja** |
| 3. Eigene Enterprise-Sektion plus gestaffeltes Einblenden und Parallax auf der Weltkugel | **Ja** |

Zur ersten Frage kam der Zusatz „komplett next level Frontend und allgemeines
Webdesign". Der Umfang ist damit **breiter** als die drei Fragen, aber die
Farbentscheidung steht: Es bleibt bei Cyan auf Obsidian, ein zweiter
Farbakzent ist ausdrücklich abgelehnt.

Umgesetzt: `.surface-panel` / `.hairline` und die Reveal-Regeln in
`src/index.css`, `src/hooks/useStagedReveal.ts`, `src/hooks/useHeroParallax.ts`,
`src/components/landing/EnterpriseAccessSection.tsx`.

Was **nicht** freigegeben ist und weiterhin unter §10.1 fällt: Sektionsreihenfolge,
Grid, Typografie-Skala, Icon-Set, Farbpalette.

#### Faustregel

**Hinzufügen ja, Ändern nur nach Rückfrage, Design gar nicht.**
Im Zweifel: fragen, nicht ändern.

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

## 14. Arbeitsprinzip & Aktuelle Ziele

### 🎯 Leitprinzip: Unsichtbares sichtbar, Funktionen funktionsfähig

Gilt für **alle Repos** dieses Projekts. Bei jeder Aufgabe mitprüfen:

- **Unsichtbares sichtbar machen** — fertiger Code, den niemand erreichen kann, ist
  verschwendete Arbeit. Verwaiste Seiten ohne Route, Routen ohne Link, Features ohne
  Einstiegspunkt: einbinden und verlinken. Links und Buttons hinzufügen ist laut §10
  **Inhalt** und damit ohne Rückfrage erlaubt.
- **Funktionen funktionsfähig machen** — Buttons ohne Handler, `href="#"`, dauerhaft
  `disabled` ohne Grund, „coming soon" ohne Termin, TODO-Stubs in Produktionspfaden:
  entweder fertigstellen oder entfernen. Kein Element vortäuschen, das nichts tut.
  **Achtung, Vorrang §10**: Fertigstellen ist eine Ergänzung und damit frei.
  Entfernen oder Umschreiben greift in Bestehendes ein — dafür gilt die
  Fragepflicht. Also melden, nicht stillschweigend abräumen.
- **Abgelöstes benennen** — wird eine Seite durch einen Redirect ersetzt, gehört die
  alte Datei entfernt, nicht als toter Code liegengelassen.

Befunde, die den Rahmen der aktuellen Aufgabe sprengen, werden **berichtet**, nicht
stillschweigend übergangen.

### Aktuelle Ziele

- 🔄 **Phase 3 vorbereiten**: Cloudflare-Optimierung (Cache, KV, R2), Social-Orchestrator, Dashboard-UI-Rest
- 🎯 **Zielarchitektur umsetzen** (`docs/architecture/target-architecture.md`) in dieser
  Reihenfolge: Asset-Objektebene + Lebenszyklus → Publish Gate → Workflows →
  Integrationen → Pricing-Achsen. Der **Publish Gate muss vor dem ersten
  SiteOS-Publish-Pfad** stehen, nicht danach.
- ⚠️ Migrations sauber additiv halten (RLS nicht brechen)
- ⚠️ Tests (Vitest/Playwright) für neue Features ergänzen
- ⚠️ Refactorings ohne Breaking Changes an öffentlichen Routen
