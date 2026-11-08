# Edge-Function-Inventar

> **Automatisch erzeugt** von `scripts/generate-edge-function-inventory.mjs` — nicht von Hand editieren.
> Neu erzeugen: `node scripts/generate-edge-function-inventory.mjs`. Grundlage: PLAN_100 #15/#16.
>
> Grundwahrheit „in Produktion": `src/config/production-edge-functions.ts` (Messung 2026-10-30T11:46Z, vom Drift-Guard gehuetet).
> Erreichbarkeit: Referenz-Scan ueber `src/`, `supabase/config.toml`, `supabase/migrations/` und Function-zu-Function-Calls.

## Statusuebersicht

| Status | Anzahl | Bedeutung |
|---|---:|---|
| AKTIV | 153 | Deployt **und** mit mindestens einem Caller/Trigger im Repo (invoke/fetch/cron/function-call/public) |
| DEPLOYT-OHNE-CALLER | 47 | Deployt, aber kein Code-Caller im Repo gefunden → Pruef-Kandidat fuer #16 (nicht automatisch „tot") |
| REPO-ONLY (nicht deployt) | 0 | Verzeichnis im Repo, aber nicht in der Prod-Liste |
| DRIFT: deployt ohne Quelle | 0 | In Prod-Liste, aber kein Verzeichnis (sollte 0 sein — sonst Drift-Guard) |
| **Summe** | **200** | Vereinigung aus Prod-Liste (200) und Verzeichnissen (200) |

### Einordnung

- **Repo und Produktion sind deckungsgleich** (200 Verzeichnisse = 200 deployte Slugs). Es gibt derzeit **keine** „tot per Deployment"-Function: kein Verzeichnis ohne Deploy, kein Deploy ohne Quelle. Der Drift-Guard (`npm run check:edge-functions`) haelt das auf null.
- **Grenze der Repo-Sicht:** Cron-Jobs, die nur in der Produktions-DB angelegt wurden (nicht in `supabase/migrations/`), externe Webhook-Ziele und manuelle Aufrufe sind hier unsichtbar. Vor #16 deshalb `cron.job`, die Aufruf-Logs und die Webhook-Konfiguration der Anbieter gegenpruefen.
- Das einzige verbleibende „tot?"-Signal ist **DEPLOYT-OHNE-CALLER** (47): deployt, aber im Repo ruft nichts sie auf. Das ist die Arbeitsliste fuer #16 — **nicht** eine Loeschfreigabe. Vor jeder Deprecation gilt weiterhin: fetch- *und* invoke-bewusst gegenpruefen, Out-of-band-/Admin-Nutzung ausschliessen.
- Alle oeffentlichen Functions (`verify_jwt=false`, z. B. Webhooks von Stripe/Shopify/Telegram) tragen den Trigger `public/webhook` und zaehlen damit als AKTIV, auch ohne internen Caller.

## #16 Pruef-Kandidaten — deployt, aber kein interner Caller (47)

> **Kein Loeschbefund.** „Kein Caller" heisst: im Repo (`src/`, `config.toml`, Migrationen, Function-zu-Function) ruft nichts diese Function auf. Extern erreichbare APIs (z. B. `api-audit`, OAuth-Endpunkte) und Out-of-band-/Admin-Tools (z. B. `mfa-admin-reset`) sind legitim ohne internen Caller. Pro Function verifizieren, bevor an Deprecation (#16) gedacht wird.

**Aufschluesselung nach Spur:** kein interner Caller/Trigger: 43 · nur Tests/e2e: 2 · in config.toml deklariert: 2

