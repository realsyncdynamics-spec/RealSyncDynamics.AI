# RealSync – Technik

**Stand:** 27.10.2026 · **Quelle:** `main` @ `c9a7da6` · Zweck: Projektwissen (claude.ai) für technische Fragen.
**Regel:** Code vorhanden ≠ live. Migration vorhanden ≠ angewendet. Wo kein Beleg vorliegt, steht „unbelegt“.
Zahlen zu Produktion stammen aus datierten Audits und veralten; vor externen Aussagen neu messen.

---

## 1. Architektur (Ist)

### 1.1 Stack

| Schicht | Technik (belegt in `package.json`, `vite.config.ts`, `wrangler.toml`) |
|---|---|
| Frontend | **Vite 6** (`^6.2`), **React 19**, **TypeScript strict** (~5.8), **Tailwind 4** (`@tailwindcss/vite`), `react-router-dom` 7 (Routen in `src/App.tsx`, ~517–528 `<Route>`-Zeilen, davon ~92 reine Weiterleitungen laut Masterplan) |
| UI-Bibliotheken | `framer-motion`/`motion`, `lucide-react`, `recharts`, `three`/`@react-three/*`, `@react-pdf/renderer`, `react-markdown` |
| Builder | **SiteOS** + **Puck** (`@puckeditor/core` 0.23, MIT) als Block-Editor; Workspace `/builder/:slug`; Kernpaket `packages/siteos-core` |
| Backend | **Supabase EU** (eu-central): Postgres + RLS, Auth, Storage, **Edge Functions** (Deno) |
| Hosting | **Cloudflare Pages** (`dist/`, `pages_build_output_dir`), Security-Header über `public/_headers`, Pages-Middleware in `functions/` |
| Cloudflare Workers | `workers/siteos-preview` (KV), `workers/govard-gateway` (D1 + R2 + Durable Objects), `wrangler-workers.toml` (verify-jwt-Canary, KV) |
| KI | Anthropic, Google (`@google/genai`), OpenAI (Cloud); EU-lokal über LM Studio (Default) oder **Ollama** (`AI_LOCAL_PROVIDER=ollama`) |
| Monitoring | Sentry (`@sentry/react`, EU-Ingest, ohne DSN No-op) |
| Tests | Vitest 4, Playwright 1.59, Testing Library |

**Kein** Next.js, **kein** RSC, **kein** shadcn, **kein** Vercel (bewusste Entscheidung, `docs/SITEOS_ARCHITECTURE.md` §1).
Nebenstacks im Repo (nicht Kern der SPA): `platform/` (Python/Next.js-Builder-Suite), `apps/` (u. a. `agent-runtime`, `mcp-server`), `services/` (u. a. Playwright-Scanner), drei Browser-Extensions (`extension*/`).

### 1.2 Mengengerüst

| Objekt | Anzahl | Beleg |
|---|---|---|
| Edge-Function-Verzeichnisse | **196** (+ `_shared`) | `ls supabase/functions` am 27.10.2026 |
| Migrationen | **393** Dateien | `ls supabase/migrations` am 27.10.2026 |
| Tabellen `public` mit RLS | 368 / 368 | E2E-Audit 06.09.2026 (seitdem nicht neu gemessen) |
| Repo ↔ Prod Functions | 188 = 188 (Lücke 0) | E2E-Audit 06.09.2026 — **heutiger Abgleich unbelegt** |
| GitHub-Actions-Workflows | 38 | `.github/workflows/` |
| Testdateien | ~670 unter `test/`+`tests/`, 41 Einträge in `e2e/` | `find`/`ls` am 27.10.2026 |

### 1.3 Produktschichten

