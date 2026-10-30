# RealSync – Projektstand

**Stand:** 27.10.2026 · **Quelle:** Repo-Stand `main` @ `c9a7da6` (plus die zitierten Status-Dokumente; Laufzeitdaten nur, soweit sie dort mit Datum belegt sind)
**Zweck:** Faktenbasis für das Claude-Projekt. Die Strategie steht in `01-strategie.md`. Bei Widerspruch gilt: Code vor Doku, Ist vor Soll.

---

## 1. Produkt in 5 Sätzen

1. RealSyncDynamics.AI ist eine EU-souveräne AI-Governance-Runtime für DSGVO und EU AI Act, live unter https://realsyncdynamicsai.de.
2. Es ist kein Chatbot, sondern eine Governance-Schicht zwischen Mensch, Unternehmen, KI-Agenten und Daten: erkennen, klassifizieren, freigeben, nachweisen.
3. Einstieg ist ein kostenloser Website-Check (`/audit`); im Kern stehen Command Center (`/app/dashboard`), KI-Register, Freigaben und Evidence (Nachweise mit Hash-Kette).
4. Technik: Vite/React-SPA auf Cloudflare Pages, Supabase in der EU (Postgres mit RLS, Edge Functions), KI-Aufrufe über Cloud-Anbieter oder optional EU-lokal (Ollama).
5. Derzeit läuft eine offene Beta (Growth-Umfang kostenlos, Anzeige-Ende 31.01.2027); Self-Service-Pläne Starter/Growth/Agency, Enterprise nur auf Anfrage.

---

## 2. README-Kurzfassung (bereinigt)

Die README beschreibt das Produkt als „EU-souveräne Compliance-Infrastruktur für Unternehmen und Agenturen“ mit Audit, Monitoring, Evidence-Vault, Multi-Tenant, opt-in EU-lokaler KI und transparentem Billing. Was davon den Code-Stand trifft:

| README-Aussage | Einordnung heute |
|---|---|
| AI-Tools mit Plan-Kontingenten, Audit-Log, Kostenerfassung (`ai-invoke`) | trifft zu; Kontingente für AI-Calls/-Token sind serverseitig hart begrenzt |
| Kodee (VPS-Assistent, `/kodee`) | **Preview** laut Registry, nicht „implementiert/fertig“ |
| n8n-Workflow-Engine (`/workflows`) | **Preview**: Trigger/Callback existieren, keine produktive Ausführung, Runtime-Host nicht erreichbar |
| Multi-Tenant mit Rollen + Einladungen (`/tenant/invites`) | trifft zu (RLS auf allen `public`-Tabellen); Sitzplatz-Limit wird nicht geprüft |
| Stripe-Billing Free → Enterprise, metered usage | Monats-Checkout live; Jahrespreise nicht verdrahtet; Enterprise ohne Self-Service |
| DSGVO-Rechte Export (Art. 15) / Löschung (Art. 17) | trifft zu (`/settings/account`) |
| Datenresidenz-Wahl `cloud` / `eu_local` | UI vorhanden (`/settings/ai-residency`); aktuelle Laufzeit des EU-lokalen Pfads **unbelegt** (letzte Validierung Mai 2026) |
| Deploy „statisch auf Hostinger-VPS hinter Traefik“ | **veraltet**: Frontend-Deploy ist Cloudflare Pages (CLAUDE.md, reality-matrix); VPS nur noch für Nebendienste |
| Ordner `platform/` (Python-Builder, Next.js-Frontend) | Nebenprojekt im Monorepo; **nicht** Teil der Live-SPA |
| SiteOS Customer Builder: Audit → Blueprint → Preview → Builder | trifft zu als Preview (siehe §5) |

Preis-SSoT: `shared/pricing.ts` (die README verweist noch auf `src/config/pricing.ts`). Details zu Preisen: `04-preise.md`.

---

## 3. Roadmap (verdichtet)

