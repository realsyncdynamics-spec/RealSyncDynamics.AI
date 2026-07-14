# RealSyncDynamics.AI

EU-souveräne Compliance-Infrastruktur für Unternehmen und Agenturen.

Automatisiertes DSGVO- und EU-AI-Act-Audit, kontinuierliches Monitoring,
Evidence-Vault mit Hash-Chain — Multi-Tenant, opt-in EU-lokale
AI-Inferenz, transparentes Billing.

**Live:** https://realsyncdynamicsai.de · **Backend:** Supabase
(EU-Region) · **AI-Stack:** Anthropic / Google / OpenAI für Cloud-Pfad,
[Ollama](https://ollama.com) (gemma3:4b) für EU-lokal-Pfad.

---

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
[ebljyceifhnlzhjfyxup.supabase.co]
   ├── Auth (Magic Link)
   ├── Postgres (RLS für Multi-Tenant)
   ├── Edge Functions:
   │     ai-invoke ······ AI-Tool-Pipeline mit Residency-Routing
   │     workflow-trigger / workflow-callback ····· n8n-Bridge
   │     stripe-checkout / stripe-webhook / stripe-meter-sync
   │     gdpr-export / gdpr-delete ····· Art. 15 + 17
   │     kodee-onboard / kodee-diagnose / kodee-advise
   │     tenant-invite / usage-increment
   │     ai-invoke
   └── Storage (audit-evidence + tax-evidence-exports)
   │
   ▼ residency=cloud
[Anthropic / Google / OpenAI]

   ▼ residency=eu_local
[Kodee-VPS Hostinger DE]   Traefik-Stack
   ├── ollama.realsyncdynamicsai.de    Ollama gemma3:4b (BasicAuth)
   ├── chat.realsyncdynamicsai.de      Open WebUI (Login)
   └── n8n.realsyncdynamicsai.de       n8n (eigene Auth)
```

Alle Tabellen RLS-geschützt. Service-Role nur in Edge Functions.
Audit-Log (`ai_tool_runs`, `workflow_runs`) zeigt jeden externen Call
mit Provider, Residenz und Cost.

## Lokale Entwicklung

**Voraussetzungen:** Node 20+, Supabase-Projekt + Anon-Key.

```bash
git clone https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI.git
cd RealSyncDynamics.AI
npm install

cat > .env.local <<EOF
VITE_SUPABASE_URL=https://ebljyceifhnlzhjfyxup.supabase.co
VITE_SUPABASE_ANON_KEY=<aus Supabase Dashboard>
EOF

npm run dev    # http://localhost:3000
```

## E2E / Visual Functional Tests

Die öffentliche Website wird durch Playwright E2E-Tests auf optische und funktionelle Korrektheit validiert.

**Baseline erzeugen** (einmalig oder nach intentionalen visuellen Änderungen):

```bash
npx playwright test --update-snapshots
```

**Regulärer Testlauf:**

```bash
npm run test:e2e
```

**Report anzeigen:**

```bash
npm run test:e2e:report
```

Der Test validiert:
- Routing aller öffentlichen Seiten (`/`, `/audit`, `/ai-act`, etc.)
- Sichtbare Inhalte und Navigation
- Call-to-Actions (CTAs)
- Audit- und AI-Act-Einsteige
- HealthTech-, SaaS-, Public-Sector-Seiten
- Checkout-Starter-Seite (kein ungewolltes Zahlungsformular)
- Mobile Darstellung (kein horizontaler Overflow)
- Bild-Alt-Attribute (WCAG-Konformität)
- Keine sichtbaren JavaScript-Fehler in der UI

Siehe auch: [`docs/QA_VISUAL_FUNCTIONAL_TESTRUN.md`](docs/QA_VISUAL_FUNCTIONAL_TESTRUN.md) für aktuelle Test-Resultate.

## Deploy

- **Frontend:** statische Vite-Build via GitHub Actions auf Hostinger-VPS,
  hinter Traefik. Siehe `deploy/README.md`.
- **Edge Functions:** via Supabase MCP / `supabase functions deploy`.
  Siehe `supabase/functions/*/`.
- **Migrations:** `supabase/migrations/` — automatisch via
  `supabase db push` oder per Dashboard-SQL-Editor.
- **EU-lokal-Stack:** `deploy/ollama-traefik/` — Ollama + n8n + Open
  WebUI hinter Host-Traefik. Siehe `deploy/ollama-traefik/README.md`
  und `deploy/ollama-traefik/N8N-SETUP.md`.

## Plans

Single Source of Truth: [`src/config/pricing.ts`](src/config/pricing.ts).
Live unter `/pricing`. Aktuelle Tiers: Free Audit · Starter (79 €) ·
Growth (249 €) · Agency (699 €) · Enterprise (ab 1.500 €). Details +
Feature-Listen pro Tier siehe [`ROADMAP.md`](ROADMAP.md).

Plans werden in Stripe verwaltet, gemappt via `public.products`.

## Lizenz

Proprietär — © 2026 RealSync Dynamics. Alle Rechte vorbehalten.

## Kontakt

- Sales: [sales@realsyncdynamicsai.de](mailto:sales@realsyncdynamicsai.de)
- Privacy: [privacy@realsyncdynamicsai.de](mailto:privacy@realsyncdynamicsai.de)