```
Öffentliche Seiten (Landing v6 auf "/", /audit, /pricing, Blog …)
        │  Free-Scan / CTA
        ▼
Unified Entry  /unified-entry/*  : Scan → Preview → Trial → Register → Onboarding
        ▼
Governance Runtime (Kern)  DISCOVER → ASSESS → GOVERN → ENFORCE → EVIDENCE → AUDIT
  Policy/PDP · Risk · Remediation · Evidence-Kette · KI-Register · Approvals · Audit-Trail
        ▼
Anwendungen & Kanäle: SiteOS/Website-Builder · DSGVO-Audit · AI-Act-Tools ·
  Bots (chat/voice/telegram/whatsapp) · Claude-Code-Optimizer
        ▼
Daten/Billing: Supabase Postgres+RLS · Edge Functions · Storage · Evidence Vault · Stripe-Entitlements
```

OS-Kernel-Vertrag (`docs/product/realsync-os-kernel.md`): `Intent → Policy → Plan → Execute → Observe → Verify → Evidence`.
Unbekannte Agent-Aktionen: deny by default. Produktions-Deploy: freigabepflichtig. Preview ≠ Produktion.
Stripe-Entitlements sind die kommerzielle Wahrheit (`tenant_entitlements()`), keine eigene Modultabelle.

### 1.4 KI-Aufrufpfad (vereinfacht)

```
Client (SPA mit JWT  |  API/SDK/Cursor mit rsd_gov_-Key  |  Bot-Kanal/Webhook)
   │
   ▼
Edge Function (ai-invoke · ai-gateway · governance-router · bot-chat · …)
   │ 1. Auth: JWT bzw. SHA-256-Key-Abgleich → tenant_id nur aus Token/Key
   │ 2. Entitlement/Kontingent (Stufe observe/studio/growth/agency/sovereign)
   │ 3. Residenz: resolve_ai_residency(tenant,user) → cloud | eu_local
   │      Fehler/unklar → 503 RESIDENCY_UNAVAILABLE (fail-closed seit #1966)
   │ 4. PDP/Policy: Modus off | shadow | enforce (Default shadow)
   ▼
Modell-Adapter ── eu_local → LM Studio / Ollama (EU)
               └─ cloud    → Anthropic / Google / OpenAI
   │
   ▼
Protokoll: ai_tool_runs (runAiTool) · usage_events · ai_evidence_events
           (Hash-Kette per Trigger; für ai-gateway seit #2015) · Art.-50-Offenlegung
           in der Antwort · Prüfpfad ohne Prompt-Inhalt (governance-router)
```

### 1.5 SiteOS (Website-Ebene der Runtime)