### 3.1 Produkt-Roadmap (`ROADMAP.md`, letzte Aktualisierung Mai 2026)

Positionierung dort: „Automated Digital Compliance Infrastructure“ – Risikoreduktion, Nachweisbarkeit, Automatisierung, Monitoring; ausdrücklich **keine** „100 % rechtssicher“-Versprechen.

| Phase | Inhalt | Stand laut Roadmap |
|---|---|---|
| A – Runtime härten | Event-Schema, Evidence-Hashing (SHA-256), Agent-Contracts, Remediation-Layer | als erledigt/Skelett markiert |
| 1 – Audit Platform (0–3 Mon.) | `cookie-scan`, `gdpr-audit`, Rule Engine, Tracker-Registry, PDF-Report | großteils erledigt; Playwright-Scanner-Deploy und Report-Mail offen |
| 2 – Auto-Remediation (3–6 Mon.) | Consent-Injection, Tracker-Removal, Fonts-Self-Hosting, CSP, CMS-Patches | Bausteine im Website-Rebuild vorhanden; CMP, Formulare, CSP, CMS offen |
| 3 – CMS-Integrationen (6–12 Mon.) | WordPress-Plugin, Shopify-App | offen |
| 4 – Continuous Compliance (12+ Mon.) | Drift Detection, Evidence Vault (HAR, Consent-Logs), AI-Act-Inventar, DSB-Dashboard | teils inzwischen anders umgesetzt (KI-Register, Evidence), Drift/Consent-Logs offen |

Hinweis: Die Roadmap-Datei ist älter als der heutige Produktfokus „Governance OS“ und spiegelt die Plan-Bereinigung (AP2) nicht.

### 3.2 Masterplan 2026/27 (`docs/strategy/MASTERPLAN_2026-2027.md`, Stand 26.10.2026)

Status: überarbeitete Planfassung, **keine** Implementierungs-/Merge-/Produktionsfreigabe. Leitplanken: `/` bleibt Landing v6, keine Routenlöschung und keine Preisänderung ohne Owner-Freigabe, ein Arbeitspaket pro PR.

- **Nordstern-Metrik:** Organisationen mit aktivem Evidence-Nachweis pro Monat. In Produktion wurden in den 30 Tagen vor dem 26.10.2026 **0** `usage_events` und **0** `ai_evidence_events` geschrieben – es gibt noch keine Datenbasis für Prognosen.
- **Planungsziele (keine Prognose):** bis 31.12.2026 ein kanonischer Funnel live, Time-to-First-Evidence < 15 min; 31.01.2027 Beta-Ende → Beta-zu-Paid-Quote messen; MRR-/Partner-Ziele 2027 erst nach Beta-Auswertung. Frühere Zahlen (100 Workspaces, 10–60 k € MRR) sind gestrichen.
- **Rechtsrahmen:** VO (EU) 2026/1744 (Änderung AI Act) laut Kommission am 27.07.2026 in Kraft; Hochrisiko Anhang III ab 02.12.2027, Anhang I ab 02.08.2028; Art. 50 Transparenz grundsätzlich seit 02.08.2026. Genaue Artikelanwendung muss fachkundig geprüft werden.

