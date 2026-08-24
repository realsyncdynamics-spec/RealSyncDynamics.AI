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
| WhatsApp Bot | `/app/bots/whatsapp` (Kanal-Setup, verlinkt aus `/app/bots`) · `/pricing/whatsapp` (Marketing) | `whatsapp-webhook` (Meta Cloud API, seit 2026-08-23 im Repo) · `whatsapp_channels` (Migration `20260826000000`) | Repo ✅ · Prod erst nach Merge + `deploy.yml` | Backend: Signaturprüfung + `bots.whatsapp`-Gate + `limit.bot_messages_monthly`; neue Konversationen auf `limit.whatsapp_conversations_monthly` (metered) | growth (`whatsapp` in `plan.modules`, Entitlements gebunden) | `whatsapp` (growth+) | `whatsapp_bot` | ja (Konversationen, metered) |
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
2. **WhatsApp wurde dreifach verkauft, existierte aber nicht — Entscheidung
   „Backend bauen" (2026-08-23), v1 auf diesem Branch.** Neu:
   Edge Function `whatsapp-webhook` (Meta Cloud API: Verify-Handshake,
   `X-Hub-Signature-256`, Dedupe, `bots.whatsapp`-Gate, `bot_reply`-Pipeline,
   Graph-API-Versand), Migration `20260826000000_whatsapp_channel.sql`
   (`whatsapp_channels` mit RLS, Entitlement-Keys `bots.whatsapp` +
   `limit.whatsapp_conversations_monthly` ab Growth), Tests
   `test/bots/whatsapp-parse.test.ts`, Kanal-Setup-Ansicht
   `/app/bots/whatsapp` (`WhatsAppChannelsView`, verlinkt aus `/app/bots`).
   **Noch offen**: Deploy (erst nach Merge) und Meta-Secrets
   (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`,
   `WHATSAPP_ACCESS_TOKEN`).
3. **Voice hat zwei Preise.** Add-on vs. Bookable Module — als
   `MODULE_ADDON_PRICE_DIVERGENCE` deklariert und getestet, aber ungelöst.
   Auflösung gehört in die Preiskalkulation (`reality-matrix.md` §5.2).
4. **Terminbuchung ist verkaufsfähig modelliert, aber funktional leer.**
   `appointment-book` prüft keine Verfügbarkeit, `availability_rules` wird
   nirgends gelesen (`reality-matrix.md` §2). Das Bookable Module `booking`
   verspricht eine Slot-Engine, die es nicht gibt.
5. **`/app/agents` war doppelt registriert — nach Freigabe vom 2026-08-23
   bereinigt.** Die unerreichbare zweite Registrierung (`AgentsOverviewPage`)
   wurde aus `src/App.tsx` entfernt; die Datei und die `/app/agents/*`-
   Unterrouten bleiben. Verhalten unverändert (die erste Route gewann schon
   vorher).
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
   neben der Sechser-Leiter. Der konkrete Zielschnitt ist als Vorschlag
   ausgearbeitet: `docs/product/plan-consolidation-proposal.md`
   (FREE / STARTER / BUSINESS + Modul-Store, Enterprise auf Anfrage) —
   Umsetzung erst nach Freigabe der dort gelisteten Entscheidungen.
   Solange beide Systeme parallel existieren, gilt Befund 3 (doppelte
   Preise) verschärft.

---

## 4. Nicht Teil dieses Audits

Keine Preise geändert, keine Pläne entfernt, kein Code angefasst. Diese
Datei ist Messung und Landkarte — die Entscheidungen aus §3 (insbesondere
2, 5, 6, 8) liegen beim Eigentümer.

---

## 5. Abgleich nach AP2 (Nachtrag vom 2026-08-24)

Die Matrix oben ist am 2026-08-23 erhoben worden, also **vor** AP1 und AP2.
Die Spalte „Plan ab" liest dort aus `plan.modules`. Genau diese Quelle hat
AP1 als nicht maßgeblich entlarvt und AP2 mit der Datenbank in Deckung
gebracht. Der Abgleich steht deshalb hier — die Matrix selbst bleibt als
Messung ihres Datums erhalten, damit nachvollziehbar bleibt, was sich
wodurch verschoben hat.

**Methode**: `planGrants()` über `PLAN_ORDER`, einmal über alle Ränge und
einmal nur über die seit AP2 wählbaren Pläne. Quelle ist der Stand nach
Migration `20260831010000`, gegen eine echte PostgreSQL geprüft.

| Modul (Matrix §1) | Matrix sagt „Plan ab" | gemessen nach AP2 | Art der Abweichung |
|---|---|---|---|
| Website Chatbot | starter (`ai_bots`, `website_chat`) | **starter** | **Claim jetzt gedeckt.** Vorher stand er nur in `plan.modules`; `bots.enabled`/`bots.chat` fehlten Starter, die Runtime verweigerte ihn. AP2 hat die Berechtigung nachgezogen. |
| Telefon-Agent (Voice) | agency (`voice`) | Plan: **enterprise** · Add-on „Voice" ab **growth** | Verschoben, weil Agency stillgelegt ist. Ein Vorschlag „ab Agency" führte in eine Sackgasse. |
| WhatsApp Bot | Kanal ab growth · Add-on `whatsapp` (growth+) | Kanal ab **growth** · Add-on **nur starter** | Add-on-Zuordnung korrigiert: Es war für den einzigen Plan *ohne* WhatsApp nicht buchbar. |
| Terminbuchung | „in keinem `plan.modules`" | **growth** (`bots.appointments`) | Der Key existiert seit Juni; nur `plan.modules` kannte ihn nicht. AP1 hat `unlocks` korrigiert. |
| Policies | free/starter · agency+ (NIS2, TISAX) · enterprise (DORA) | `policy.packs` ab **starter** · `policy.iso27001` ab **growth** · `policy.nis2` ab **enterprise** | `policy.packs` ist neu auf Starter (AP2). NIS2 rückt nach oben, weil Agency entfällt. |
| API / Webhooks | agency (`api`, `webhooks`) | **growth** | Durch AP2 verschoben — Agencys exklusive Fähigkeiten brauchten ein Zuhause. Dasselbe gilt für `scheduler.enabled`, `bulk.jobs`, `c2pa.export`, `provenance.advanced`, `evidence.advanced`. |
| Monitoring | starter (`monitoring`) | **starter** (`monitoring.monthly`), täglich ab growth | unverändert |
| Evidence | starter (`evidence_vault`) | Basis ab **free**, erweitert ab **growth** | ergänzt: `evidence.advanced` ist neu auf Growth |

Nicht verschoben und hier nur zur Vollständigkeit: `sso.enabled` und
`org.governance` bleiben Enterprise, `whitelabel.reports` ist Add-on
(„White Label", ab Growth buchbar).

### 5.1 Die Plan-Leiter im Kopf dieser Datei

Der Verweis „`PLANS` (free → starter → growth → agency → enterprise →
partner)" beschreibt weiterhin korrekt die **Ränge**. Die **Verkaufsleiter**
ist seit AP2 eine andere:

```
free  →  starter  →  growth  →  enterprise (Vertrag)
                     agency, partner: Legacy, nur Bestandskunden
```

Wer eine „Plan ab"-Angabe für den Verkauf braucht, muss die zweite Zeile
lesen. Ausführlich: `docs/product/ap2-paketumbau.md`.

### 5.2 Zwei Befunde, die dieser Abgleich offenlässt

**`/realsync-landing` ist eine zweite Preisquelle.** Die Seite führt fünf
Plan-Karten mit hart codierten Beträgen im JSX, inklusive Agency und
Partner. Sie bezieht nichts aus `shared/pricing.ts` und ist seit AP2
sachlich falsch. Das ist derselbe Befund wie bei `/pricing/whatsapp`
(`zielzustand-paketmodell.md` §3.2) und derselbe Verstoß gegen
`CLAUDE.md` §6. **Die Aufgabe heißt nicht „Landingpage anpassen", sondern:
jeder öffentliche Preis-Konsument bezieht aus der kanonischen Quelle.**
Solange das offen ist, kann AP2 die Drift nur an den Stellen beseitigen, die
bereits ableiten.

**Partner verspricht SSO, bekommt es aber nicht.** `permissions.sso` ist auf
Partner `true`, `sso.enabled` liegt in der Datenbank nur auf Enterprise. Ein
Claims-vs-Runtime-Widerspruch, älter als AP2. **Bewusst nicht repariert**:
Die naheliegende Antwort („dann bekommt Partner eben SSO") wäre eine
Produktentscheidung, und Partner ist seit AP2 stillgelegt. Möglicherweise
ist die richtige Auflösung, den Claim zu streichen statt eine Fähigkeit zu
vergeben. Das gehört entschieden, nicht nebenbei behoben. Festgehalten als
Testfall in `test/billing/ap2-package-model.test.ts` — fällt er, ist die
Lücke geschlossen worden und der Fall gehört wieder in die reguläre Prüfung.

---

## 6. Claims-Reality-Audit, Teil 1: Enforcement (2026-08-24, Stand `8a652d4`)

Erste Messung zur Frage aus dem Auftrag: **Wo ist ein Versprechen bloß eine
Preisangabe, und wo ist es eine Regel?**

### 6.1 Wie viel wird überhaupt serverseitig geprüft

| | Anzahl |
|---|---:|
| Edge Functions im Repo | 178 |
| davon mit Entitlement-Wächter (`_shared/entitlements.ts`) | **10** |

Die zehn: `automation-trigger`, `bot-chat`, `bot-voice-webhook`, `bulk-scan`,
`evidence-vault`, `policy-packs`, `provenance`, `scheduler`,
`whatsapp-webhook`, `workflow-trigger`.

Durchgesetzte Boolean-Keys: `ai.tool.automations`, `ai.tool.workflows`,
`bots.enabled`, `bots.voice`, `bots.whatsapp`, `bulk.jobs`,
`evidence.advanced`, `policy.packs`, `provenance.advanced`,
`scheduler.enabled`. **Zehn von 73.** Alles Übrige ist heute Anzeige, nicht
Kontrolle — das ist der Befund, nicht ein Vorwurf: Viele Keys beschreiben
Fähigkeiten ohne eigenen Endpunkt.

### 6.2 Kontingent ist nicht gleich Kontingent

`_shared/usage.ts` kennt zwei Wege, und nur einer hält:

| Funktion | Verhalten |
|---|---|
| `consumeUsage()` | prüft **vor** dem Buchen und wirft `QUOTA_EXCEEDED` |
| `recordUsage()` | bucht nur, **ohne** Grenze |

`recordUsage()` ist an Stellen richtig, wo die Leistung bereits eingekauft
ist (LLM-Aufruf, Telefonieminute) — sie zu verschweigen wäre schlimmer als
sie über der Grenze zu buchen. Aber: **`limit.bot_voice_minutes_monthly`,
`limit.automation_runs_monthly` (im Callback), `limit.ai_tokens_monthly`,
`limit.ai_calls_monthly` und `limit.whatsapp_conversations_monthly` werden
nur gebucht, nicht begrenzt.** Wer sie als harte Grenze verkauft, verkauft
eine Zusage, die nur nachträglich sichtbar wird.

Mit `consumeUsage()` und damit tatsächlich begrenzt:
`limit.bot_messages_monthly`, `limit.bulk_jobs_monthly`.

### 6.3 Der schwerwiegende Befund — und er stammt aus dieser Arbeit

Die Frage „Kann Starter technisch mehr als 500 Antworten erzeugen?" führte
auf etwas Größeres.

`consumeUsage()` und `gateFeature()` lösen Entitlements über den
**Admin-Client** auf (`admin.rpc('tenant_entitlements', …)`). Ein
service_role-Token trägt keinen `sub`-Claim, `auth.uid()` ist also NULL.
Seit `20260828010000` filtert die Funktion aber über eine
Mitgliedschaftsprüfung — und liefert dem Server damit **null Zeilen**.

Gegen eine echte PostgreSQL gemessen, Growth-Mandant mit 47 Entitlements:

| Aufrufer | vor `20260828010000` | mit Prüfung | nach `20260831020000` |
|---|---:|---:|---:|
| Browser, Mitglied | 47 | 47 | 47 |
| Edge Function (service_role) | 47 | **0** | 47 |
| Fremder eingeloggter Nutzer | **47** | 0 | 0 |

Die mittlere Spalte wäre mit diesem PR in Produktion gegangen. Folgen:

- `gateFeature()` hätte **jeden** Aufruf der zehn Functions abgewiesen —
  für jeden Kunden bis Enterprise.
- `consumeUsage()` hätte die Plan-Grenze übersprungen (`planLimit` NULL),
  Kontingente wären lautlos wirkungslos geworden.

Die linke Spalte zeigt zugleich, warum die Prüfung überhaupt eingeführt
wurde: Vorher konnte **jeder eingeloggte Nutzer die Entitlements jedes
beliebigen Mandanten lesen**. Beide Eigenschaften sollen gelten, nicht eine.
`20260831020000` lässt deshalb zusätzlich `auth.role() = 'service_role'` zu.

**Korrektur einer eigenen Aussage.** Der Kommentar in `20260828010000`
behauptet, die Mitgliedschaftsprüfung sei „unverändert" übernommen worden.
Das war falsch — die Fassung davor (`20260808120000`) hatte keine. Der
Nachweis zu AP1 und AP4 hat den Fehler nicht gefunden, weil er `auth.uid()`
auf einen festen Nutzer gestubbt hat und den service_role-Fall damit nie
gesehen hat. **Lehre: Ein Nachweis, der nur den Weg prüft, den man im Kopf
hat, prüft nichts.** Jede Zugriffsregel braucht die Gegenprobe für *jeden*
Aufrufer, den es gibt — hier Browser, Server, fremder Nutzer, anonym.

Abgesichert durch `test/runtime/db/tenant-entitlements-callers.db.test.ts`
(fünf Fälle, mutationsgeprüft: gegen die kaputte Fassung fallen genau die
beiden service_role-Fälle, die Mandantentrennung bleibt grün).

### 6.4 Was Teil 2 messen muss

Noch offen und für den nächsten Schritt vorgemerkt:

1. **Frontend-only-Gates.** Der Agency-Befund ist der Musterfall
   (Oberfläche versteckt, Server erlaubte). Dieselbe Prüfung fehlt für die
   übrigen eingeschränkten Fähigkeiten — insbesondere für die 63 Keys ohne
   Wächter aus §6.1.
2. **Compliance-Claims.** Für NIS2, ISO 27001, TISAX und DORA ist bisher nur
   belegt, dass ein Entitlement-Key existiert und ab welchem Plan er liegt.
   Nicht belegt: welche Controls, welche Evidence, welche Automatisierung,
   welche Assessment-Funktion dahinterstehen — und welche Aussage daraus
   zulässig ist. Ein Policy Pack ist kein Compliance-Nachweis.