- Kein zweiter Baukasten: SiteOS speist in bestehende `incidents`, `governance_admin_log`, Provenance-Kette; **eine** Hash-Kanonisierung.
- Blueprint → Renderer (HTML) → Runtime-Analysen (8) → Kennzahlen (5) → Agenten (7, nur deterministische Behebung). Kern mit 201 Tests (`test/siteos/`).
- Edge Function `siteos` als Router (ein Slot, mehrere Endpunkte). Client sendet an `siteos/edit` nur Reihenfolge + redaktionelle Felder (+ `base_sha256`).
- **Publish Gate** (5 Bedingungen) gebaut; Vier-Augen-Prinzip für Freigaben (#2006). Laut E2E-Audit 09/2026 **nie real ausgewertet**.
- Auslieferung: `cloudflare-deployer`/`website-domain-manager` deployt, aber **Cloudflare-Zugangsdaten fehlten** (Stand 04.09.2026) → kein Upload/Domain-Anbindung von Kundensites.

### 1.6 Edge Functions nach Auslöser (Auswahl, `docs/EDGE_FUNCTIONS_INVENTORY.md`)

| Auslöser | Beispiele |
|---|---|
| Frontend (invoke/fetch, JWT) | `ai-invoke`, `ai-gateway`, `governance-*` (approvals, dpias, dsr, incidents, risk-score, vendors, webhooks, keys …), `gdpr-export`/`gdpr-delete`, `evidence-export`, `evidence-vault-export`, `stripe-checkout`/`stripe-portal`, `tenant-invite`/`tenant-members`, `cookie-scan` |
| pg_cron | `scheduler-dispatch`, `governance-monitoring-scheduler`, `memory-decay-worker`, `governance-ingest`, `audit-recheck-weekly`, `daily-digest`, `stripe-meter-sync`, `sub-processor-notify` |
| Öffentlich / Webhook (`verify_jwt=false`) | `stripe-webhook`, `telegram-webhook`, `shopify-webhooks`, `newsletter-*`, `track-pageview`, `health`, `gdpr-audit`, `audit-report-pdf`/`-email`, `sales-lead` |
| Router-Functions | `siteos` (SiteOS-Endpunkte), `governance-router` (OpenAI-kompatibel) |
| Admin/out-of-band | `mfa-admin-reset` |

Gemeinsamer Code in `supabase/functions/_shared/` (u. a. `ai.ts`/`runAiTool`, `aiGateway/`, `pdp/`, `residencyGuard.ts`, `entitlements.ts`, `evidence-hash.ts`, `merkle.ts`, `provenanceCore.ts`, `redact.ts`, `rules/`).

### 1.7 KI-Stufen im Governance Router (aus Entitlements abgeleitet, keine eigene Preisliste)

| Stufe | Ableitung | Modelle |
|---|---|---|
| `observe` | Free (kein `ai.tool.automations`) | keine (403 `PLAN_REQUIRED`) |
| `studio` | Starter | nur EU-lokal |
| `growth` | Growth (`ai_calls` ≥ 2000) | + Cloud-Fallback |
| `agency` | ≥ 10 000 | + Cloud-Fallback |
| `sovereign` | Enterprise/Partner | + Cloud-Fallback, Vertrag begrenzt |

EU-lokale Residenz sperrt Cloud-Profile auf jeder Stufe. Kein Token-Streaming (Ein-Chunk-SSE-Hülle).

---

## 2. Datenmodell & Sicherheitsprinzipien (high level)

- **Mandantentrennung:** jede Fachtabelle mit `tenant_id`, RLS über `is_tenant_member()`/`memberships`; Rollen Owner/Admin/Editor/Viewer. RLS-Flag 368/368 gesetzt (09/2026); **Wirksamkeit einzelner Policies nicht gemessen**.
- **Service-Role nur in Edge Functions**, nie im Browser. Neuere Fixes prüfen Mitgliedschaft **vor** Service-Role-Zugriff (#1964).
- **SECURITY-DEFINER-Funktionen:** Prod deutlich restriktiver als ein frisch aus dem Repo aufgebautes Schema (08/2026: 17 vs. 93 für `anon` ausführbar); Härtung teils nachträglich als Migration reconciled (#2002). Regression-Test `security-regressions.db.test.ts`.
- **Gateway-JWT:** Default `verify_jwt=true`; öffentliche Webhooks/Endpunkte explizit in `config.toml` (`verify_jwt=false`). `ai-gateway` ist JWT-pflichtig (C-04 behoben 31.08.2026).
- **Jeder KI-Call wird protokolliert** (`ai_tool_runs`/`usage_events`); hash-verkettete Evidence pro Call bisher nur `ai-gateway` (#2015, 26.10.2026, Deploy unbelegt).
- **Evidence:** append-only, Hash-Kette (`append_governance_evidence`, `ai_evidence_events`-Trigger), Provenance-Signatur (Ed25519). Freigabe-Evidence seit #2015 in der Kette (vorher `content_hash: null`).
- **EU-Datenresidenz:** Supabase eu-central; Residenz pro Tenant/User (`cloud`/`eu_local`), Cloud bleibt Standard. EU-lokaler Pfad hatte laut Messung 19.09.2026 **0 Nutzer**; Betrieb/Standort des Inferenzservers unbelegt.
- **Datenminimierung:** Router-Prüfpfad ohne Prompt; Scanner minimiert Daten; Scan-Abruf lehnt private Adressen ab (SSRF-Schutz, #1860).
- **Frontend-Tracking:** First-Party-Pageview (`track-pageview`) und Marketing-Pixel nur nach Consent (`src/lib/pixels.ts`, `src/lib/track.ts`).
- **Sprachregel:** „unterstützt“, nie „garantiert/zertifiziert“ (`docs/runtime-status-matrix.md`).

---

## 3. Integrationen

Status: **live** (in Produktion belegt) · **beta** (gebaut, eingeschränkt/teilbelegt) · **geplant** · **defekt** (gebaut, aber nachweislich nicht funktionsfähig) · „unbelegt“ = kein aktueller Nachweis.

| Integration | Zweck | Status | Beleg |
|---|---|---|---|
| Supabase Postgres + RLS | Datenhaltung, Mandantentrennung | live | E2E-Audit 09/2026 §1, §11 |
| Supabase Edge Functions | gesamte Server-Logik (196 Verz.) | live | `supabase/functions/`, E2E-Audit §1 |
| Supabase Auth (E-Mail) | Login/Registrierung | live | `runtime-status-matrix.md` (Auth/RBAC 🟢) |
| OAuth Google / Microsoft (Azure) / LinkedIn / GitHub | Social Login | beta (Code verdrahtet, Provider-Aktivierung im Dashboard unbelegt) | `src/features/auth/OAuthProviderButtons.tsx`, `docs/oauth-setup.md` |
| Enterprise SSO / SCIM | Firmen-Login | geplant („Coming Soon“) | ADR 0007/0008, #2003 |
| MFA / Recovery | 2. Faktor | live (unbelegt aktuell) | `mfa-recovery-redeem`, `docs/security/mfa-plan.md` |
| Stripe Checkout / Portal / Webhook | Abo, Entitlements | beta – Code stark, Prod-Nachweis schwach (09/2026: 1 echtes Abo, `past_due`) | E2E-Audit §3; Fixes #1839, #1950, #1965 |
| Stripe Metering | Nutzungsabrechnung | unbelegt | `stripe-meter-sync`, `stripe-token-meter-sync` |
| Anthropic / OpenAI / Google | Cloud-Inferenz | live | `_shared/ai.ts` (`model_provider`), `_shared/aiGateway/` |
| LM Studio / Ollama (eu_local) | EU-lokale Inferenz | beta – Adapter vorhanden, 0 Nutzer (19.09.2026), Server-Betrieb unbelegt | `docs/product/governance-router.md`, `serverFromEnv.ts` |
| Governance Router (OpenAI-kompatibel) | Cursor/SDK über Governance-Schicht | live seit 08.09.2026, Nutzung 0 (19.09.) | `docs/product/governance-router.md` |
| MCP Governance Server | Agenten lesen Evidence (read-only, Key je Tenant) | beta – lokal lauffähig, öffentliches Hosting geplant; Evidence in Prod leer | `docs/MCP_GOVERNANCE_SERVER.md`, `apps/mcp-server/` |
| Cloudflare Pages | Hosting SPA | live | `wrangler.toml`, `deploy-cloudflare-pages.yml`, PRODUCTION_BLOCKERS §3 |
| Cloudflare Web Analytics / Turnstile | Analytics, Bot-Schutz im Audit | live (Code/CSP) | `index.html`, `AuditTurnstileWidget.tsx`, `public/_headers` |
| Cloudflare Worker `siteos-preview` (KV) | Vorschau-Hosting SiteOS | beta – ohne Secrets `not_configured` | `workers/siteos-preview/README.md` |
| Cloudflare Worker GOVARD Gateway (D1/R2/DO) | Gateway vor externen Agenten | geplant – D1-ID Platzhalter, Deploy überspringt sich | `workers/govard-gateway/wrangler.jsonc` |
| Cloudflare verify-jwt-Canary, KV-Cache, R2-Evidence | Edge-Auth, Policy-Cache, Archiv | geplant/unbelegt (Doku „Implementation Complete“ 07/2026) | `docs/phase-2b-*.md`, `docs/r2-lifecycle-policy.md` |
| SiteOS-Deploy auf Cloudflare | Kundensites veröffentlichen | defekt/blockiert – Zugangsdaten fehlen | `SITEOS_ARCHITECTURE.md` §6 |
| Resend (E-Mail) | Welcome, Audit-Report, DOI, Digest | live laut Runbook, aktuell unbelegt | `docs/runbooks/resend-production-email.md`, #1936 |
| Sentry | Fehler-Monitoring | beta – Aktivierung (DSN) unbelegt | `docs/runbooks/sentry-setup.md`, PRODUCTION_BLOCKERS §5 |
| First-Party-Pageviews | Analytics nach Consent | live (Code) | `src/lib/track.ts` |
| GA4/GTM, Meta, TikTok, LinkedIn Pixel | Marketing-Attribution nach Consent | beta – nur aktiv, wenn Pixel-ID gesetzt; unbelegt | `src/lib/pixels.ts`, CSP in `public/_headers` |
| C2PA / Provenance | Herkunftsnachweis für Inhalte | beta – `provenance` live seit 08/2026, C2PA-Manifest unbelegt | `c2pa-manifest-generate`, `provenance`, `edge-function-kontingent.md` |
| Security Signals (blacklens, Cloudflare, GitHub, SIEM) | Findings → Risk → Control → Evidence | beta/unbelegt | `docs/security-signal-integration.md`, `security-signal-ingest` |
| Microsoft 365 Connector | Audit-Sync als Evidence | beta – Functions live, Connector-Registry leer (Prototyp) | E2E-Audit §1, §6 |
| Shopify (Install/OAuth/Webhooks/Scan) | Shop-Compliance-Scan | unbelegt | `shopify-*` Functions |
| Telegram | Agent-Gateway-Bot | beta/unbelegt | `docs/integrations/telegram.md`, `telegram-webhook` |
| WhatsApp / Voice (Twilio) | Bot-Kanäle | beta – Persistenz vor PEP noch offen; Voice-Leerzustand (#1917) | `ai-residency-…-2026-10-21.md`, `bot-voice-webhook` |
| n8n | Trial-Events/Automationen | geplant/optional | `docs/STRIPE_TRIAL_WEBHOOK.md` |
| Perplexity- / Hostinger-MCP | Entwickler-Werkzeuge (Recherche, VPS/DNS) | nur Dev-Session, nicht im Produkt; `.mcp.json` für Website-Sessions leer | `docs/integrations/*-mcp.md`, CLAUDE.md |
| Playwright-Scanner (Deep Cookie Scan) | JS-gerenderter Cookie-Scan | beta – Deployment laut Matrix ausstehend | `runtime-status-matrix.md`, `deploy-playwright-scanner.yml` |

---

## 4. Offene Fehler / technische Schulden

GitHub-Issues sind hier **nicht** erfasst → **GitHub-Issues separat prüfen.**
Quellen: Masterplan (26.10.2026), Security-Draft (21.10.2026), E2E-Audit (06.09.2026), P0-Security (30.08.2026), Runtime-Matrix, Code-Greps.

| Problem | Bereich | Schwere | Beleg |
|---|---|---|---|
| Cron-Functions `scheduler-dispatch`, `governance-monitoring-scheduler`, `memory-decay-worker` liefern **HTTP 500**, keine erfolgreichen Läufe (24 h); wahrscheinlich fehlende Cron-Function-Secrets | Betrieb | hoch | Masterplan I-4 / P0-1; `docs/runbooks/cron-vault-secrets.md` |
| Ausfälle bleiben unbemerkt – kein Alarm auf Nicht-2xx der Crons (seit 08.10. nur manuell aufgefallen) | Monitoring | hoch | Masterplan P0-2 |
| Evidence-Kette in Prod praktisch leer (09/2026: `ai_evidence_events`, `evidence_snapshots`, `governance_approvals`, `runtime_events` = 0 Zeilen) – Prüfpfad-Versprechen unbelegt | Governance/Evidence | hoch | E2E-Audit §7, §14 |
| KI-Call-Evidence (P0-3) und verkettete Freigabe-Evidence (P0-4) gemergt (#2015), **Deploy und Laufzeitnachweis unbelegt**; fail-open vs. fail-closed bei Evidence-Schreibfehler offen | Evidence | hoch | Masterplan §6/§8, Commit `a0ad27b` |
| Residency fail-closed + Bot-PEP (#1966) gemergt; QA-Gates (E2E, 503-Verhalten, alle `runAiTool`-Aufrufer) offen; WhatsApp/Voice persistieren noch vor PEP | Sicherheit/DSGVO | hoch | `docs/security/ai-residency-fail-closed-release-gates-2026-10-21.md` |
| `governance-agent`-Legacy-US-Pfad bei `user_choice` möglich; PDP in `ai-gateway`/`governance-router` nur `shadow` | Sicherheit/Residenz | hoch | dito, „Unverändert offene P0-Arbeiten“ |
| Zwei KI-Stacks: `_shared/aiGateway/` (feste Kette lokal → Anthropic → OpenAI, ohne Tenant) neben `runAiTool`; AVV-Zusage juristisch prüfen | Architektur/Recht | hoch | P0_SECURITY_2026-08-30 „C-05“ |
| `pdp_shadow_log` = 0 Zeilen → Enforcement-Umschaltung nicht begründbar | Policy | mittel | E2E-Audit §8 |
| Stripe-Bezahlpfad kaum in Prod gegangen; einziger Stripe-E2E-Test `test.skip` ohne `STRIPE_TEST_MODE`; kein E2E Webhook → Entitlement → Dashboard | Billing/Tests | hoch | E2E-Audit §3, §12 |
| Onboarding nie durchlaufen (`customer_onboarding`, `company_profiles` = 0) | Funnel | mittel | E2E-Audit §2 |
| Repo-Schema offener als Prod (SECURITY DEFINER für `anon`); Neuaufbau aus Repo wäre unsicherer | Sicherheit/DB | mittel | P0_SECURITY „Repo ist offener als Produktion“; #2002 teilweise |
| Mock-Daten in öffentlich erreichbarem `/dashboard/enterprise-ai-os` (`mockAiSystems`) | Ehrlichkeit/Claims | mittel | Masterplan I-3; `src/pages/EnterpriseAiOsDashboard.tsx` |
| Claims „revisionssicher“ u. ä. ohne Evidence-Basis | Recht/Marketing | hoch | E2E-Audit §13 |
| Kein Router-Guard für `/admin/*`, `/dashboard/*` (Komponenten/RPCs prüfen serverseitig) | Defense-in-Depth | niedrig | Masterplan I-2 |
| Connector-Registry leer; M365 nur Prototyp | Integrationen | mittel | E2E-Audit §6 |
| SiteOS: Publish-Pfad ohne Cloudflare-Zugangsdaten, Publish Gate nie ausgewertet | Builder | mittel | SITEOS_ARCHITECTURE §6; E2E-Audit §10 |
| Edge-Function-Wildwuchs: Cluster `enterprise-ai-os-*` (8) parallel zu `governance-agent`; `automation-*` vs. `workflow-*`; `governance-analytics-aggregator` ohne Cron | Architektur | mittel | `docs/EDGE_FUNCTIONS_INVENTORY.md` |
| Routen-Breite (~517 Routen, ~425 rendernd), mehrere Dashboards/Onboarding-Einstiege | Wartbarkeit/UX | mittel | Masterplan I-1, I-10 (Prüfbefund) |
| VPS-Deploy-Workflows (`deploy-frontend-vps*.yml`) laufen „grün“, bedienen aber nicht die Produktion (falsch-positive Verifikation) | CI/CD | mittel | PRODUCTION_BLOCKERS §3 |
| Drei Browser-Extensions ohne kanonische Variante | Wartbarkeit | niedrig | runtime-status-matrix „Offene Folgearbeiten“ 3 |
| CSP noch mit `unsafe-inline`/Tracker-Origins; Nonce-Umstellung offen | Sicherheit | niedrig | runtime-status-matrix Folgearbeit 2; `public/_headers` |
| Ratenbegrenzung MCP-Server nur je Instanz; keine Key-Rotation | MCP | niedrig | `MCP_GOVERNANCE_SERVER.md` §7 |
| Altlast-DB-Tests in `test/runtime/db/` scheitern gegen volles Schema | Tests | niedrig | P0_SECURITY „Altlast-DB-Tests“ |
| Widersprüchliche Doku: Router-Doku nennt Residenz fail-open (überholt durch #1966); Matrix nennt Hostinger/nginx-Header (Hosting ist Cloudflare); Edge-Inventar „~84“ vs. 196 | Doku | niedrig | jeweilige Dateien |
| USt-IdNr. im Impressum fehlt (TODO Owner) | Recht | mittel | `src/features/legal/Impressum.tsx:133`, `src/enterprise-os/pages/LegalPage.tsx:138` |

**TODO/FIXME-Bestand in `src/`:** 6 `TODO`, 0 `FIXME`, 0 `HACK` (Grep 27.10.2026). Hotspots: USt-IdNr. (2× Impressum/Legal), Claude-Code-Optimizer-Backend „Phase 3“ (`src/pages/optimizer/OptimizerOptimizing.tsx`, `OptimizerComplete.tsx`), Blog-Platzhalter (`src/pages/Blog.tsx`). Technische Schuld steckt weniger in Markern als in den Audit-Befunden oben.

**Bereits behoben (zur Einordnung):** `RiskDashboard` übergibt jetzt `tenant_id` statt User-ID; `ai-gateway` JWT-pflichtig; `create_api_key` nur `service_role` (#1943); kaputte Edge-Function-Anbindungen (#1900, #1929); EU-AI-Act-Probe prüft „irgendein“ statt „alle“ Keywords (#2020); KI-Register-Auswahl (#2022).

---

## 5. Build / Deploy / CI in Kürze

**Wichtige npm-Scripts** (57 insgesamt):
- Entwicklung/Build: `dev`, `build` (= `build:base` + `prerender:safe`, Git-Integration), `build:full` (strikter Prerender, Actions), `build:base` (`vite build` + `generate:legal-pages`), `preview`, `clean`
- Qualität: `lint` (`tsc --noEmit`), `test` (Vitest), `test:db`, `e2e`/`test:e2e` (Playwright), `qa:*`
- Guards: `check:context`, `check:edge-functions`, `check:edge-refs`, `check:edge-syntax`, `check:function-acls`, `check:migration-collisions`, `check:entitlements`, `check:plan-gates`, `check:pricing`, `check:offer-prices`, `check:landing-claims`, `check:fabrication`, `check:dead`, `check:sitemap`, `check:cron-health`, `check:production`, `smoke:production`
- Billing/Sync: `sync:pricing`, `sync:model-prices`, `stripe:diff`, `stripe:sync`, `gen:plan-catalog`, `gen:entitlement-mirror`
- Git: `sync:main` (Rebase auf `origin/main`), `merge:hygiene`, `release:merge`, `release:publish`

**Deploy:** Frontend → Cloudflare Pages (Git-Integration mit `npm run build`; alternativ Actions `deploy-cloudflare-pages.yml` mit `build:full`). Backend → `supabase functions deploy` / `db push` über Workflows. Merge/Deploy nur mit Owner-Freigabe; Squash-only, kein Direkt-Push auf `main`.

**GitHub-Actions-Workflows (38):**
- CI/Qualität: `ci.yml`, `e2e.yml`, `lighthouse-ci.yml`, `codeql.yml`, `cta-enforcement.yml`, `merge-hygiene.yml`, `pre-deploy-check.yml`, `siteos-production-e2e.yml`, `backend-services-ci.yml`
- Drift-Guards: `edge-function-drift.yml`, `migration-drift.yml`, `migration-collision.yml`, `migration-reconciliation.yml`, `entitlement-drift.yml`, `function-acl-drift.yml`, `drift-alert.yml`, `cron-health.yml`
- Deploy Frontend: `deploy-cloudflare-pages.yml`, `deploy-frontend-production.yml`, `deploy-frontend-vps.yml`, `deploy-frontend-vps-production.yml`, `cloudflare-domain-cutover.yml`
- Deploy Backend/Services: `deploy.yml`, `deploy-backend-cloudflare.yml`, `deploy-siteos-preview.yml`, `deploy-govard-gateway.yml`, `provision-govard-gateway.yml`, `deploy-playwright-scanner.yml`, `deploy-agent-runtime-vps.yml`, `docker-deploy.yml`
- Wartung: `list-edge-functions.yml`, `delete-edge-function.yml`, `enable-leaked-password-protection.yml`, `tracker-db-update.yml`, `vps-backup.yml`, `ssh-setup.yml`, `branch-cleanup.yml`, `auto-merge.yml`

---

## 6. Quellen

- `CLAUDE.md` (Stack, Verbote, Scope)
- `docs/ARCHITECTURE_CURRENT.md` (Stand 13.08.2026)
- `docs/SITEOS_ARCHITECTURE.md` (§1, §5b–5d, §6)
- `docs/EDGE_FUNCTIONS_INVENTORY.md` (Juni 2026, Zahl veraltet)
- `docs/product/realsync-os-kernel.md`, `docs/product/governance-router.md`
- `docs/MCP_GOVERNANCE_SERVER.md`
- `docs/runtime-status-matrix.md` (validiert 16.05.2026, teils veraltet)
- `docs/strategy/MASTERPLAN_2026-2027.md` (26.10.2026, aktuellste Befundlage)
- `docs/security/ai-residency-fail-closed-release-gates-2026-10-21.md`
- `docs/audit/PRODUCTION_E2E_REALITY_2026-09.md` (06.09.2026)
- `docs/audits/P0_SECURITY_2026-08-30.md`
- `docs/runtime/PRODUCTION_BLOCKERS.md`, `docs/runbooks/edge-function-kontingent.md`, `docs/runbooks/cron-vault-secrets.md`
- `docs/integrations/` (telegram, hostinger-mcp, perplexity-mcp), `docs/oauth-setup.md`, `docs/security-signal-integration.md`, `docs/runbooks/{resend-production-email,sentry-setup,stripe-production-checkout}.md`
- `docs/phase-2b-*.md`, `docs/r2-lifecycle-policy.md`, `workers/*/README.md`
- Code: `package.json`, `wrangler.toml`, `wrangler-workers.toml`, `public/_headers`, `src/lib/{track,pixels}.ts`, `src/features/auth/OAuthProviderButtons.tsx`, `supabase/functions/_shared/{ai.ts,aiGateway/}`
- Weitere Berichte nur dem Namen nach: `docs/reports/production-readiness-2026-06-10.md`, `docs/qa/*` (Juni 2026)
- `git log --oneline -60` (Fix-Commits bis #2040)
- Nicht geprüft: GitHub-Issues, Live-Abgleich Repo ↔ Prod zum heutigen Tag, Wirksamkeit einzelner RLS-Policies
