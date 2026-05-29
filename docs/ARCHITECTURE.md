# RealSyncDynamics.AI — Zielarchitektur

**Status:** Strategisches Referenz-Dokument
**Letzte Aktualisierung:** 2026-05-07
**Verbundene ADRs:** [0001](./adr/0001-stay-on-supabase-gh-pages-for-v1.md) (current), [0002](./adr/0002-future-monorepo-migration.md) (deferred)

Dieses Dokument beschreibt die langfristige Zielarchitektur. Die aktuelle
Implementierung ist bewusst eine *pragmatische v1* (siehe ADR 0001) und wird
schrittweise an dieses Ziel herangeführt.

## Strategische Weichenstellung

Der entscheidende Punkt: **nicht Tool-first bauen, sondern Event-/System-first.**

Wir sind **kein DSGVO-Generator-Anbieter**, sondern eine
**Continuous-Compliance-Infrastructure**. Ausrichtung muss härter werden auf:

- API-first
- Rule-Engine-driven
- Multi-Tenant
- Evidence-based Compliance
- Async Audit Pipelines

## 6 Kern-Domänen

Klare Schnitt-Linien, damit das System nicht in einem „God-Backend" endet:

| Domain | Verantwortung |
|---|---|
| **Identity** | Auth, Tenants, Rollen |
| **Systems** | Websites/APIs/Apps verwalten |
| **Audit** | Crawling + Findings |
| **Compliance** | DSGVO/AI-Act Rule Engine |
| **Documents** | DSE/AVV/VVT/DSFA |
| **AI Runtime** | Chatbot + AI Governance |

## Tech-Stack (Ziel)

| Layer | Empfehlung | Begründung |
|---|---|---|
| Frontend | Next.js App Router | SSR + SEO + große Ökosystem |
| API | Fastify | TS-native, schneller als Express |
| ORM | Prisma | Type-safe, gute Migrations |
| DB | PostgreSQL | RLS-fähig, EU-hostbar |
| Queue | BullMQ + Redis | Robust, retry-fähig |
| Crawl | Playwright | Real-Browser-Render |
| Search | Meilisearch / OpenSearch | Schnelle Findings-Suche |
| Storage | S3-kompatibel (MinIO) | Evidence-Files, PDFs |
| Auth | Keycloak oder Auth.js | SSO/OIDC-tauglich |
| Realtime | WebSockets / SSE | Live-Audit-Status |
| Infra | Docker + Coolify oder K8s | EU-self-hostbar |
| AI | OpenAI-kompatibles Gateway | Provider-agnostisch |

**Sprache:** Node.js + TypeScript, weil:
- Playwright/Crawling extrem stark in JS-Ökosystem
- JSON-Schema-Tooling reichhaltig
- AI-/LLM-Integration einfacher als in Go
- Schnellere Iteration für Product-Velocity

Go wäre erst sinnvoll bei:
- Extremem Throughput (>1000 Audits/Stunde)
- Eigener großer Crawl-Infrastruktur
- Performance-kritischer Inner-Loop

Für Product-Velocity gewinnt TypeScript.

## Architektur-Bausteine

### 1. Evidence Layer (kritisch)

Compliance ohne Evidenz ist wertlos. Pro Finding mindestens eine Evidence-Reference:

```sql
audit_evidence
  - id              UUID PK
  - audit_id        UUID FK
  - type            ENUM('screenshot', 'request_log', 'cookie_dump',
                          'dom_snapshot', 'script_reference')
  - payload_json    JSONB       -- strukturiert
  - storage_url     TEXT        -- S3-Object-URL
  - created_at      TIMESTAMPTZ
```

Beispiele:
- Screenshot vom Cookie-Banner
- Network-Request an `google-analytics.com/collect` *vor* Consent
- DOM-Snapshot mit fehlendem Chatbot-Disclosure
- Script-URL-Liste ohne Anonymisierung

**Wert:** PDF-Beweis, Audit-Historie, DSB-Export, Enterprise-Trust.

### 2. Rule Engine (entkoppelt)

Falsch:
```typescript
if (googleAnalytics && noConsent) { findings.push(...) }
```

Richtig (versionierte JSON-Regel):
```json
{
  "id": "GA4_WITHOUT_CONSENT",
  "category": "tracking",
  "severity": "high",
  "norms": ["DSGVO Art. 6", "DSGVO Art. 44", "TTDSG § 25"],
  "conditions": [
    { "fact": "tracker.google_analytics.detected", "operator": "equals", "value": true },
    { "fact": "consent.banner.detected", "operator": "equals", "value": false }
  ]
}
```

Vorteile:
- Regeln versionieren und auditieren
- Neue Gesetze ergänzen ohne Code-Deploy
- White-Label-Policies pro Tenant
- AI-Act später erweitern ohne if-else-Kaskade

→ Eigentlicher Unternehmenswert (defensible asset).

### 3. Audit-Pipeline als Queue-System

Nie synchron auditieren. Pattern:

```
POST /api/audits
  → queue.add()
  → return auditId
```

Worker:
```
audit-worker
  → crawl
  → detect trackers
  → detect forms
  → detect AI widgets
  → run rule engine
  → store findings
  → generate score
  → persist evidence
```