| Function | Cluster | Einzige Spur |
|---|---|---|
| `agent-questions` | Agent/Runtime | kein interner Caller/Trigger |
| `agent-scheduler` | Agent/Runtime | kein interner Caller/Trigger |
| `ai-act-auto-classify` | AI-Act | nur Tests/e2e |
| `mfa-admin-reset` | Auth/MFA/Tenant | kein interner Caller/Trigger |
| `provision-tenant` | Auth/MFA/Tenant | kein interner Caller/Trigger |
| `tenant-branding-get` | Auth/MFA/Tenant | kein interner Caller/Trigger |
| `checkout-siteos-project` | Billing/Stripe | kein interner Caller/Trigger |
| `stripe-oauth-callback` | Billing/Stripe | kein interner Caller/Trigger |
| `stripe-token-meter-sync` | Billing/Stripe | kein interner Caller/Trigger |
| `compliance-alert-trigger` | Compliance/NIS2 | kein interner Caller/Trigger |
| `compliance-remediation-execute` | Compliance/NIS2 | kein interner Caller/Trigger |
| `nis2-deadline-calculator` | Compliance/NIS2 | kein interner Caller/Trigger |
| `evidence-r2` | Evidence | kein interner Caller/Trigger |
| `governance-agents-list` | Governance-OS | in config.toml deklariert |
| `governance-audit-report-gen` | Governance-OS | kein interner Caller/Trigger |
| `governance-deadline-monitor` | Governance-OS | kein interner Caller/Trigger |
| `governance-evidence-handler` | Governance-OS | kein interner Caller/Trigger |
| `governance-gap-analyzer` | Governance-OS | kein interner Caller/Trigger |
| `governance-risk-escalate` | Governance-OS | in config.toml deklariert |
| `governance-score-calculator` | Governance-OS | kein interner Caller/Trigger |
| `governance-workflow-intake` | Governance-OS | kein interner Caller/Trigger |
| `api-gateway` | Health/Ops | kein interner Caller/Trigger |
| `mcp-api-key-manager` | Integrationen | kein interner Caller/Trigger |
| `oauth2-apps` | Integrationen | kein interner Caller/Trigger |
| `oauth2-token` | Integrationen | kein interner Caller/Trigger |
| `seed-integrations` | Integrationen | kein interner Caller/Trigger |
| `c2pa-manifest-generate` | Legal/RAG/Provenance | kein interner Caller/Trigger |
| `email-delivery-webhook` | Notify/Webhook | kein interner Caller/Trigger |
| `pitch-deck-pdf` | Report/PDF/Doc | kein interner Caller/Trigger |
| `api-audit` | Scanner/Audit | nur Tests/e2e |
| `audit-claim` | Scanner/Audit | kein interner Caller/Trigger |
| `audit-determinism-verify` | Scanner/Audit | kein interner Caller/Trigger |
| `schedule-data-syncs` | Scheduler/Jobs | kein interner Caller/Trigger |
| `social-publisher-worker` | Social | kein interner Caller/Trigger |
| `email-notify-send` | Sonstige | kein interner Caller/Trigger |
| `notify-terminal-event` | Sonstige | kein interner Caller/Trigger |
| `onboarding-orchestrator` | Sonstige | kein interner Caller/Trigger |
| `partner-provision-tenant` | Sonstige | kein interner Caller/Trigger |
| `plans` | Sonstige | kein interner Caller/Trigger |
| `report-generator` | Sonstige | kein interner Caller/Trigger |
| `skills` | Sonstige | kein interner Caller/Trigger |
| `api-webhook-deliver` | Webhook-Zustellung | kein interner Caller/Trigger |
| `webhook-deliver` | Webhook-Zustellung | kein interner Caller/Trigger |
| `webhook-dispatcher` | Webhook-Zustellung | kein interner Caller/Trigger |
| `webhook-retry-cron` | Webhook-Zustellung | kein interner Caller/Trigger |
| `cloudflare-deployer` | Website/Betrieb | kein interner Caller/Trigger |
| `hostinger-agent-brief` | Website/Betrieb | kein interner Caller/Trigger |

## Vollinventar nach Cluster

> Spalte **Cluster** ist eine aus dem Slug abgeleitete Domaenen-Zuordnung, **kein** Personen-Owner — den fuehrt das Repo derzeit nicht (Folgeaufgabe: CODEOWNERS fuer `supabase/functions/`).

