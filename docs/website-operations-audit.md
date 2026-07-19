# Website Operations Layer — Audit & Integration Plan

**Datum:** 2026-07-17  
**Status:** Pre-Implementation Audit  
**Branch:** `claude/website-operations-layer-qgcho4`

---

## Executive Summary

RealSyncDynamics.AI verfügt **bereits über ein produktives Website-Rebuild-System** (Phase 1, seit Mai 2026). Diese Audit dokumentiert die bestehenden Komponenten und plant die Erweiterung zu einer vollständigen **AI Website Operations Layer** für kleine Unternehmen (Tattoo-Studios, Handwerker, lokale Dienstleister).

**Kernfeststellung:** Das bestehende `website_rebuilds`-System ist **wiederverwendbar und erweiterbar**. Keine Neuimplementierung nötig.

---

## 1. Bestehende Website-Infrastruktur

### 1.1 Datenbank (Migrationen seit 2026-05-08)

#### `website_rebuilds` Tabelle
- **Zweck:** Speichert Rebuild-Jobs für DSGVO-konforme Website-Konvertierung
- **Tier-System:** `managed` | `premium` | `enterprise`
- **Status-Workflow:** `queued` → `running` → `preview_ready` → `live` | `failed`
- **Felder:**
  - `tenant_id` (nullable — Public Trial möglich)
  - `audit_id` (FK zu gdpr_audits)
  - `source_url`, `source_domain`
  - `customer_email`, `company`
  - `current_step`, `completed_steps[]` (Resume-Logik)
  - `preview_url`, `bundle_path` (Storage-Integration)
  - `workflow_version` (Versionierung)

#### `website_rebuild_steps` Tabelle
- Audit-Trail für jeden Step mit Fehlerstatus
- Step-Namen: `scrape`, `audit`, `strip_trackers`, `self_host`, `inject_consent`, `legal_pages`, `ai_ready`, `package_deploy`
- Ermöglicht Resume nach Crash ohne Neustart

#### RLS-Policies
- Super-Admin: globale Read-Zugriff
- Tenant-Member: sehen nur ihre Rebuilds
- Public Trial: via `get_rebuild_status_by_token` RPC (Email-Hash + ID Lookup)

**Migrationen:**
- `20260508040000_website_rebuilds.sql` — Initial Schema
- `20260509010000_rebuild_status_rpc.sql` — Status-Lookup RPC
- `20260509030000_website_rebuilds_checkout_patch.sql` — Stripe-Integration
- `20260509040000_rebuild_status_rpc_v2.sql` — RPC-Verbesserung

---

### 1.2 Edge Functions (Produktiv, seit 05/2026)

#### `rebuild-website` (Orchestrator)
- **Input:** POST Body mit `source_url`, `customer_email`, `company`, `audit_id`, `tenant_id`
- **Workflow:** Sequenzielle Ausführung der 8 Steps
- **Resumeable:** Besteht aus 9 Step-Funktionen in `_shared/website-rebuild/`

#### `checkout-website-rebuild`
- Triggered nach Stripe-Checkout des "Managed Website"-Produkts
- Erstellt `website_rebuilds`-Eintrag mit `tenant_id`

#### Shared Step-Funktionen (`_shared/website-rebuild/`)
1. **`scrape.ts`** — HTML/CSS/Assets von Quell-URL holen
2. **`strip-trackers.ts`** — GA, FB-Pixel, 3rd-Party-Fonts entfernen
3. **`self-host.ts`** — Web-Fonts + unkritische Embeds selbst hosten
4. **`inject-consent.ts`** — Cookie-Banner-SDK ins `<head>` einfügen
5. **`ai-ready.ts`** — `llms.txt`, JSON-LD, `ai-info`-Endpoint, OG-Meta
6. **`legal-pages.ts`** — DSE, Impressum, AVV generieren
7. **`package-deploy.ts`** — Bundle in Storage, Preview-URL

**Pfad:** `supabase/functions/rebuild-website/`

---

### 1.3 Frontend (Pages + Features)

Prüfung ergab **keine dedizierte Website-Builder-UI** im Frontend:
- Bestehende `src/pages/` hat 104+ Landing Pages (Marketing/Governance-fokussiert)
- Kein Website-Builder-Dashboard in `src/features/`

**Implikation:** Website Operations UI muss neu erstellt werden (Dashboard, Builder-Wizard, Deployment-Status).

---

### 1.4 Compliance & Security

#### Bestehend
- GDPR-Audit (Integration in `rebuild-website` über `audit_id`)
- Tracker-Stripping (automatisch)
- Cookie-Consent-Injection (automatisch)
- Legal-Pages-Auto-Generation (Placeholder)
- RLS auf `website_rebuilds`, `website_rebuild_steps`