| Phase | Inhalt | Stand am 27.10.2026 (Code) |
|---|---|---|
| **0** P0-1 | Cron-Functions (`scheduler-dispatch`, `governance-monitoring-scheduler`, `memory-decay-worker`) liefen mit HTTP 500 (fehlende Function-Secrets) | Owner-Schritt im Dashboard; Behebung **unbelegt** |
| **0** P0-2 | Alarm bei Cron-Ausfall | offen |
| **0** P0-3 | Evidence-Eintrag pro authentifiziertem KI-Call im `ai-gateway` | im Code umgesetzt (#2015, fail-open); Produktionswirkung **unbelegt** |
| **0** P0-4 | Freigabe-Evidence in die Hash-Kette (`append_governance_evidence`) | im Code umgesetzt (#2015, dazu Vier-Augen-Prinzip #2006) |
| 1 „Ein Weg“ | ein Onboarding, ein Dashboard, ein Agenten-Register, Mock-Dashboards kennzeichnen | offen |
| 2 | Governance-Kette Publish/Agent → Approval → Evidence; Beta → Paid | offen; hängt an Preisentscheidung E-P1 |
| 3 | Beta-Abschluss, Case Studies nur mit Freigabe | nach 31.01.2027 |
| 4/5 | Credits, Agency/White-Label, Partner; Enterprise (SSO/SCIM, eu_local/On-Prem) | Vision |

### 3.3 Produktumbau SiteOS/Module (`docs/product/reality-matrix.md`, ab 22.08.2026)

Reihenfolge des modularen Umbaus (Plan, keine Termine):

| # | Schritt | Stand |
|---|---|---|
| 0–1 | Reality Matrix, Modulkatalog `BOOKABLE_MODULES` + Weiche „Website behalten vs. modernisieren“ (`/unified-entry/entscheidung`) | erledigt (Modulpreise `provisional`) |
| 2–3 | Free-Scan auf die Weiche ausrichten; Registrierung ordnet Pfad + Scan dem Tenant zu | öffentlicher Trichter heute `/audit` (früher `/scan`) |
| 4–7 | Modul-Auswahl-UI, Module als Stripe-Produkte, Dashboard-Navigation, Feature-Gating über `tenant_entitlements()` | offen; hängt an Preisentscheidung |
| 8 | Publish Gate, dann SiteOS-Publish | Gate + Vorschau/Produktion gebaut (Preview), Domain/DNS/Rollback offen |
| 8a/8b | Asset-Upload, geführte Integrationen, Bildanalyse → Design-Tokens | offen |
| 9–11 | Booking Engine auf Firmenebene (statt pro Bot), danach Chat und Voice anbinden | offen – heute zwei Terminspuren ohne Slot-Logik |
| 12–13 | Bots/Websites als Governance-Assets; Multi-Company (`organizations` vs. `tenants` klären) | offen |

### 3.4 Offene Owner-Entscheidungen (Masterplan §8)

 ~~Enterprise-Preis~~ (entschieden: 1.498 € netto, Self-Service-Checkout, Owner 24.10./30.10.2026; offen bleibt E-P1h Bot-Kostenbremse), verfügbare Kapazität, Zielwerte, rechtliche Prüfung, Cron-Secrets, Partner-Reaktivierung, `/audit` als kanonischer Einstieg, Stilllegung von Routen (erst nach Bestandsliste).

---

## 4. Messbare Eckdaten (Code, `c9a7da6`)

- `src/App.tsx`: **518** `<Route>`-Elemente, davon **92** reine `Navigate`-Weiterleitungen (≈ 426 rendernde Routen). Der Masterplan nennt 517 (Stand `5c3e718`).
- Edge Functions: 177 deployt, Repo ⇄ Produktion deckungsgleich (Messung 23.08.2026, `capability-matrix.md`); heute nicht neu gemessen.
- Entitlement-Modell: `products` → `product_entitlements` → `entitlements` (63 Keys) + `tenant_entitlements()`; im Frontend werden die Gates (`Gate`, `FeatureGate`) kaum genutzt – die Durchsetzung liegt im Backend.
- Datenbasis: RLS auf allen `public`-Tabellen; Supabase-Plan laut reality-matrix (08/2026) `free` – kein Backup/PITR/SLA (eigener Governance-Befund, Stand heute unbelegt).
- Claim-Hygiene in CI: `npm run check:landing-claims` prüft die Landing gegen `src/product/implementation-status.ts` (keine „live“-Aussagen für Preview/Coming-Soon, keine Fake-KPIs, kein ISO 27001/NIS2 als live ohne Registry-Eintrag).
- Registry-Stände: `src/product/implementation-status.ts` gemessen am 18.10.2026; `src/config/platform-capabilities.ts` am 23.08.2026; `docs/runtime-status-matrix.md` am 16.05.2026.

---

## 5. Tatsächlich verfügbare Funktionen

Statuslegende: **Live** = erreichbar und backend-gestützt · **Beta** = live, aber als Beta/Preview gekennzeichnet bzw. unvollständig · **Teilweise** = Teile funktionieren, Kernversprechen fehlt · **Nur UI-Mock** = Oberfläche mit festen/Demo-Daten · **Geplant** = nicht gebaut oder nicht verdrahtet. „unbelegt“ = Doku behauptet es, aktueller Beleg fehlt.

### 5.1 Öffentlicher Bereich und Einstieg

| Funktion | Route/Ort | Status | Beleg |
|---|---|---|---|
| Landing v6 („The Governance OS für DSGVO und EU AI Act“) | `/` | Live | `src/pages/LandingV6.tsx`, `src/components/landing/v6/` |
| Ältere Designs v2/v4/v5/v7 | `/design/landing-v*` | Live (Vorschau) | `src/App.tsx` |
| Kostenloser Website-Check (DSGVO/Tracking) | `/audit` (`/scan` leitet dorthin) | Live | `src/pages/AuditLanding.tsx`, Edge `cookie-scan`, `gdpr-audit` |
| PDF-Audit-Bericht | nach Scan | Live | Edge `audit-report-pdf`; runtime-status-matrix |
| Deep Scan mit Playwright (Consent-Timing) | `/consent-timing`, Service `playwright-scanner` | Teilweise / unbelegt | ROADMAP: Deploy ausstehend; runtime-status-matrix 🟡 |
| EU-AI-Act-Klassifikator (Annex III, regelbasiert + optional LLM) | `/ai-act-klassifikator` | Live – **nicht rechtsverbindlich** | `src/pages/AiActClassifier.tsx`, Edge `ai-act-classify` |
| Weitere Gratis-Tools (AVV, TOM, VVT, DSFA, Bußgeld, Meldepflicht-Timer, DSE-Generator) | `/tools/*` | Live als Frontend-Tools; Server-Gate nur teilweise (`dse.generator` reine Anzeige) | `src/App.tsx`, `entitlement-reality-map.md` |
| Kontakt / Enterprise-Anfrage | `/kontakt`, `/contact-sales` | Live | `src/pages/ContactSales.tsx`, Edge `sales-lead` |
| Login (Magic-Link/OTP/OAuth) | `/welcome`, `/login` | Live | `src/pages/Welcome.tsx`, `src/pages/LoginPage.tsx` |
| Sehr viele SEO-/Branchen-/Vergleichsseiten | `/branchen/*`, `/*-alternative` u. a. | Live (Marketing) | `src/App.tsx` |

### 5.2 App (`/app`, hinter `AppGate`)

| Funktion | Route/Ort | Status | Beleg |
|---|---|---|---|
| Command Center mit Startansicht, Einrichtungsfortschritt, OS-Kacheln | `/app/dashboard` | Live (Leerzustände ehrlich) | `src/features/governance/dashboard/CommandCenterDashboard.tsx`; Registry `command-center` |
| Beispiel-Mandant (feste Daten, kein DB-Zugriff) | `/app/beispiel` | Nur UI-Mock (gekennzeichnet) | `SampleWorkspacePage.tsx` |
| Governance Activation (Org + Scope) | `/app/activation` | Live | Registry `governance-activation` |
| Auto-Blueprint, Dokument-Extraktion, Expert-Review in Activation | `/app/activation` | Geplant | Registry `activation-*` (coming-soon) |
| KI-Register: Systeme anlegen, pflegen, klassifizieren | `/app/ai-systems`, `/app/ai-systems/:id` | Live | Edge `governance-resources` (`update_asset`, `classify_asset`); Registry `ai-system-registry` |
| Klassifikator-Ergebnis ins Tenant-Inventar speichern | `/app/risk-inventory` | Teilweise (Persistenz nicht freigeschaltet, kein Plan entsperrt) | Registry `ai-act-inventory-persist`, PR #1743 |
| Risikoregister | `/app/risks`, `/app/risk-inventory` | Live (Server-Gate `governance.risk_register` seit AP9) | `entitlement-reality-map.md` |
| Governance-Kernmodule: Vorfälle, DSR, DSFA, Dienstleister | `/app/incidents`, `/app/dsr`, `/app/dpia`, `/app/vendors` | Live laut Registries; DSFA als „unterstützt, ersetzt keinen DSB“ | `platform-capabilities.ts#governance-runtime`; runtime-status-matrix |
| Freigaben (Approval Queue) mit Vier-Augen-Prinzip und verketteter Evidence | `/app/approvals` | Beta (Code neu seit #2006/#2015; Workflow-Reife laut Matrix 🟡) | Edge `governance-approvals` |
| Evidence Vault / Nachweis-Export (Hash-Kette) | `/app/evidence`, `/app/evidence-vault` | Live; formale Hash-Spezifikation fehlt, kein WORM-Speicher | Edge `evidence-vault`, `evidence-export`; runtime-status-matrix |
| Evidence pro KI-Aufruf | `ai-gateway` | Teilweise (Code seit #2015; 0 Einträge in Prod bis 26.10.) | Masterplan I-5, PR #2015 |
| Policy Packs (DSGVO, AI Act; ISO 27001, NIS2 plan-gated) | `/app/policy-packs` | Live als Control-Kataloge; **kein** geführtes Assessment außer AI Act | Edge `policy-packs`; `claims-reality-audit.md` §4 |
| TISAX / DORA | – | Geplant (Katalog-Zeilen existieren, `coming-soon`) | `shared/pricing.ts` Module, Registry `framework-tisax-dora` |
| ISO-42001-Hub und Unterseiten | `/app/governance/iso42001*` | Teilweise / unbelegt (Routen da; mehrere Backend-Endpunkte fehlten bei Messung 08/2026) | `capability-matrix.md` §3.1 |
| Dauerhafte Domain-Überwachung (täglicher Re-Scan, Drift) | `/app/monitoring` | Geplant/inaktiv: Code + Plan-Gate vorhanden, Cron läuft nicht (HTTP 500) | Registry `continuous-domain-monitoring`; Masterplan I-4 |
| E-Mail-Alerts bei neuen Findings | – | Teilweise: Gate vorhanden, kein Cron-Job in Prod → Versand läuft für niemanden | `entitlement-reality-map.md` (`alerts.email`) |
| Remediation-/Fix-Empfehlungen (Code-Snippets) | `/app/remediation` | Live als Empfehlung (Umsetzung durch Nutzer) | Edge `governance-remediate`; runtime-status-matrix |
| Agenten-Center | `/app/agents` | Beta | `GovernanceAgentsCenterView`; Registry `agent-governance` (preview) |
| Agent OS (Intent-Panel, Specialist Mesh, Chrome Side Panel) | nicht auf `/app/dashboard` gemountet | Geplant / Preview im Tree | Registry `agent-os-*` |
| Herkunftsnachweis (C2PA, Ed25519) | `/app/provenance` | Live laut Registry (Messung 08/2026) | Edge `provenance`, `c2pa-manifest-generate` |
| API-Keys, Webhooks | `/app/governance/api-keys`, `/app/webhooks` | Live; `webhooks.enabled` inzwischen serverseitig geprüft | Edge `governance-webhooks` |
| Team / Einladungen / Rollen | `/tenant/invites`, `/app/team` | Live; Sitzplatz-Limit ungeprüft | `claims-reality-audit.md` §1.1 |
| DSGVO-Export/-Löschung des eigenen Kontos | `/settings/account` | Live | Edge `gdpr-export`, `gdpr-delete` |
| KI-Datenresidenz `cloud`/`eu_local` | `/settings/ai-residency` | Teilweise / unbelegt (UI + Routing-Code; EU-lokaler Host zuletzt 05/2026 validiert) | `AiResidencySettings.tsx`; runtime-status-matrix |
| Beta-Feedback aus der App + Admin-Ansicht | App, `/admin/beta-feedback` | Live (seit #1989; Registry noch nicht nachgezogen) | PR #1989 |

### 5.3 Kanäle, Automationen, Assistenten

| Funktion | Route/Ort | Status | Beleg |
|---|---|---|---|
| Website-Chatbot | `/chatbot/start` → `/app/bots` | Beta (Registry `channel-bots` preview; Backend `bot-chat` mit Gate) | `implementation-status.ts` |
| WhatsApp-Bot | `/app/bots/whatsapp` | Beta; Meta-Secrets/Prod-Deploy laut Matrix 08/2026 offen → **unbelegt** | Edge `whatsapp-webhook`; `capability-matrix.md` §3.2 |
| Telegram-Bot | Bot-Konfiguration | Beta | Edge `telegram-webhook` |
| Telefon/Voice-Agent | `/phonebot/start`, `/app/voice` | Geplant – `/app/voice` zeigt nur Leerzustand „Geplant“; kein Provider, Deploy-Pfad fehlgeschlagen | Registry `voice-telephony` |
| Terminbuchung über Bot | Edge `appointment-book` | Teilweise: Plan-Gate da, aber **keine Slot-/Verfügbarkeitsprüfung** (`availability_rules` wird nicht gelesen) | `reality-matrix.md` §2; grep `appointment-book` |
| Human Handoff | – | Geplant (kein Mechanismus im Repo) | `entitlement-reality-map.md` |
| Automations / n8n | `/app/automations`, `/workflows` | Beta ohne produktive Ausführung | Registry `automation-n8n` |
| Kodee (VPS-Assistent) | `/kodee` | Beta (Chat alle Pläne, SSH-Aktionen ab Agency, serverseitig geprüft) | Registry `kodee` |
| AI Gateway (protokollierte Modellaufrufe, Kosten) | Edge `ai-gateway`/`ai-invoke`; Seite `/claude-code-optimizer` | Live; Evidence-Kette siehe 5.2 | `platform-capabilities.ts#ai-gateway` |

### 5.4 SiteOS / Website-Builder

| Funktion | Route/Ort | Status | Beleg |
|---|---|---|---|
| Transformation nach Audit: Blueprint + Preview | `/unified-entry/transformation` | Beta | `SiteOsBuilderPage`; README §SiteOS |
| Builder-Workspace (Puck-Editor) | `/builder/:slug` | Beta | `src/features/siteos/editor/puckConfig.tsx`; CLAUDE.md |
| Build Studio (App Builder + Frontend Designer) | `/build` | Beta (Registry preview; Plan-Gate `siteos.builder`/`limit.sites`) | Registry `web-builder` |
| Publish: Gate → Cloudflare-Vorschau → Produktion mit Owner/Admin-Freigabe | Edge `siteos` (`publish-gate`, `publish-preview`, `publish-production`) | Teilweise: gebaut; eigene Domain, DNS, Rollback fehlen. reality-matrix (08/2026) „fehlt“ ist überholt | Handler-Verzeichnis; Registry `web-builder` |
| Eigene Kundendomain | `/app/websites` | Beta (Cloudflare-Provisioning Preview) | Registry `tenant-custom-domain` |
| Frontend-Modernisierung | `/app/siteos/modernize` | Beta, nur Enterprise | Registry `frontend-modernize-wizard` |

### 5.5 Billing und Pläne

| Funktion | Route/Ort | Status | Beleg |
|---|---|---|---|
| Stripe-Checkout monatlich Starter 79 € / Growth 249 € / Agency 699 € | `/checkout/:planKey`, `/pricing` | Live (Self-Service); auf `/` aktuell überlagert durch Beta-Angebot | `shared/pricing.ts`; Registry `stripe-checkout-e2e` |
| Governance Launch 349 € | Checkout | Live laut SSoT (`self_service`) | `shared/pricing.ts` |
| Enterprise 1.498 € netto | `/checkout/enterprise` (über `checkoutHrefForPlan`); `/contact-sales` bleibt Kontaktweg | Self-Service laut SSoT seit 29.10.2026, ohne Testphase; produktiv nicht verifiziert | `shared/pricing.ts` (`ENTERPRISE_CHECKOUT_PRICE_WIRED`); Migration `20261029150300_enterprise_live_price_1498.sql` |
| Partner 1.999 € | – | Legacy, kein Neukundenangebot | `shared/pricing.ts` (`availability: legacy`) |
| Jahresabrechnung | – | Geplant (Stripe nicht verdrahtet) | Registry `pricing-yearly` |
| Offene Beta: Growth-Umfang bis 31.01.2027 | `/welcome?beta=1` | Live (`beta-enroll` serverseitig). Ablauf automatisch: `beta-enroll` speichert `BETA_ENDS_AT` als `trial_end`/`trial_ends_at`, `tenant_entitlements_resolve()` wertet abgelaufene Trials nicht mehr (Migration `20260928160000_wp2a_trial_end_expiry.sql`). Nur das Frontend-Label in `src/config/beta.ts` ist reiner Anzeigetext | `supabase/functions/beta-enroll/logic.ts`; `src/config/beta.ts`; Registry `beta-phase` |
| Usage-Ansicht | `/billing/usage` | Live | `src/App.tsx` |
| Enterprise-SSO (SAML/OIDC) | – | Geplant (0 Provider, ADR 0007) | Registry `enterprise-sso` |

### 5.6 Bekannte Mock-/Demo-Flächen

| Fläche | Route | Befund |
|---|---|---|
| Enterprise AI OS Dashboard | `/dashboard/enterprise-ai-os` | öffentlich erreichbar, importiert `mockAiSystems`, `mockAuditEvents`, `mockConnectors` (Masterplan I-3); Hinweis „Beispieldaten“ und KPI-Hints „Beispielwert“ vorhanden |
| Demo-Strecken | `/demo-*`, `/demo-tour/*` | Demo-Daten |
| Control Room auf der Landing | `/` | Demo-Daten, gekennzeichnet |
| Governance Sphere | Komponente | als DEMO/SIMULATED markiert, nicht auf `/` |

### 5.7 Wo die Quellen sich widersprechen

- **Bots/Telefonie:** `platform-capabilities.ts` (08/2026) führt „Bot-Laufzeit – Chat, WhatsApp, Telefon“ als `live`; `implementation-status.ts` (10/2026) führt Chat/WhatsApp/Telegram als Preview und Telefonie als coming-soon. Der neuere Stand gilt.
- **Agency-Plan:** `capability-matrix.md` §5.1 (AP2) nennt Agency „Legacy“; `shared/pricing.ts` führt Agency als `self_service` und Landing v6 verkauft ihn. Der Code gilt.
- **Publishing:** reality-matrix (08/2026) „fehlt“, heute existieren Publish-Handler (Preview).
- **Deploy:** README „Hostinger-VPS/Traefik“ vs. Cloudflare Pages (CLAUDE.md, reality-matrix).
- **EU-lokale Inferenz:** runtime-status-matrix (05/2026) 🟢 „produktiv“; spätere Belege fehlen, Router-Doku nennt andere Standardmodelle als die README.
- **Masterplan P0-3/P0-4** als offen beschrieben (26.10.), im Code seit #2015 umgesetzt; ob in Produktion wirksam: unbelegt.
- **Beta-Feedback:** Registry nennt es offen, PR #1989 hat es gebaut.
- **Routenzahl:** Masterplan 517/92, reality-matrix 468, heute 518/92.

---

## 6. Lücken zwischen Marketing-Claims und Realität

1. **„Kontinuierliches Monitoring“ ist das Kernversprechen, läuft aber nicht.** Code und Plan-Gate existieren, die Cron-Functions scheiterten bis mindestens 26.10.2026 mit HTTP 500; E-Mail-Alerts haben keinen Cron-Job. Für zahlende Kunden findet heute keine dauerhafte Überwachung statt.
2. **Evidence-Nordstern ohne Daten:** 0 `ai_evidence_events` und 0 `usage_events` in 30 Tagen. Der Code für Evidence pro KI-Call ist erst seit #2015 da; ein Ende-zu-Ende-Nachweis in Produktion fehlt.
3. **Kontingente auf der Preisseite ohne Prüfpunkt:** Team-Sitze, Domains, Bots, Compliance-Exporte, LLM-Queries, Evidence-Speicher, API-Calls sind je Plan vergeben, werden aber nirgends durchgesetzt (Stand 08/2026; seitdem nicht neu gemessen). Der globale Riegel `hard_limit` ist überall leer.
4. **NIS2 / ISO 27001 / TISAX / DORA:** Es gibt Control-Kataloge, aber kein geführtes Assessment (nur AI Act). Zulässig ist „Control-Katalog vorhanden“, nicht „NIS2-konform“ oder „ISO-zertifiziert“. TISAX/DORA sind Roadmap.
5. **Bots als „live“ beworben (alte Registry), tatsächlich Preview;** Telefonie geplant; Terminbuchung ohne Slot-Engine (Bot kann nur freie Zeiten annehmen, nicht prüfen); Human Handoff existiert nicht.
6. **AI-Act-Klassifikation** ist regelbasiert und **keine** rechtsverbindliche Einstufung; Speichern ins Inventar ist für keinen Plan freigeschaltet.
7. **Mock-Dashboard öffentlich erreichbar** (`/dashboard/enterprise-ai-os`): inzwischen als „Beispieldaten“ gekennzeichnet (nur „Recent Agent Runs“ echt), wirkt aber neben dem echten `/app/dashboard` wie ein zweites Produkt (Masterplan M8: kennzeichnen oder umstellen).
8. **Keine externe Validierung:** kein Pentest, kein SOC 2/ISO 27001, keine externe AI-Act-Konformitätsbewertung; Security-Header-Deploy war 05/2026 offen. Verbotene Formulierungen: „garantiert DSGVO-Compliance“, „AI-Act-zertifiziert“, „ersetzt den DSB“, „autonome Compliance“.
9. **Preisquellen-Drift:** ~~Enterprise 1.249 € vs. 1.498 €~~ aufgelöst am 30.10.2026 (SSoT 1.498 €); offen: Voice/WhatsApp mit zwei Preisen (Add-on vs. Modul); Modulpreise `provisional`.
10. **Betriebsrisiko:** Supabase-Plan laut 08/2026 ohne Backup/PITR/SLA – kritisch für ein Produkt, das Hash-Ketten als Nachweis verkauft (aktueller Stand unbelegt).

---

## 7. Quellen

- `CLAUDE.md`
- `README.md`
- `ROADMAP.md`
- `docs/strategy/MASTERPLAN_2026-2027.md`
- `docs/product/reality-matrix.md`
- `docs/product/implementation-status.md`
- `docs/product/claims-reality-audit.md`
- `docs/product/capability-matrix.md`
- `docs/product/entitlement-reality-map.md`
- `docs/runtime-status-matrix.md`
- `src/product/implementation-status.ts`
- `src/config/platform-capabilities.ts`
- `src/config/beta.ts`
- `shared/pricing.ts`
- `src/App.tsx`
- `src/pages/EnterpriseAiOsDashboard.tsx`
- Gezielte Greps: `supabase/functions/governance-approvals/index.ts`, `supabase/functions/ai-gateway/handler.ts`, `supabase/functions/appointment-book/index.ts`, `supabase/functions/governance-webhooks/index.ts`, `supabase/functions/siteos/handlers/`
- Git-Historie `main` bis `c9a7da6` (PRs #1989, #2006, #2011, #2015)