Vorteile:
- Skalierung
- Retry-fähig
- Parallelität
- Timeout-Handling
- Anti-Crash

### 4. Findings normalisieren

Nicht Freitext, sondern strukturiert:

```typescript
type Finding = {
  id: string
  ruleId: string
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string
  affectedUrl: string
  norms: string[]
  evidenceIds: string[]
  remediation: { summary: string; steps: string[] }
}
```

Ermöglicht später: Fix-Vorschläge, Auto-Remediation, PDFs, Benchmarks, Trends, Compliance-Scores.

### 5. AI-Act sauber modellieren

Nicht nur `risk_class`-Spalte. Vielmehr:

```sql
ai_use_cases
  - purpose                     TEXT
  - model_type                  TEXT
  - foundation_model            TEXT
  - human_oversight             BOOLEAN
  - biometric_usage             BOOLEAN
  - automated_decision_making   BOOLEAN
  - training_data_origin        TEXT
  - transparency_measures       JSONB
  - prohibited_patterns         JSONB
```

Ermöglicht: automatische Pflichtenlisten, Gap-Analysen, AI-Act-PDFs, Onboarding, Governance-Dashboard.

### 6. Document Engine als Block-System

Nicht Template-basiert (`{{company_name}}`):

```sql
document_blocks
  - legal_basis_block
  - subprocessors_block
  - ai_usage_block
  - retention_block
  ...
```

Eine Datenschutzerklärung = Komposition von Blocks.

Vorteile: Branchen-Profile, Mehrsprachigkeit, dynamische AI-Abschnitte, automatische Updates, Versionierung.

## Ideale API-Struktur

### Public

```
POST   /api/public/audits
GET    /api/public/audits/:id
```

### Authenticated

```
GET    /api/systems
POST   /api/systems

POST   /api/audits
GET    /api/audits/:id

POST   /api/documents/generate
GET    /api/documents/:id

POST   /api/ai/use-cases
POST   /api/ai/classify

GET    /api/compliance/dashboard
```

### Internal Worker

```
POST   /internal/crawl
POST   /internal/rules/evaluate
POST   /internal/pdf/render
```

## MVP-Reihenfolge

Nicht alles gleichzeitig. Phasen:

### Phase 1 — Wow-Effekt (Leadgen + Demos)
- Audit, Findings, Score, PDF

### Phase 2 — Monetarisierung
- DSE/AVV-Generator, Tenant-Dashboard, gespeicherte Audits

### Phase 3 — Enterprise
- AI-Act-Suite, Multi-Tenant, White-Label, Reseller, Hosted-Websites, Chatbot

## Continuous-Compliance-Vision

Der größte Marktwert liegt nicht in „Generatoren", sondern in
**Continuous Compliance Infrastructure**:

> „Wir überwachen eure Website kontinuierlich auf DSGVO- und AI-Act-Risiken."

Dann:
- Recurring Revenue
- Alerts bei Tracker-Änderungen
- Auto-Re-Audits
- Managed Hosting
- AI Governance

Das ist ein eigenes Marktsegment, nicht „yet another DSGVO-Tool".

## Repository-Struktur (Ziel, ADR 0002)

```
realsyncdynamicsai/
├── apps/
│   ├── web/                # Next.js
│   ├── api/                # Fastify
│   ├── worker/             # Playwright + Queue
│   └── docs-renderer/      # PDF/HTML Block-Renderer
├── packages/
│   ├── database/           # Prisma + Postgres
│   ├── shared/             # Types, Schemas, Utils
│   ├── compliance-rules/   # JSON Rule Engine
│   ├── audit-engine/       # Crawler + Detectors + Evidence
│   └── ui/                 # Shared Components
└── infrastructure/
    ├── docker/
    ├── coolify/
    └── nginx/
```

## Multi-Tenant-Pflicht

Jede DB-Tabelle: `tenant_id UUID NOT NULL`. Nie ohne. Sonst geht später alles kaputt.

RBAC-Rollen: `OWNER`, `ADRMIN`, `DSB`, `EDITOR`, `VIEWER`, `AGENCY`.

## Defensible Assets

Der Wert liegt nicht in CRUD oder React-Komponenten. Sondern in:

1. **Rule Engine** — versioniertes Compliance-Wissen
2. **Detection Layer** — Tracker/AI/Consent-Erkennung
3. **Compliance Knowledge Graph** — Verbindungen zwischen Normen, Rules, Use-Cases
4. **Evidence-System** — auditierbare Beweis-Trails
5. **Tenant Infrastructure** — saubere Mandanten-Trennung

Das sind die Bestandteile, die schwer zu kopieren sind und den Pricing-Power darstellen.

## Drei Produkte gleichzeitig

| Produkt | Wert |
|---|---|
| Audit Engine | Leadgen |
| Compliance OS | SaaS |
| AI Governance Layer | Zukunfts-Markt |

Nicht alles in CRUD-Komponenten verlieren. Energie auf die defensiblen Assets fokussieren.

---

*Diese Architektur ist die Ziel-Zustand. Aktuelle Implementierung ist v1
(Supabase + GH-Pages + Vite-React) per ADR 0001. Migration zu vollständiger
Architektur erfolgt bei Erfüllung der Trigger in ADR 0001.*