### Agent/Runtime (19)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `agent-change-evidence-webhook` | AKTIV | public/webhook |
| `agent-os-runner` | AKTIV | cron, public/webhook |
| `agent-questions` | DEPLOYT-OHNE-CALLER | — |
| `agent-scheduler` | DEPLOYT-OHNE-CALLER | — |
| `enterprise-ai-os-agent-runs-list` | AKTIV | frontend-fetch, public/webhook |
| `enterprise-ai-os-agents-list` | AKTIV | public/webhook |
| `enterprise-ai-os-agents-run` | AKTIV | frontend-invoke, frontend-fetch |
| `enterprise-ai-os-discovery-intake` | AKTIV | frontend-invoke, public/webhook |
| `enterprise-ai-os-discovery-pending` | AKTIV | frontend-invoke |
| `enterprise-ai-os-evaluate` | AKTIV | public/webhook |
| `enterprise-ai-os-feedback` | AKTIV | frontend-fetch, public/webhook |
| `enterprise-ai-os-founding-access` | AKTIV | public/webhook |
| `governance-agent` | AKTIV | frontend-invoke |
| `kodee` | AKTIV | frontend-invoke |
| `kodee-advise` | AKTIV | frontend-invoke |
| `kodee-diagnose` | AKTIV | frontend-invoke |
| `kodee-onboard` | AKTIV | frontend-invoke |
| `remediation-agent` | AKTIV | frontend-invoke |
| `remediation-workflow` | AKTIV | frontend-fetch |

### AI-Act (3)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `ai-act-auto-classify` | DEPLOYT-OHNE-CALLER | — |
| `ai-act-classify` | AKTIV | frontend-fetch, public/webhook |
| `ai-act-risk-inventory` | AKTIV | frontend-invoke |

### AI-Gateway/Invoke (5)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `ai-gateway` | AKTIV | frontend-fetch, frontend-wrapper, function-call |
| `ai-invoke` | AKTIV | frontend-invoke, frontend-fetch |
| `ai-os-control` | AKTIV | frontend-invoke |
| `classify-document` | AKTIV | frontend-invoke |
| `local-ai-runtime` | AKTIV | frontend-wrapper |

### Auth/MFA/Tenant (10)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `add-auditor` | AKTIV | frontend-fetch |
| `integration-credentials` | AKTIV | frontend-invoke |
| `mfa-admin-reset` | DEPLOYT-OHNE-CALLER | — |
| `mfa-recovery-redeem` | AKTIV | frontend-invoke |
| `provision-tenant` | DEPLOYT-OHNE-CALLER | — |
| `provision-voice-agent` | AKTIV | cron, function-call, public/webhook |
| `tenant-branding-get` | DEPLOYT-OHNE-CALLER | — |
| `tenant-branding-update` | AKTIV | frontend-invoke |
| `tenant-invite` | AKTIV | frontend-invoke |
| `tenant-members` | AKTIV | frontend-invoke |

### Billing/Stripe (11)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `checkout-siteos-project` | DEPLOYT-OHNE-CALLER | — |
| `checkout-website-rebuild` | AKTIV | frontend-invoke, public/webhook |
| `stripe-checkout` | AKTIV | frontend-invoke |
| `stripe-checkout-verify` | AKTIV | frontend-fetch |
| `stripe-meter-sync` | AKTIV | cron, public/webhook |
| `stripe-oauth-callback` | DEPLOYT-OHNE-CALLER | — |
| `stripe-portal` | AKTIV | frontend-invoke, frontend-fetch |
| `stripe-token-meter-sync` | DEPLOYT-OHNE-CALLER | — |
| `stripe-webhook` | AKTIV | public/webhook |
| `subscription-addons` | AKTIV | frontend-invoke |
| `usage-increment` | AKTIV | frontend-invoke |

### Bot/Voice (2)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `bot-chat` | AKTIV | public/webhook |
| `bot-voice-enforcer` | AKTIV | cron, public/webhook |

