# RealSyncDynamics.AI

EU-souveräne Compliance-Infrastruktur für Unternehmen und Agenturen.

Automatisiertes DSGVO- und EU-AI-Act-Audit, kontinuierliches Monitoring,
Evidence-Vault mit Hash-Chain — Multi-Tenant, opt-in EU-lokale
AI-Inferenz, transparentes Billing.

**Live:** https://realsyncdynamicsai.de · **Backend:** Supabase
(EU-Region) · **AI-Stack:** Anthropic / Google / OpenAI für Cloud-Pfad,
Ollama (gemma3:4b) für EU-lokal-Pfad.

**Monorepo?** → Siehe [`MONOREPO.md`](MONOREPO.md) für vollständige Navigation durch alle Services & Workspaces.

## Governance AI + Website Transformation

Governance AI ist der zentrale KI-Arbeitsplatz für SEO, Website-Optimierung,
DSGVO und EU AI Act. Der Website-Builder folgt dem Kundenweg:

**URL → Scan → Ergebnis → neue Website → Preview → DSGVO/SEO-Entscheidung → Pricing → Stripe → Dashboard.**

Der Claude Code Optimizer ist als ausführbare Capability in diesen Workflow
integriert und übernimmt Repository-Prüfung, Risiko-Klassifizierung,
Fix-Code-Vorschläge und auditierbare Evidenz.

## Was steckt drin

| Säule | Pfad | Status |
|---|---|---|
| **AI-Tools** mit Per-Plan-Quotas, Audit-Log, Cost-Tracking, opt-in EU-lokal-Routing | `ai-invoke` Edge Function | live |
| **Kodee · VPS-Sidekick** Conversational Assistant für SSH-Diagnose, Service-Restart, etc. | `/kodee` | implementiert |
| **n8n Workflow-Engine** Per-Tenant-Workflows mit Audit-Log + Cost-Tracking | `/workflows` | implementiert |
| **Multi-Tenant-Workspaces** mit Owner/Admin/Editor/Viewer-Rollen + Invites | `/tenant/invites` | implementiert |
| **Stripe-Billing** Free / Starter / Growth / Agency / Enterprise · metered usage + entitlements | `/pricing` · `/billing/usage` | implementiert |
| **DSGVO-Rechte** Datenexport (Art. 15) + Löschung (Art. 17) | `/settings/account` | implementiert |
| **Datenresidenz-Wahl** Per-User-Toggle und Per-Tenant-Policy für `cloud` vs `eu_local` | `/settings/ai-residency` | implementiert |

## Architektur

```
[Browser]
   │
   ▼
[realsyncdynamicsai.de]  Vite/React-SPA, hinter Traefik (TLS, LE-Cert)
   │
   ▼
[Supabase EU]
   ├── Auth / Postgres / Storage
   ├── AI Gateway + Governance Runtime
   ├── Stripe checkout / webhook / metering
   └── GDPR + audit evidence
```

Alle Tabellen RLS-geschützt. Service-Role nur in Edge Functions.
Audit-Log (`ai_tool_runs`, `workflow_runs`) zeigt jeden externen Call
mit Provider, Residenz und Cost.

## Repository-Struktur

```
RealSyncDynamics.AI/
├── src/                          # Hauptfrontend (Vite/React SPA)
├── supabase/                     # Edge Functions + Migrations
├── apps/                         # Node/TS-Services
│   └── agent-runtime/            # Agent Runtime (Docker)
├── services/                     # Spezialisierte Services (Docker)
├── packages/                     # Shared Packages / SDK
├── platform/                     # Website Builder + Governance
└── docs/                         # Dokumentation + Runbooks
```

### Platform-Monorepo (`platform/`)

Eine in sich geschlossene Microservice-Suite für Website-Automation mit Compliance-Gating:

- **builder_orchestrator** — AI-Agenten-Orchestrator für Website-Generierung
- **governance_backend** — Risk-Evaluator und CI/CD-Gate-Engine
- **nextjs_frontend** — Builder- und Governance-Cockpit

## E2E / Visual Functional Tests

Die öffentliche Website wird durch Playwright E2E-Tests auf optische und funktionelle Korrektheit validiert.

```bash
npm run test:e2e
npm run test:e2e:report
```

## Deploy

- **Frontend:** statische Vite-Build via GitHub Actions auf Cloudflare Pages / bestehender Infrastruktur.
- **Edge Functions:** via Supabase.
- **Migrations:** `supabase/migrations/`.
- **EU-lokal-Stack:** Ollama + n8n + Open WebUI hinter Traefik.

## Plans

Single Source of Truth: [`src/config/pricing.ts`](src/config/pricing.ts).
Live unter `/pricing`. Aktuelle Tiers: Free Audit · Starter (79 €) ·
Growth (249 €) · Agency (699 €) · Enterprise (ab 1.500 €).

Plans werden in Stripe verwaltet, gemappt via `public.products`.

## Lizenz

Proprietär — © 2026 RealSync Dynamics. Alle Rechte vorbehalten.