#### Sicherheit
- Service-Role-Keys nur in Edge Functions (korrekt)
- Tenant-Isolation über RLS
- Audit-Logging über `website_rebuild_steps`
- Keine bekannten Vulnerabilities in bestehenden Code

---

## 2. Bestehende AI & Agenten-Infrastruktur

### 2.1 AI-Integration

**Verfügbar:**
- Anthropic SDK 0.32.1 (Claude 3.5 Sonnet)
- Google GenAI 1.29.0
- OpenAI 4.77.0
- Ollama (lokal, EU-Fallback)

**In `supabase/functions/`:**
- `ai-invoke` (Gateway)
- `ai-gateway` (Routing)
- `governance-agent` (Compliance-Checks)
- `remediation-agent` (Vulnerability-Fixes)

### 2.2 Bestehende Agenten

| Agent | Zweck | Status |
|-------|-------|--------|
| `agent-os-runner` | OS-Level-Orchestration | Produktiv |
| `governance-agent` | Compliance-Bewertung | Produktiv |
| `remediation-agent` | Vulnerability-Remediation | Produktiv |
| `enterprise-ai-os-agents-run` | Enterprise-Agenten-Executor | Produktiv |

**Implikation:** Neue `website-operations-agent` kann diese Infrastruktur nutzen.

---

## 3. Deployment & Infrastruktur

### 3.1 Bestehende Systeme

| System | Status | Relevanz |
|--------|--------|----------|
| **Supabase Cloud** | Produktiv | RLS, Auth, Edge Functions, Storage |
| **Stripe** | Integriert | Checkout-Flow, Subscription-Metered-Billing |
| **Cloudflare** | Minimal genutzt | CDN-Erwähnung, keine Pages/Workers-Integration |
| **n8n** | Deployment vorhanden | Workflow-Automation möglich |
| **Sentry** | 8.55.2 | Error-Tracking |
| **GitHub Actions** | `.github/workflows/` | Deployment zu Staging/Prod |

### 3.2 Deployment-Pipeline (Bestehend)

```
Push zu main
  ↓
GitHub Actions
  ↓
`supabase db push` (Migrations)
`supabase functions deploy` (Edge Functions)
  ↓
Prod (Supabase Cloud)
```

**Erkenntnis:** Cloudflare Pages/Workers sind **noch nicht in den Workflow integriert**. Website-Deploy-Ziele müssen definiert werden.

---

## 4. Fehlende Module (Website Operations Layer)

### 4.1 Datenmodell-Erweiterungen

```sql
-- Website Projects (Master-Tabelle)
CREATE TABLE website_projects (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL (RLS),
  name VARCHAR,
  industry VARCHAR,
  status VARCHAR ('draft'|'preview'|'live'|'archived'),
  template VARCHAR,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Deployment Logs
CREATE TABLE deployment_logs (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL (FK),
  event VARCHAR,
  status VARCHAR,
  message TEXT,
  timestamp TIMESTAMP
);

-- Compliance Reports (Website-spezifisch)
CREATE TABLE website_compliance_reports (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL (FK),
  score DECIMAL(5,2),
  findings JSONB,
  created_at TIMESTAMP
);

-- Domain Mapping
CREATE TABLE website_domains (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL (FK),
  domain VARCHAR UNIQUE,
  cloudflare_zone_id VARCHAR,
  cloudflare_record_id VARCHAR,
  ssl_status VARCHAR,
  created_at TIMESTAMP
);
```

### 4.2 Edge Functions (Neu)

**Kandidaten:**

1. **`website-operations-agent`** — Orchestrator für AI-generierte Website-Erstellung
   - Input: Branche, Unternehmen, Leistungen, Bilder
   - Output: Website-Struktur, SEO, Compliance-Check

2. **`website-builder`** — Template-Engine (nächste Phase)
   - Hero, Services, About, Galerie, Kontakt, FAQ, Bewertungen

3. **`website-domain-manager`** — Domain-Validierung + DNS-Setup
   - Cloudflare Zone-Erstellung
   - DNS-Record-Validierung
   - SSL-Aktivierung

4. **`website-compliance-check`** — DSGVO + EU AI Act Validierung
   - HTML-Scanning
   - Cookie-Audit
   - Datenschutz-Hinweise

5. **`website-maintenance-agent`** — Automatische Überwachung
   - Performance-Analyse
   - SEO-Verbesserung
   - Broken-Link-Detection
   - Security-Scanning

### 4.3 Frontend (Neu)

**Zielstruktur:**