### Compliance/NIS2 (4)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `compliance-alert-trigger` | DEPLOYT-OHNE-CALLER | — |
| `compliance-remediation-execute` | DEPLOYT-OHNE-CALLER | — |
| `nis2-deadline-calculator` | DEPLOYT-OHNE-CALLER | — |
| `security-signal-ingest` | AKTIV | frontend-fetch, public/webhook |

### Evidence (5)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `evidence-anchor` | AKTIV | frontend-invoke |
| `evidence-export` | AKTIV | frontend-invoke |
| `evidence-r2` | DEPLOYT-OHNE-CALLER | — |
| `evidence-vault` | AKTIV | frontend-invoke |
| `evidence-vault-export` | AKTIV | frontend-invoke, frontend-fetch |

### GDPR/DSR (3)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `gdpr-audit` | AKTIV | frontend-invoke, frontend-fetch, frontend-wrapper, function-call, public/webhook |
| `gdpr-delete` | AKTIV | frontend-fetch |
| `gdpr-export` | AKTIV | frontend-fetch |

### Governance-OS (28)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `governance-access` | AKTIV | frontend-invoke |
| `governance-agents-list` | DEPLOYT-OHNE-CALLER | — |
| `governance-analytics-aggregator` | AKTIV | public/webhook |
| `governance-analytics-export` | AKTIV | frontend-invoke |
| `governance-approvals` | AKTIV | frontend-invoke, public/webhook |
| `governance-audit-report-gen` | DEPLOYT-OHNE-CALLER | — |
| `governance-connectors` | AKTIV | frontend-invoke, public/webhook |
| `governance-deadline-monitor` | DEPLOYT-OHNE-CALLER | — |
| `governance-decide` | AKTIV | public/webhook |
| `governance-dpias` | AKTIV | frontend-invoke, public/webhook |
| `governance-dsr` | AKTIV | frontend-invoke, public/webhook |
| `governance-erasure-sweeper` | AKTIV | cron, public/webhook |
| `governance-evidence-handler` | DEPLOYT-OHNE-CALLER | — |
| `governance-gap-analyzer` | DEPLOYT-OHNE-CALLER | — |
| `governance-incidents` | AKTIV | frontend-invoke, public/webhook |
| `governance-ingest` | AKTIV | frontend-fetch, cron, function-call, public/webhook |
| `governance-keys` | AKTIV | frontend-invoke, frontend-fetch, public/webhook |
| `governance-memory` | AKTIV | frontend-fetch |
| `governance-monitoring-scheduler` | AKTIV | frontend-fetch, cron, public/webhook |
| `governance-remediate` | AKTIV | frontend-invoke |
| `governance-resources` | AKTIV | frontend-invoke, frontend-fetch, public/webhook |
| `governance-risk-escalate` | DEPLOYT-OHNE-CALLER | — |
| `governance-risk-score` | AKTIV | frontend-invoke, function-call |
| `governance-router` | AKTIV | frontend-fetch, public/webhook |
| `governance-score-calculator` | DEPLOYT-OHNE-CALLER | — |
| `governance-vendors` | AKTIV | frontend-invoke, public/webhook |
| `governance-webhooks` | AKTIV | frontend-invoke, frontend-fetch, public/webhook |
| `governance-workflow-intake` | DEPLOYT-OHNE-CALLER | — |

### Health/Ops (4)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `api-gateway` | DEPLOYT-OHNE-CALLER | — |
| `business-metrics-cron` | AKTIV | cron, public/webhook |
| `health` | AKTIV | frontend-fetch, cron, public/webhook |
| `market-scanner` | AKTIV | cron, public/webhook |

### Integrationen (6)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `mcp-api-key-manager` | DEPLOYT-OHNE-CALLER | — |
| `microsoft365-audit-sync` | AKTIV | public/webhook |
| `microsoft365-connect` | AKTIV | frontend-invoke |
| `oauth2-apps` | DEPLOYT-OHNE-CALLER | — |
| `oauth2-token` | DEPLOYT-OHNE-CALLER | — |
| `seed-integrations` | DEPLOYT-OHNE-CALLER | — |

