# Implementation Status

**SSoT:** `src/product/implementation-status.ts` · **Measured:** `IMPLEMENTATION_MEASURED_AT` (`2026-11-17`).

Registry drives landing/roadmap/CI. Flip `status` → UI. No live claims for preview/coming-soon.

| Status | Meaning |
|---|---|
| `live` | Reachable |
| `preview` | Not production-complete |
| `coming-soon` | Not mounted/wired |

1. No `vollständig` / `voll funktionsfähig` / `complete runtime` on `/`.
2. Preview/coming-soon need a badge.
3. No fake KPIs; no yearly Stripe until prices exist.
4. `/` = Startseite v3 (seit 17.11.2026); H1 **Ihre Ideen. In Bewegung.**; CTA „Kostenlosen Check starten“ → `/audit?domain=…&source=landing-v3`; Produktstatus nur aus der Registry; 3D-Bühne nur lazy mit Standbild-Rückfall (three.js Earth only on `/design/landing-v4`, preview). Landing v6 (H1 **Das Governance OS für DSGVO & EU AI Act.**, CTAs `/audit` + `/contact-sales?tier=enterprise`) bleibt als Rückfall unter `/design/landing-v6`; Sphere off `/`; design `/design/*` → `/` (not roadmap); no ISO 27001/NIS2 live without registry entry.
5. `/app` → `CommandCenterDashboard`/`ComplianceStatusView` (not `AgentOsPanel`); `/login`+`/welcome`; shell wraps `AppGate`.
6. Agent OS™ preview — not on `/app/dashboard`.
7. Stripe Checkout-Anbindung vorhanden; vollständiger produktiver Kunden-E2E (Bezahlung → Webhook → Mandanten-Freischaltung) **nicht nachgewiesen**, daher im Register `preview`. Yearly weiter coming-soon; Enterprise Anfrage.
8. Beta `beta-phase`: `beta-enroll` live (WP-3, #1874, Growth bis 31.01.2027); WP-4: StartPanel + `/app/beispiel` (#1990) and in-app `BetaFeedback` (`beta_feedback` + `/admin/beta-feedback`, #1989) live, auto first-scan open → preview. Voice/Telefonie = `voice-telephony` coming-soon; `channel-bots` without phone. `enterprise-sso` = `preview`, nur auf Anfrage (E-V8; ADR 0007, 0 providers, no `signInWithSSO`/`sso-provision`/`tenant_sso_domains`).
9. `ai-act-classify` live = `/ai-act-klassifikator` + Edge `ai-act-classify`. Inventory = preview `ai-act-inventory-persist` (no plan unlocks; persist incomplete, #1743) — only classifier → `/app/risk-inventory`. `ai-system-registry` live = `/app/ai-systems` (list/create, `update_asset`, `classify_asset`). `kodee` preview = chat all plans, SSH `ai.tool.vps_status` (Agency+).

`#roadmap` ← `ROADMAP_*_ITEMS`. `npm run check:landing-claims`. Related: `scan-funnel.md`, `public-scan-funnel.md`.

## Produktionsbefunde 17.11.2026 (Read-only-Abgleich)

Die Statuswerte beschreiben hauptsächlich **Erreichbarkeit und Implementierungsstand**, keine pauschale Garantie eines funktionierenden Kunden-E2E. Nur den tatsächlichen Website-Audit-Kern stützen zusätzliche gespeicherte Produktionsereignisse.

| Bereich | Belegbarer Ist-Stand | Verbindliche Produktgrenze |
|---|---|---|
| Website-Audit `/audit` | 213 `gdpr_audits`, davon 193 erfolgreiche HTTP-Abrufe | Technische Vorprüfung, kein vollständiger DSGVO-/EU-AI-Act-Rechtscheck |
| Governance | Auth/App-Shell bereitgestellt, 11 `governance_evidence` | Evidence-Export und vollständige Mandanten-Workflows nicht E2E-freigegeben |
| SiteOS | 14 Blueprints alle `draft`; 16 abgeschlossene Scans; 30 Agent-Runs alle `awaiting_approval` | Kein Kunden-Produktions-Publish nachgewiesen |
| Voice Agent | 0 Voice-Sessions, 0 Nummern-Bindungen, 0 `tenant_voice_agents`; separate Vercel-Sandbox-App | Keine Live-Telefonie, kein Voice-Self-Service-Checkout |
| Creative Studio | Kein `creative-studio` unter den 200 produktiven Edge Functions | Nur separater Draft-PR #2271; keine öffentliche UI-Route und keine zusätzliche Function |
| Stripe | Live-Preise und Live-Webhook konfiguriert; 0 aktive Stripe-Live-Abonnements beim Abgleich | Durchgängiger bezahlter Neuabschluss nicht belegt |
| Monitoring | DB-Cron transportiert Events, `monitored_domains` 0; `audit-monitor-cron` HTTP 500 | Kein aktives kontinuierliches Kunden-Domainmonitoring |
| Agent OS | Runner erreichbar, täglicher `brief_failed` für neun Mandanten wegen fehlendem `AI_GATEWAY_INTERNAL_KEY` | Kein produktiv erfolgreicher täglicher KI-Brief |

**Deployment-Blocker:** Projekt nutzt 200 aktive Supabase Functions. Ein Deployment am 16.11.2026 scheiterte bei zusätzlichen `workspace-*`-Functions mit `HTTP 402 function.max_count` ([Workflow](https://github.com/realsyncdynamics-spec/RealSyncDynamics.AI/actions/runs/43879259588)). Neue Funktionen vorerst ausschließlich über separate Pilot-PRs, nicht in den öffentlichen Landing-PR integrieren.

**Sicherheit:** 424/424 `public`-Tabellen haben RLS aktiv; der Security Advisor meldet 17 direkt aufrufbare `anon`-SECURITY-DEFINER-RPCs und 13 Triggerfunktionen mit entsprechenden Ausführungsrechten. Nicht jeder Befund ist eine Lücke; Freigabe erfordert Funktionskörper-/Mandantenprüfung, negative Auth-/RLS-Tests und passende Privilegien.

**Freigabe-Regel:** Kein Status `live` nur aufgrund vorhandener Route, `ACTIVE` Edge Function, README-Claim, HTTP-200-Cron-Dispatch oder CI-Preview. Produktverkauf erst nach echtem, sicherem Kunden-End-to-End-Test. Bestehende Live-Statusfelder für Teiloberflächen dürfen nicht als Gesamtprodukt-GO interpretiert werden.