```
src/features/website-operations/
├── WebsiteOperationsDashboard.tsx (Master-View)
├── CreateWebsiteWizard.tsx (Multi-Step Onboarding)
├── WebsiteBuilder.tsx (Component-Editor)
├── DeploymentStatus.tsx (Live-Status)
├── DomainManager.tsx (Domain + SSL)
├── ComplianceScoreboard.tsx (DSGVO + EU AI Act)
├── MaintenanceAgent.tsx (Auto-Suggestions)
└── hooks/
    ├── useWebsiteProject.ts
    ├── useDeployment.ts
    ├── useCompliance.ts
```

**Design:** Dark Futuristic Theme (Cyan + Magenta Akzente, bestehender RealSync-Style)

### 4.4 API Endpoints (Neu)

```
POST   /api/website-projects/create
POST   /api/website-projects/:id/build
POST   /api/website-projects/:id/deploy
GET    /api/website-projects/:id/status
POST   /api/website-domains/connect
GET    /api/website-compliance/:id
GET    /api/website-maintenance/suggestions
```

---

## 5. Cloudflare Integration (Planung)

### 5.1 Nutzen

- **Pages:** Deploy statischer HTML/CSS/JS
- **Workers:** API-Proxy, Authentication, Analytics
- **R2:** Asset-Storage (Bilder, Fonts)
- **SSL:** Automatische Zertifikat-Verwaltung
- **Preview Deployments:** URL für Kunden vor Live-Schaltung

### 5.2 Workflow

```
Website komplett
  ↓
Security-Scan + Compliance-Check
  ↓
Build-Artefakte → Cloudflare R2
  ↓
Pages-Deployment → cloudflare-pages-project
  ↓
Domain-DNS-Validierung
  ↓
SSL aktivieren
  ↓
Monitoring starten
```

### 5.3 Implementierung

- **Neue Edge Function:** `cloudflare-deployer` (mit API-Key)
- **neue Env-Variablen:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Secrets:** Im Supabase-Dashboard speichern, nicht in .env

---

## 6. Wiederverwendbare Komponenten

### 6.1 Bestehende Shared-Utilities

**In `supabase/functions/_shared/`:**
- `gateway.ts` — CORS, JSON-Responses
- `website-rebuild/` — Alle 8 Steps
- `compliance-check/` — GDPR-Audit-Integration

**In `src/lib/`:**
- `auth.ts` — Supabase-Auth-Integration
- `compliance.ts` (prüfen!)
- `tracking.ts` — Telemetry

### 6.2 Bestehende UI-Komponenten

**In `src/components/`:**
- `Card.tsx`, `Modal.tsx`, `Badge.tsx` (Core UI)
- `runtime/` — Status-Cards, Feeds (für Website-Status verwendbar)

**Empfehlung:** `RuntimeStatusPill.tsx` + `RuntimeCard.tsx` für Deployment-Status-UI anpassen.

---

## 7. Implementierungs-Roadmap

### Phase 1: Audit & Planung ✅
- [x] Bestehende Architecture dokumentieren
- [x] Wiederverwendbare Komponenten identifizieren
- [x] Fehlende Module auflisten

### Phase 2: Datenmodell (1-2 Tage)
- [ ] Migrations schreiben (`website_projects`, `deployment_logs`, etc.)
- [ ] RLS-Policies implementieren
- [ ] Indices für Performance

### Phase 3: Website Creation Agent (3-4 Tage)
- [ ] `website-operations-agent` Edge Function
- [ ] Branche → Template-Mapping
- [ ] AI-Prompt-Engineering für Website-Generation
- [ ] Compliance-Check integration

### Phase 4: Frontend Dashboard (3-5 Tage)
- [ ] `WebsiteOperationsDashboard.tsx`
- [ ] `CreateWebsiteWizard.tsx` (Multi-Step)
- [ ] Deployment-Status-Anzeige
- [ ] Domain-Manager-UI

### Phase 5: Cloudflare Integration (2-3 Tage)
- [ ] `cloudflare-deployer` Edge Function
- [ ] Pages-Deployment-Flow
- [ ] Domain-SSL-Setup-Automation
- [ ] Preview URL Generation

### Phase 6: Maintenance Agent (2-3 Tage)
- [ ] `website-maintenance-agent`
- [ ] Periodische Checks (Cron)
- [ ] Performance-Metriken
- [ ] SEO-Empfehlungen

### Phase 7: Testing & Documentation (1-2 Tage)
- [ ] Unit-Tests (Vitest)
- [ ] E2E-Tests (Playwright)
- [ ] Implementation-Docs

**Total Estimate:** 12-20 Tage (mit Parallelisierung: 8-12 Tage)

---