### ISO 42001/Zertifizierung (6)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `certification-readiness` | AKTIV | frontend-fetch |
| `iso42001-control-detail` | AKTIV | frontend-fetch |
| `iso42001-controls-library` | AKTIV | frontend-fetch |
| `iso42001-evidence-vault` | AKTIV | frontend-fetch |
| `iso42001-gap-analysis` | AKTIV | frontend-fetch |
| `policy-packs` | AKTIV | frontend-invoke |

### Legal/RAG/Provenance (4)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `c2pa-manifest-generate` | DEPLOYT-OHNE-CALLER | — |
| `legal-embed` | AKTIV | public/webhook |
| `legal-retrieve` | AKTIV | frontend-fetch |
| `provenance` | AKTIV | frontend-invoke |

### Marketing/Lead/Mail (9)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `daily-digest` | AKTIV | cron, public/webhook |
| `invoice-email` | AKTIV | function-call |
| `marketing-event` | AKTIV | frontend-fetch, public/webhook |
| `newsletter-confirm` | AKTIV | frontend-fetch, public/webhook |
| `newsletter-subscribe` | AKTIV | frontend-fetch, public/webhook |
| `sales-lead` | AKTIV | frontend-fetch, frontend-wrapper, public/webhook |
| `telemetry-ai-event` | AKTIV | public/webhook |
| `track-pageview` | AKTIV | frontend-fetch, public/webhook |
| `welcome-email` | AKTIV | public/webhook |

### Memory (2)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `memory-confidence-trigger` | AKTIV | function-call |
| `memory-decay-worker` | AKTIV | cron, public/webhook |

### Notify/Webhook (10)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `automation-callback` | AKTIV | function-call, public/webhook |
| `automation-trigger` | AKTIV | frontend-fetch |
| `automation-trigger-trial-webhook` | AKTIV | cron |
| `bot-voice-webhook` | AKTIV | public/webhook |
| `email-delivery-webhook` | DEPLOYT-OHNE-CALLER | — |
| `telegram-channels` | AKTIV | frontend-fetch |
| `telegram-webhook` | AKTIV | public/webhook |
| `whatsapp-webhook` | AKTIV | frontend-fetch, public/webhook |
| `workflow-callback` | AKTIV | function-call, public/webhook |
| `workflow-trigger` | AKTIV | frontend-invoke, frontend-fetch |

### Report/PDF/Doc (5)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `ceo-brief-pdf` | AKTIV | frontend-fetch |
| `generate-certification-report` | AKTIV | frontend-fetch |
| `generate-compliance-report` | AKTIV | frontend-invoke, frontend-fetch |
| `generate-document` | AKTIV | frontend-invoke, frontend-fetch, function-call |
| `pitch-deck-pdf` | DEPLOYT-OHNE-CALLER | — |

### Scanner/Audit (15)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `api-audit` | DEPLOYT-OHNE-CALLER | — |
| `audit-claim` | DEPLOYT-OHNE-CALLER | — |
| `audit-determinism-verify` | DEPLOYT-OHNE-CALLER | — |
| `audit-drip-cron` | AKTIV | cron, public/webhook |
| `audit-monitor-cron` | AKTIV | cron, public/webhook |
| `audit-recheck-weekly` | AKTIV | cron, public/webhook |
| `audit-report-email` | AKTIV | frontend-fetch, public/webhook |
| `audit-report-pdf` | AKTIV | public/webhook |
| `bulk-scan` | AKTIV | frontend-invoke |
| `cookie-scan` | AKTIV | frontend-invoke, frontend-fetch, frontend-wrapper, function-call, public/webhook |
| `cookie-scan-deep` | AKTIV | frontend-fetch, public/webhook |
| `email-auth-rescan` | AKTIV | cron, public/webhook |
| `export-audit` | AKTIV | frontend-invoke |
| `shopify-scan` | AKTIV | frontend-fetch |
| `tenant-audit` | AKTIV | frontend-fetch |

