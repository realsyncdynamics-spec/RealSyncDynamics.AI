# RealSyncDynamics.AI

**EU-souveräne Enterprise-Governance-Plattform** für DSGVO + EU AI Act Compliance.
Automatisierte Audit, Policy Management, Evidence Vault, Governance Runtime, C2PA-Provenance — Multi-Tenant, RLS-hardened.

**Phase**: 2 Production-Ready (31 Commits seit Design-Lock, 0 Rollbacks) | **Go-live**: 2026-08-01

## Module (Phase 2)
- **Audit Module** (95%) — DSGVO-Scan, Recheck-Cron, Email-Drip, Share-Token
- **Policy Packs** (100%) — DSGVO, EU AI Act, Industrie-spezifisch; Auto-Empfehlung nach Tenant-Branche
- **Evidence Vault** (90%) — Ingestion, Retrieval, Hash-Chain-Verifizierung, PDF/JSON-Export, Compliance-Hold
- **Governance Runtime** (85%) — Sentinel-Loop, SLO-Tracking, Auto-Mapping (Asset → Control-Status), Incident-Dispatch
- **Provenance (C2PA)** (80%) — Ed25519-Signatur, Custody-Auto-Capture, Externe Verifizierung

## Stack
- **Frontend**: Vite 6.2.0 + React 19.0.0, TypeScript 5.8.2 (⚠️ strict: false), Tailwind 4.1.14 (Hard-Edge)
- **Routing**: react-router-dom 7.17.0 (Lazy-loading Dashboard, /flow/*, /governance/*)
- **Backend**: Supabase Cloud (PostgreSQL 16, RLS 100%, Edge Functions V8, Realtime Subscriptions)
- **AI-Provider**: Anthropic SDK 0.32.1 (Claude 3.5 Sonnet) | Google GenAI 1.29.0 | OpenAI 4.77.0 | Ollama gemma3:4b + qwen3 (EU-lokal, Fallback)
- **Automation**: n8n (Webhook-Trigger, governance-incidents → workflow_runs)
- **Billing**: Stripe (10 Edge Functions, Metered Billing für Module)
- **Monitoring**: Sentry 8.55.2 (Release-Tracking, Error-Aggregation)
- **Testing**: Vitest (251 Test-Dateien, 100% logic) + Playwright (25 E2E green, 3 expected skip)

## Wichtige Ordner
- `src/`                          — React-SPA (100+ Pages, Hard-Edge Industrial UI)
  - `src/pages/` — 104 Landing Pages (18 public: Branchen-LPs, Feature-LPs, Marketing)
  - `src/pages/Governance*.tsx` — Governance Module (Runtime, Docs, Score, Browser, Onboarding)
  - `src/pages/Audit*.tsx` — Audit Flow (Landing, Results, Share)
  - `src/enterprise-os/` — Workspace-Layouts, Governance-Branding
  - `src/flow/` — Seitenbasierter Navigation-Flow (/flow/*)
  - `src/runtime/` — Agent-Integration, Telemetry-Typen
- `supabase/functions/` (101) — Edge Functions
  - **Governance Core** (10): governance-agent, governance-approvals, governance-dpias, governance-dsr, governance-ingest, governance-incidents, governance-connectors, governance-vendors, governance-keys, governance-risk-score
  - **Evidence & Provenance** (3): evidence-vault, evidence-export, provenance (C2PA Ed25519)
  - **Policy Packs** (1): policy-packs (Auto-Empfehlung, Tenant-Branche-Signaling)
  - **Runtime/Automation** (20+): agent-os-runner, governance-monitoring-scheduler, audit-monitor-cron, automation-trigger, webhook, etc.
  - **Payments** (10): stripe-checkout, stripe-portal, stripe-meter-sync, stripe-webhook, etc.
- `supabase/migrations/` — DB-Migrations (PostgreSQL 16, RLS-Policies für 25 Tabellen)
- `services/`, `connectors/` — Backend-Services und Integrationen (Shopify, Salesforce, etc.)
- `worker/` — Background-Jobs (deprecated, jetzt Edge Functions + Cron)
- `deploy/` — VPS-Stack (Traefik Reverse Proxy, Ollama Local AI, n8n Workflows)
- `scripts/` — Build- und Release-Skripte
- `test/`, `e2e/` — Unit-Tests (Vitest, 251 Files) + E2E-Tests (Playwright, Katalog-Config)

## Befehle
- **Dev**:           `npm run dev` (http://localhost:3000, Hot-Reload Vite)
- **Build**:         `npm run build` (Vite SPA, dist/)
- **Lint/Type**:     `npm run lint` (tsc --noEmit, ESLint) — **Note**: strict: false (Recommendation: Phase 3)
- **Tests**:         `npm test` (Vitest run, 251 Files)
- **E2E**:           `npm run e2e` (Playwright, 25 passed + 3 skipped)
- **Prod-Check**:    `npm run check:production` (TS noEmit, Sentry Release, Bundle-size)
- **Deploy**:        `supabase db push` + `supabase functions deploy` (nur main branch)

## Konventionen
- Sprache: Deutsch (Code-Kommentare und Doku, sofern nicht Standard-Englisch nötig)
- Terminologie: „Prüfpfad" statt „Audit Trail", „Herkunftsnachweis" statt „Provenance"
- Design-System: App/Dashboard = Hard-Edge Industrial UI (keine abgerundeten Ecken, Obsidian/Titanium-Palette). Öffentliche Landing-/Marketing-Seiten nutzen „European Enterprise Trust" Light-Theme: Slate-Neutrals, ruhige Karten/Chips/Panels mit 10–14px Radius (`rounded-chip` / `rounded-card` / `rounded-panel`), Petrol #0F766E als Akzent, separate `LandingNavbar` (weiß). Monospace bleibt überall Pflicht für Metadaten.
- Farben: Obsidian #0A0A0B · Titanium #E2E2E2 · Security-Blue #0052FF (App/Dashboard). Landing: Slate `slate-*` (#F8FAFC–#0F172A) · Petrol `petrol-700` (#0F766E)
- Compliance: EU AI Act + DSGVO; Service-Role-Keys ausschließlich in Edge Functions
- Multi-Tenancy: alle Tabellen RLS-geschützt; jeder externe Call wird in `ai_tool_runs` / `workflow_runs` geloggt

## Database Schema (Governance Core)
**25 RLS-Protected Tables**, Multi-Tenancy-Isolation auf allen App-Tables:
- **Registry**: `ai_systems`, `tenants`, `profiles`
- **Policy Engine**: `ai_policies`, `policy_packs`, `governance_controls`
- **Evidence Stream**: `ai_evidence_events`, `audit_jobs`, `audit_evidence`, `evidence_retention`
- **Governance**: `governance_approvals`, `governance_webhooks`, `governance_incidents`, `runtime_events`
- **Integration**: `workflow_runs`, `ai_tool_runs` (audit-logged), `connectors`, `vendors`, `dpias`, `dsr_tracker`
- **Operations**: `incidents`, `operations_inventory`, `enterprise_agent_runs`, `audit_email_sent`, `vps_connections`

**RLS-Policy Pattern**: `tenant_id = auth.uid() → tenants.id` auf allen Tabellen (Service-Role: nur Edge Functions)

## Design-Lock: Startseite (`src/pages/MainLanding.tsx`)
- **GESPERRT (Baseline: Commit `3b972f3`, 2026-07-01).** Das aktuelle Startseiten-Design ist der genehmigte, eingefrorene Stand („Das KI-Betriebssystem für DSGVO, EU AI Act & Code-Compliance" — Obsidian/Cyan-Globe-Hero mit Claude-Code-Metrik-Karten).
- **Erlaubt ohne Rückfrage:** nur Änderungen an **Texten/Copy** und **Button-Beschriftungen** (Strings) sowie an Link-Zielen der Buttons.
- **Nur mit ausdrücklicher Genehmigung:** jegliche Design-/Layout-/Struktur-/Farb-/Komponenten-/Spacing-/Icon-Änderung, Umbau der Sektionen, Theme-Wechsel oder Ersetzen der Seite. Im Zweifel: erst fragen, nicht ändern.

## Ziele für Claude — Phase 2 Completion
- ✅ Audit Module stabilisieren (Recheck-Automation, Email-Drip)
- ✅ Policy Packs & Auto-Mapping deployen
- ✅ Evidence Vault mit Hash-Verifizierung produktiv nehmen
- ✅ Governance Runtime Sentinel-Loop optimieren
- ✅ Provenance (C2PA) mit Ed25519-Signatur + Custody-Auto-Capture
- 🔄 **Phase 3 vorbereiten**: TypeScript strict-Migration, Social-Orchestrator (14 TODOs), Dashboard-UI (15% remaining)
- ⚠️ Migrations sauber additiv halten (RLS nicht brechen)
- ⚠️ Tests (vitest/playwright) für neue Features ergänzen
- ⚠️ Refactorings ohne Breaking Changes an öffentlichen Routen

## Routing-Struktur
- `/` → MainLanding (Design-Locked)
- `/app/*` → Auth-gated Dashboard (Onboarding-First-Gate)
- `/flow/*` → Seitenbasierter Flow (Trial, Onboarding, Assessment)
- `/governance/*` → Public Features (Runtime, Docs, Score, Browser)
- `/<branche>-landing` → 8 Branchen-spezifische LPs
- `/preview` → Public Workspace Preview (Demo, no Auth)
- `/pricing` → Checkout CTA
- `/contact-sales` → Enterprise Sales Funnel