## 8. Abhängigkeiten & Risiken

### 8.1 Abhängigkeiten

| Dependency | Status | Risk |
|-----------|--------|------|
| Supabase Storage (R2 alternative) | ✅ Vorhanden | Low — bereits genutzt |
| Stripe Webhook | ✅ Integriert | Low — bestehend |
| Cloudflare API | ⚠️ Config nötig | Medium — neue Credentials |
| Email-Versand | ✅ Existing | Low — audit-report-email vorhanden |
| AI Models | ✅ Integriert | Low — Anthropic SDK aktiv |

### 8.2 Risiken & Mitigationen

| Risiko | Severity | Mitigation |
|--------|----------|-----------|
| Cloudflare Rate-Limits | Medium | Caching + Batch-Requests |
| HTML-Scraping-Fehler | Medium | Fallback-Logik + Manual-Review-Mode |
| DSGVO-Compliance bei generierten Sites | High | AI-Agent mit Compliance-Prompts + Review-Step |
| Domain-DNS-Propagation-Delay | Low | Status-Polling mit Backoff |
| Storage-Quota | Low | Cleanup-Cron für alte Builds |

---

## 9. Single Source of Truth — Config-Architektur

**Bestehende Pattern:** `src/config/` enthält zentrale Definitionen.

**Neue Konfigurationen:**

```typescript
// src/config/website-templates.ts
export const WEBSITE_TEMPLATES = {
  'tattoo-studio': { ... },
  'handwerker': { ... },
  'dienstleister': { ... },
  'einzelunternehmer': { ... },
};

// src/config/compliance-rules.ts
export const DSGVO_REQUIREMENTS = { ... };
export const EU_AI_ACT_CHECKS = { ... };

// src/config/cloudflare-settings.ts
export const CLOUDFLARE_CONFIG = {
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  pagesProjectName: 'realsyncdynamics-customer-sites',
  r2BucketName: 'realsyncdynamics-websites',
};
```

---

## 10. Nächste Schritte

### Sofort (Diese Session)

1. ✅ Audit-Dokument erstellen (DIESER BERICHT)
2. Phase 2 starten: Migrations schreiben
   - `website_projects` Tabelle
   - `deployment_logs` Tabelle
   - `website_compliance_reports` Tabelle
   - `website_domains` Tabelle
   - RLS-Policies für alle

3. Config-Dateien anlegen
   - `src/config/website-templates.ts`
   - `src/config/cloudflare-settings.ts`

### Diese Woche

4. Edge Function: `website-operations-agent`
5. Frontend: `WebsiteOperationsDashboard`
6. Testing-Grundlagen

### Nächste Woche

7. Cloudflare Integration
8. Maintenance Agent
9. E2E Tests + Docs

---

## 11. Code-Referenzen (Wiederverwendbar)

### Bestehende Patterns

**Website Rebuild → Status**
```typescript
// Aus rebuild-website/index.ts
const { data: existing } = await admin
  .from('website_rebuilds').select('*').eq('id', body.rebuild_id).single();
```

**RLS Query**
```sql
-- Aus website_rebuilds-Migration
WHERE tenant_id IS NOT NULL
  AND public.is_tenant_member(tenant_id)
```

**Edge Function Template**
```typescript
// Aus rebuild-website/index.ts
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/gateway.ts';
Deno.serve(async (req) => {
  const preflight = handleOptions(req); if (preflight) return preflight;
  // ...
});
```

---

## 12. Erfolgs-Metriken

Nach Phase 7:

- ✅ Website aus Branche + Unternehmensinfo generiert
- ✅ Automatisches DSGVO-Compliance-Checking
- ✅ Deployment zu Cloudflare Pages in < 5 Min
- ✅ Domain-SSL-Setup vollautomatisch
- ✅ Maintenance-Agent mit KI-Vorschlägen
- ✅ E2E-Tests für kritische Flows
- ✅ Documentation vollständig

---

## Anhang: Datei-Inventar

### Existierende Kern-Dateien (NICHT anfassen)
- `supabase/migrations/20260508040000_website_rebuilds.sql` — Schema
- `supabase/functions/rebuild-website/` — Orchestrator
- `supabase/functions/_shared/website-rebuild/` — Steps

### Neue Dateien (zu erstellen)
- `supabase/migrations/20260717_website_operations_core.sql`
- `supabase/functions/website-operations-agent/index.ts`
- `src/features/website-operations/` (komplett neu)
- `src/config/website-templates.ts` (neu)
- `docs/website-operations-implementation.md` (nach Completion)

---

**Audit abgeschlossen: 2026-07-17**  
**Nächster Step: Phase 2 — Datenmodell-Migrationen**