### Scheduler/Jobs (3)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `schedule-data-syncs` | DEPLOYT-OHNE-CALLER | — |
| `scheduler` | AKTIV | frontend-invoke |
| `scheduler-dispatch` | AKTIV | cron, public/webhook |

### SEO/Analytics (8)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `calculate-seo-metrics` | AKTIV | frontend-fetch |
| `dashboard-digest-generate` | AKTIV | frontend-wrapper |
| `dashboard-intelligence` | AKTIV | frontend-wrapper |
| `seo-dashboard-data` | AKTIV | frontend-fetch |
| `share-dashboard` | AKTIV | frontend-fetch |
| `sync-ga-metrics` | AKTIV | frontend-wrapper |
| `sync-stripe-metrics` | AKTIV | frontend-wrapper, function-call |
| `train-forecast-models` | AKTIV | frontend-fetch |

### Shopify (3)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `shopify-callback` | AKTIV | function-call, public/webhook |
| `shopify-install` | AKTIV | frontend-fetch, function-call, public/webhook |
| `shopify-webhooks` | AKTIV | function-call, public/webhook |

### Social (2)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `social-orchestrator-persistence` | AKTIV | frontend-invoke |
| `social-publisher-worker` | DEPLOYT-OHNE-CALLER | — |

### Sonstige (21)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `appointment-book` | AKTIV | public/webhook |
| `auditor-engagement` | AKTIV | frontend-fetch |
| `beta-enroll` | AKTIV | frontend-wrapper |
| `browser-action-log` | AKTIV | public/webhook |
| `browser-execute` | AKTIV | frontend-fetch, public/webhook |
| `create-trial-subscription` | AKTIV | frontend-wrapper |
| `email-notify-send` | DEPLOYT-OHNE-CALLER | — |
| `log-tool-run` | AKTIV | frontend-fetch |
| `notify-terminal-event` | DEPLOYT-OHNE-CALLER | — |
| `onboarding-orchestrator` | DEPLOYT-OHNE-CALLER | — |
| `optimize-analyze` | AKTIV | frontend-invoke |
| `optimize-execute` | AKTIV | frontend-invoke |
| `order-intake` | AKTIV | public/webhook |
| `partner-provision-tenant` | DEPLOYT-OHNE-CALLER | — |
| `plans` | DEPLOYT-OHNE-CALLER | — |
| `report-generator` | DEPLOYT-OHNE-CALLER | — |
| `save-company-profile` | AKTIV | frontend-wrapper |
| `siteos` | AKTIV | frontend-invoke, frontend-wrapper |
| `skills` | DEPLOYT-OHNE-CALLER | — |
| `sub-processor-notify` | AKTIV | cron, public/webhook |
| `update-member-role` | AKTIV | frontend-invoke |

### Webhook-Zustellung (4)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `api-webhook-deliver` | DEPLOYT-OHNE-CALLER | — |
| `webhook-deliver` | DEPLOYT-OHNE-CALLER | — |
| `webhook-dispatcher` | DEPLOYT-OHNE-CALLER | — |
| `webhook-retry-cron` | DEPLOYT-OHNE-CALLER | — |

### Website/Betrieb (8)

| Function | Status | Erreichbarkeit |
|---|---|---|
| `cloudflare-deployer` | DEPLOYT-OHNE-CALLER | — |
| `hostinger-agent-brief` | DEPLOYT-OHNE-CALLER | — |
| `maintenance-schedule` | AKTIV | frontend-fetch |
| `rebuild-website` | AKTIV | frontend-fetch, function-call, public/webhook |
| `website-domain-manager` | AKTIV | frontend-fetch |
| `website-maintenance-agent` | AKTIV | frontend-fetch, function-call |
| `website-maintenance-daily-cron` | AKTIV | public/webhook |
| `website-operations-agent` | AKTIV | frontend-invoke |

---

_Erzeugt am 2026-11-08 · 200 Functions · 153 AKTIV · 47 ohne Caller._
