# Capability-Matrix — Modul → Route → Backend → Entitlement → Plan

**Erhoben am**: 2026-08-23
**Methode**: Repository `main` (Stand `53c7e41`) plus Live-Messung gegen
`RealSyncDynamicsLive` (`ebljyceifhnlzhjfyxup`, eu-central-1) über die
Management-API: **177 Edge Functions deployt, Repo ⇄ Produktion in beide
Richtungen deckungsgleich** (weder eine nicht deployte Function noch eine
deployte ohne Verzeichnis). Das bestätigt die Messung vom 2026-08-22 in
`CLAUDE.md` §5.

**Verhältnis zu `reality-matrix.md`**: Die Reality Matrix (Phase 0) belegt
*ob* eine Fähigkeit existiert und wie ihre Datenbasis aussieht. Diese Datei
beantwortet die Anschlussfrage für die Dashboard-Modulansicht („Öffnen" vs.
„Aktivieren"): **über welche Route** ein Modul erreichbar ist, **welches
Backend** dahinter steht, **welcher Entitlement-Schlüssel** den Zugriff
entscheidet und **ab welchem Plan bzw. Add-on** er freigeschaltet ist.
Existenz-Belege stehen dort und werden hier nicht wiederholt.

**Preisquellen** (nur Verweise, keine Beträge duplizieren):
`shared/pricing.ts` — Plan-Leiter `PLANS` (free → starter → growth → agency →
enterprise → partner), Zusätze `ADDONS`, modularer Checkout
`BOOKABLE_MODULES` (`MODULE_PRICING_STATUS = 'provisional'`).

---

## 1. Matrix

Legende: **Plan ab** = erster Plan der Abo-Leiter mit dem Modul in
`plan.modules` · **Add-on** = `ADDONS`-Eintrag · **Bookable** =
Verkaufseinheit in `BOOKABLE_MODULES` · **Usage** = `flat_plus_usage` oder
Limit-Zählung.

### AI & Automation

| Modul | Route(n) | Backend (Function · Tabellen) | Deployt | Entitlement / Gating | Plan ab | Add-on | Bookable | Usage |
|---|---|---|---|---|---|---|---|---|
| Website Chatbot | `/chatbot/start` (CTA verlinkt auf `/app/bots`) · `/app/bots`, `/app/bots/:botId`, `/app/bots/inbox` | `bot-chat` · `bots`, `bot_conversations`, `bot_messages` | ✅ | Backend: `_shared/entitlements.ts` in `bot-chat` · Frontend: **kein Gate** | starter (`ai_bots`, `website_chat`) | `response_pack` (growth+) | `website_chat` | ja (`answersPerMonth`, `flat_plus_usage`) |
| Telefon-Agent (Voice) | `/phonebot/start` · `/app/agents/susi` | `bot-voice-webhook` · `voice_channels` | ✅ | Backend: Entitlement-Prüfung in `bot-voice-webhook` (`bots.voice`, `limit.bot_voice_minutes_monthly`) · Frontend: kein Gate | agency (`voice`) | `voice` (agency+) | `voice_bot` | ja (Minuten) |
| WhatsApp Bot | nur `/pricing/whatsapp` (Marketing) — **keine App-Route** | **keine Function, keine Tabelle** (live gemessen: kein `whatsapp`-Slug) | ❌ | — | growth (`whatsapp` in `plan.modules`) | `whatsapp` (growth+) | `whatsapp_bot` | vorgesehen (Konversationsgebühren) |
| Telegram Bot | keine eigene App-Route (Kanal in Bot-Konfig) | `telegram-webhook`, `telegram-channels` · `telegram_connections` | ✅ | über Bot-Capabilities | growth (`telegram`) | — | — | ja (Antworten) |
| Terminbuchung | keine eigene App-Route | `appointment-book` · `appointments`, `bot_appointments`, `availability_rules` | ✅ | prüft nur `capabilities.appointments` — **keine Verfügbarkeitsprüfung** (`reality-matrix.md` §2) | in keinem `plan.modules` | — | `booking` | Limit vorgesehen (`limit.booking_appointments_monthly` fehlt noch) |
| Agent Runtime | `/app/ai-systems/agents` · `/app/agents` (⚠️ Route doppelt, siehe §3.5) | `enterprise-ai-os-agents-list/-run`, `agent-os-runner`, `governance-agents-list` · `enterprise_agent_runs` · Service `apps/agent-runtime` | ✅ | Backend: Entitlement-Prüfung in `enterprise-ai-os-agents-run` | — (nicht als `ModuleId` modelliert) | — | — | `automationRunsPerMonth` |
| Automation / Workflows | `/app/agents/automation`, Workflow-Views | `automation-trigger`, `scheduler`, n8n-Webhooks · `workflow_runs` | ✅ | Backend: `scheduler` prüft Entitlements; `permissions.scheduler` ab agency | starter (`automation_engine`) / growth (`workflows`) | — | — | `automationRunsPerMonth`, `bulkJobsPerMonth` |

### Website

| Modul | Route(n) | Backend | Deployt | Entitlement / Gating | Plan ab | Add-on | Bookable | Usage |
|---|---|---|---|---|---|---|---|---|
| Landingpage Builder (SiteOS) | `/build` (BuildStudio) · `/app/siteos/builder` · `/unified-entry/transformation` · `WebsiteBuilderLanding` ist reiner Re-Export von `WebsiteTransformationFlow` (`src/pages/WebsiteBuilderLanding.tsx:1`) | `siteos` (Handler `discover`, `builder`, `runtime-scan`, `agents`) · `siteos_blueprints`, `siteos_runtime_scans`, `siteos_scores` · Checkout: `checkout-siteos-project`, `createSiteOsCheckoutSession()` | ✅ | anonymer Build erlaubt (`docs/product/siteos-anonymous-build.md`) · **kein Publish-Handler, kein Publish Gate** (`reality-matrix.md`) | — (nicht als `ModuleId` modelliert) | — | `ai_frontend` (`requiresFrontend: true`) | flat |
| Websites & Domains | `/app/websites` | `website-domain-manager`, `rebuild-website`, `checkout-website-rebuild` · `websites`, `website_domains`, `website_projects` (alle 0 Zeilen — nie produktiv gelaufen) | ✅ | `limit.domains` vorhanden; kein UI-Pfad zum Domain-Hinzufügen (`reality-matrix.md`) | free (1 Domain als Limit) | — | `additional_domain` (`per_unit`) | je Domain |

### Governance (GOVERN)

| Modul | Route(n) | Backend | Deployt | Entitlement / Gating | Plan ab | Add-on | Bookable | Usage |
|---|---|---|---|---|---|---|---|---|
| Risk | `/app/governance/ai-act-assessment`, Risk-Register-Views | `ai-act-classify`, `ai-act-risk-inventory` · `governance_risk_*`, `ai_act_risk_inventory` | ✅ | Frontend: kein Gate | growth (`risk_register`) | `compliance_pack` | `advanced_ai_governance` | — |
| Monitoring | Monitoring-/SLO-Views unter `/app/*` | Sentinel-Loop, `runtime_events` (partitioniert) | ✅ | — | starter (`monitoring`) | — | `governance_core` | — |
| Evidence | `/app/governance/evidence-vault-advanced` | `evidence-vault`, `evidence-vault-export` (mit Entitlement-Prüfung) · `evidence_snapshots` (Hash-Chain) | ✅ | Backend: `permissions.evidenceVault`/`auditExport` ab starter | starter (`evidence_vault`) | — | `governance_core` | `evidenceStorageGb` |
| Policies | Policy-Pack-Views | `policy-packs` (mit Entitlement-Prüfung) · `policy_pack_catalog/-controls/-activations` | ✅ | Backend geprüft | free (`dsgvo`) / starter (`eu_ai_act`) / agency+ (NIS2, TISAX) / enterprise (DORA) | `compliance_pack` | `governance_core` + `advanced_ai_governance` | — |
| Reports | `/app/governance/report-builder`, `/app/governance/audit-reports` | `audit-report-pdf`, `audit-report-email` · `audit_reports`, `audit_exports` | ✅ | `auditReportsPerMonth` | free (`compliance_reports`) | — | `governance_core` | Berichte/Monat |
| Memory Governance | `/app/governance/memory` | `governance-memory`, `memory-decay-worker`, `memory-confidence-trigger` · `governance_memory` | ✅ | — | — (RFC-003, außerhalb der Plan-Matrix) | — | — | — |

### Querschnitt

| Modul | Route(n) | Backend | Deployt | Entitlement / Gating | Plan ab | Add-on | Bookable | Usage |
|---|---|---|---|---|---|---|---|---|
| API / Webhooks | `/app/governance/api-keys` | `api-audit`, signierte Webhooks | ✅ | `permissions.api`/`webhooks`, `useApiAccess()` (eine der wenigen Frontend-Gate-Stellen) | agency (`api`, `webhooks`) | — | — | `apiCallsPerMonth`, `apiKeys` |
| Billing / Checkout | `/app/billing` (AAL2) · `/billing/usage` · `/os/checkout` | `stripe-checkout`, `stripe-webhook`, `stripe-portal`, `stripe-meter-sync` · `products` (22), `product_entitlements` (350), `entitlements` (63), `entitlement_grants`, `subscription_addons` | ✅ | Kette `products → product_entitlements → entitlements` + `tenant_entitlements()` (`reality-matrix.md` §3) | alle | — | — | Metered Billing |

---

## 2. Wie „Öffnen vs. Aktivieren" zu entscheiden ist

Die Infrastruktur für die Modulansicht existiert vollständig und muss nicht
gebaut werden:

```
Plan / Grants (Stripe → subscriptions, entitlement_grants)
        ↓
tenant_entitlements()  (DB) · hasModule()/hasPermission()/limitOf()  (SSoT)
        ↓
Frontend: src/core/access/Gate.tsx · src/core/billing/FeatureGate.tsx,
          SubscriptionLimitGuard.tsx · src/core/access/access-policy.ts
        ↓
  verfügbar → Öffnen (Route aus §1)
  fehlt     → Aktivieren → stripe-checkout (Add-on / Bookable Module)
```

Der Engpass ist die **Adoption, nicht die Existenz**: `Gate`/`FeatureGate`/
`SubscriptionLimitGuard` werden außerhalb von `src/core/` derzeit in genau
**einer** Feature-Datei verwendet (`Iso42001ComplianceHub.tsx`); die übrigen
`/app/*`-Views rendern ungegatet. Das Backend prüft dagegen real (u. a.
`bot-chat`, `bot-voice-webhook`, `evidence-vault`, `scheduler`,
`policy-packs` über `_shared/entitlements.ts`). Eine Modulansicht wie im
Zielbild ist damit Verdrahtungsarbeit an bestehenden Bausteinen.

---

## 3. Befunde

1. **`src/config/production-edge-functions.ts` war veraltet — erledigt am
   2026-08-23 (dieser Branch).** Die Datei trug `MEASURED_AT = 2026-08-19`
   mit 103 Functions und nannte die Differenz „nicht erklärt"; live gemessen
   sind es **177**, deckungsgleich mit dem Repo. Die Liste wurde per
   Neumessung ersetzt, `MEASURED_AT` mitgezogen, `UNBACKED_CALLERS`
   durchgesehen: 19 Einträge (u. a. `website-domain-manager`, `bulk-scan`,
   SEO-Dashboard, ISO-42001-Strecke) waren inzwischen deployt und wurden
   entfernt; übrig bleiben 7 echte Lücken (4× `/api-docs`-Endpunkte,
   `export-bulk-results`, `iso42001-control-update`, `trigger-workflow`).
   Ebenfalls nachgezogen: `src/config/platform-capabilities.ts` (Bot-Laufzeit
   und Herkunftsnachweis sind per Messung `live`,
   `CAPABILITIES_MEASURED_AT = 2026-08-23`) samt der messungs-gepinnten
   Tests.
2. **WhatsApp wird dreifach verkauft, existiert aber nicht.** Als Modul ab
   Growth (`plan.modules`), als Add-on (growth+) und als Bookable Module —
   ohne Function, ohne Tabelle, ohne App-Route (live verifiziert). Vor jeder
   Plan-Konsolidierung entscheiden: bauen oder aus den Verkaufsflächen
   nehmen.
3. **Voice hat zwei Preise.** Add-on vs. Bookable Module — als
   `MODULE_ADDON_PRICE_DIVERGENCE` deklariert und getestet, aber ungelöst.
   Auflösung gehört in die Preiskalkulation (`reality-matrix.md` §5.2).
4. **Terminbuchung ist verkaufsfähig modelliert, aber funktional leer.**
   `appointment-book` prüft keine Verfügbarkeit, `availability_rules` wird
   nirgends gelesen (`reality-matrix.md` §2). Das Bookable Module `booking`
   verspricht eine Slot-Engine, die es nicht gibt.
5. **`/app/agents` ist doppelt registriert** (`src/App.tsx:848` und
   `src/App.tsx:852`). Die erste Route gewinnt; `AgentsOverviewPage` ist
   toter Code hinter einer unerreichbaren Route. Entfernen greift in
   Bestehendes ein → Fragepflicht nach `CLAUDE.md` §10.3.
6. **`ChatbotStartPage`/`PhonebotStartPage` täuschten eine Funktion vor —
   erledigt am 2026-08-23 (dieser Branch).** Beide Erstellungs-Buttons
   lösten nur einen Platzhalter-`alert` aus, obwohl `bot-chat` und
   `bot-voice-webhook` deployt sind. Fertiggestellt nach §14/§10.2: beide
   CTAs verlinken jetzt auf `/app/bots` (unverändertes Design, unveränderte
   Beschriftung).
7. **Landingpage Builder gehört bereits ins Dashboard-Zielbild.** Er ist
   unter `/app/siteos/builder` erreichbar und hat einen eigenen
   Checkout-Pfad. Offen bleibt der normative **Publish Gate vor dem ersten
   Publish-Pfad** (`CLAUDE.md` §14, `target-architecture.md` §7) — ein
   Publish-Handler existiert noch nicht.
8. **Plan-Reduktion (Free + 2–3 Kernpakete) ist eine Produktentscheidung,
   keine Architekturarbeit.** Die Struktur dafür liegt bereits auf `main`:
   `BOOKABLE_MODULES` modelliert genau „Core + einzeln zubuchbare Module"
   neben der Sechser-Leiter. Eine Reduktion heißt: Leiter in
   `shared/pricing.ts` ändern, `npm run sync:pricing`, DB-Katalog
   (`plan_catalog`, `products`) und Stripe nachziehen — Regeln in
   `docs/product/pricing-governance.md`. Solange beide Systeme parallel
   existieren, gilt Befund 3 (doppelte Preise) verschärft.

---

## 4. Nicht Teil dieses Audits

Keine Preise geändert, keine Pläne entfernt, kein Code angefasst. Diese
Datei ist Messung und Landkarte — die Entscheidungen aus §3 (insbesondere
2, 5, 6, 8) liegen beim Eigentümer.
