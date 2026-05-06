# RealSyncDynamics.AI

EU-souveräne SaaS-Plattform für Creator und Agenturen.

Provenienz, AI-Workflows, VPS-Operations — Multi-Tenant, opt-in
EU-lokale AI-Inferenz, transparentes Billing.

**Live:** https://realsyncdynamicsai.de · **Backend:** Supabase
(EU-Region) · **AI-Stack:** Anthropic / Google / OpenAI für Cloud-Pfad,
[Ollama](https://ollama.com) (qwen3:4b) für EU-lokal-Pfad.

---

## Was steckt drin

| Säule | Pfad | Status |
|---|---|---|
| **CreatorSeal (C2PA)** Provenance + Herkunftsnachweis für digitale Assets | `/dashboard` → C2PA Assets | implementiert |
| **AI-Tools** mit Per-Plan-Quotas, Audit-Log, Cost-Tracking, opt-in EU-lokal-Routing | `ai-invoke` Edge Function | live |
| **Kodee · VPS-Sidekick** Conversational Assistant für SSH-Diagnose, Service-Restart, etc. | `/kodee` | implementiert |
| **n8n Workflow-Engine** Per-Tenant-Workflows mit Audit-Log + Cost-Tracking | `/workflows` | implementiert |
| **Multi-Tenant-Workspaces** mit Owner/Admin/Editor/Viewer-Rollen + Invites | `/tenant/invites` | implementiert |
| **Stripe-Billing** Bronze/Silver/Gold/Enterprise · metered usage + entitlements | `/pricing` · `/billing/usage` | implementiert |
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
   └── Storage (C2PA-Asset-Files)
   │
   ▼ residency=cloud
[Anthropic / Google / OpenAI]

   ▼ residency=eu_local
[Kodee-VPS Hostinger DE]   Traefik-Stack
   ├── ollama.realsyncdynamicsai.de    Ollama qwen3:4b (BasicAuth)
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

| Plan | Monatlich | AI-Calls | Workflow-Runs | Team-Seats |
|---|---|---|---|---|
| Free | 0 € | 0 | 0 | 1 |
| Bronze | 29 € | 50 | 0 | 1 |
| Silver | 99 € | 250 | 100 | 10 |
| Gold | 299 € | 2500 | 1000 | unbegrenzt |
| Enterprise | individuell | unbegrenzt | unbegrenzt | unbegrenzt |

Plans werden in Stripe verwaltet, gemappt via `public.products`.

## Lizenz

Proprietär — © 2026 RealSync Dynamics. Alle Rechte vorbehalten.

## Kontakt

- Sales: [sales@realsyncdynamicsai.de](mailto:sales@realsyncdynamicsai.de)
- Privacy: [privacy@realsyncdynamicsai.de](mailto:privacy@realsyncdynamicsai.de)
