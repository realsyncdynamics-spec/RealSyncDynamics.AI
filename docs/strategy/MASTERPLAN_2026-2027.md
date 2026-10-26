# Masterplan RealSyncDynamicsAI: Umsetzung, Skalierung, Monetarisierung

Stand: 26.10.2026 · Grundlage: Repo-Analyse (`src/App.tsx`, `shared/pricing.ts`, `src/config/beta.ts`,
`.claude/os-funnel/PLAN.md` + `OKTOBER-2026.md`, `docs/claude/BETA_V5_WORKPLAN.md`, `docs/PRODUCT_PRIORITIZATION.md`)

---

## Kontext

Dieser Masterplan bündelt Gesamtziel, Ist-Stand, Must-haves, Verbesserungen und nächsten
Schritten, aufgeteilt nach Onboarding, Dashboard, Agenten, Builder, DSGVO/AI Act und Monetarisierung.

**Kernbefund:** Das Produkt ist **breit, aber nicht tief**. Technisch steht viel: Stripe ist verdrahtet,
Entitlements werden serverseitig durchgesetzt, ein großes DSGVO-/AI-Act-Toolset existiert, der Publish-Gate läuft
serverseitig. Ein Kunde findet aber keinen klaren Weg durch das Produkt:

- ca. **527 Routen**, **5 Landing-Versionen** plus `/os` und `/aetheros`
- **ca. 12 Dashboard-artige Seiten**, **6 Agenten-Oberflächen** mit unterschiedlichen Datenquellen
- **6+ Onboarding-Einstiege** und kein kanonischer Pfad nach der Registrierung
- Das zentrale Versprechen „jeder KI-Call wird geloggt“ hat eine Lücke: `ai-gateway/handler.ts` bucht für
  angemeldete Aufrufe nur `usage_events` (Tokens, Feature). Ein Evidence-Eintrag mit Policy-Entscheid und
  Hash-Kette entsteht nur auf dem anonymen Audit-Pfad (`anon_chat_runs`).

**Die Beta endet am 31.01.2027.** Bis dahin muss aus „kostenlos testen“ zahlende Nutzung werden. Daraus folgt
die Leitlinie des Plans: **ein Weg, ein Dashboard, ein Agenten-Register, eine Beweiskette**. Erst danach skalieren.

---

## 1. Gesamtziel (Nordstern)

**Positionierung (unverändert, entschieden K2):** EU-souveräne AI-Governance-Runtime für regulierte KMU
(5–500 MA: Kanzleien, Arztpraxen, FinTech, Verwaltung, Agenturen als Multiplikator). Kein Chatbot.

**Nordstern-Metrik:** *Anzahl Organisationen mit aktivem Evidence-Nachweis pro Monat*, also Kunden, deren KI-Nutzung
nachweisbar protokolliert, klassifiziert und freigegeben ist. Daran hängen Umsatz und Bindung.

**Ziele (Vorschlag, vom Owner festzulegen):**

| Zeitpunkt | Ziel |
|---|---|
| 31.12.2026 | 1 kanonischer Funnel live, 100 aktive Beta-Workspaces, Time-to-First-Evidence < 15 min |
| 31.01.2027 (Beta-Ende) | ≥ 15 % Beta → Paid, 10 Pilotkunden mit Referenzfreigabe |
| 30.06.2027 | 10–15 k € MRR, 5 Partnerkanzleien/Agenturen aktiv, Enterprise-Pipeline ≥ 5 Deals |
| 31.12.2027 | 40–60 k € MRR, Partnerkanal ≥ 30 % Neukunden |

---

## 2. Ist-Stand: Was haben wir?

| Bereich | Vorhanden (real) | Mock / Preview / Lücke |
|---|---|---|
| **Onboarding** | `/audit` (echter `gdpr-audit` Scan) → `/onboarding/:scanId`; `Welcome.tsx` → `/setup-assistant` → `/app/dashboard`; `/unified-entry/*` mit `save-company-profile`; `/app/activation` persistiert in `governance_activations` | 6+ parallele Flows; `src/unified-entry/mock-data.ts` noch im Einsatz; Activation-KPIs sind Platzhalter; Blueprint/Expert-Review „Preview“ |
| **Dashboard** | `/app/dashboard` → `CommandCenterDashboard` mit echten RPCs (`governance_kpi_*`, `governance_24h_summary`), `CustomerStartPanel`, Beispiel-Workspace `/app/beispiel` | ca. 12 konkurrierende Dashboards (`/app/intelligence`, `/app/cockpit`, `/app/mein-geschaeft`, `/dashboard/enterprise-ai-os` mit Mock …); `/admin/*` und `/dashboard/*` ohne Router-Guard |
| **Agenten** | Register `/app/ai-systems/agents` mit ehrlichem Status (22 live / 17 preview / 11 coming-soon aus `implementation-status.ts`); echte Runs `/app/agents` über `enterprise-ai-os-agents-run`; Bots-CRUD `/app/bots/*`; Approvals `governance_approvals` | 6 Oberflächen, 5 Datenquellen (`agent_*`, `autonomous_agents`, `bots`, Katalog, Demo); kein Freigabeschritt bei Agenten-Registrierung; `AgentsView.tsx` toter Code; öffentliche `/agents` komplett `demo` |
| **Builder** | `/build` (Studio, siteos-core), `/builder/:slug` (Puck → `siteos/edit`), `/builder/:slug/code` (Code-Builder), Publish-Gate serverseitig, Entitlement `siteos.publish` | Publish-Rollback fehlt; Domain/DNS Preview; O-WP6 Governance-Kette (Publish → Approval → Evidence) **0 PRs** |
| **DSGVO / AI Act** | AI-Act-Klassifizierer, DSFA-, VVT-, TOM-, AVV-, Datenschutz-Generator, Cookie-Scanner, Meldepflicht-Timer, Evidence Vault + Export + Anchor, DSR, Risk-Score, Audit-PDF; versionierter Cookie-Consent; alle Rechtsseiten | **Per-Call-Evidence für AI-Gateway unvollständig**; `eu_local` nicht als expliziter Routing-Key; DORA/TISAX „coming soon“ |
| **Monetarisierung** | SSoT `shared/pricing.ts` (Free, Starter 79 €, Growth 249 €, Agency 699 €, Enterprise 1.249 €, Partner 1.999 €, Governance Launch 349 € einmalig, Add-ons); Stripe Checkout/Portal/Webhook/Meter; Entitlements in ca. 45 Functions | Jahrespreise bewusst nicht kaufbar (Owner-Entscheid); Credits (WP-5) nicht gestartet; Beta-`trial_end` verbraucht späteren 14-Tage-Trial; Erinnerungsmail 14 Tage vor Beta-Ende offen; Trial-Expiry-Migration (E-O4) auf Prod offen |
| **Marketing / Growth** | First-Party-Analytics nach Consent (`track.ts`, `marketingAnalytics.ts`), SEO-SSoT `src/config/seo.ts`, Sitemap (109 URLs), `llms.txt`, Newsletter mit Double-Opt-in, Sales-Lead-Function, ca. 29 Branchen-Landings, Tools-Seiten | Blog dünn (9 statische Links, kein Content-Hub); keine Nurture-Sequenzen; keine Referenzen/Case Studies |
| **Infra / Betrieb** | 38 CI-Workflows inkl. Drift-Guards (Entitlement, Migration, Pricing, Fabrication), Cloudflare Pages, Security-Härtung (SSRF, Residency fail-closed) | 3 Cron-Functions antworten 401 (Function-Secret ≠ Vault); Hostinger-VPS-Workflows vermutlich Altlast |

---

## 3. Must-haves (P0, vor Beta-Ende 31.01.2027 Pflicht)

1. **M1 Ein kanonischer Onboarding-Pfad.** `Scan (/audit) → Registrierung (/welcome) → Workspace + Firmenprofil
   → Activation (KI-Systeme erfassen) → Command Center`. Alle anderen Einstiege leiten per `Navigate` dorthin.
   Ziel: erstes Evidence-Item in unter 15 Minuten.
2. **M2 Ein Dashboard.** `/app/dashboard` (Command Center) ist das einzige Kunden-Dashboard. Die übrigen werden zu
   Tabs/Modulen darin oder per Redirect stillgelegt. Mock-Dashboards (`EnterpriseAiOsDashboard`, `mock-data.ts`) entfernen.
3. **M3 Lückenlose KI-Call-Evidence.** Jeder authentifizierte `ai-gateway`/`ai-invoke`-Call erzeugt einen
   Evidence-Eintrag (Tenant, Modell, Provider-Region, Zweck, Token, Policy-Entscheid). Ziel ist die bestehende
   Tabelle `ai_evidence_events`: append-only, Hash-Kette per DB-Trigger (`prev_hash`/`event_hash`/`chain_index`),
   bereits von `evidence-vault-export` und `evidence-anchor` gelesen — **keine Migration nötig**.
   Das ist das Produktversprechen, ohne das der Rest nicht trägt.
4. **M4 Governance-Kette O-WP6.** Publish-/Agenten-Request → Approval (`governance_approvals`) → Evidence, mit
   Ablehnungstest. Dazu Publish-Rollback (O-WP9).
5. **M5 Ein Agenten-Register mit Lebenszyklus.** `Erfassen → Klassifizieren (AI Act) → Freigeben → Ausführen → Nachweisen`.
   Eine Datenquelle, `/app/ai-systems/agents` als einzige Oberfläche, `/app/agents` und `/app/bots` als Ausführungs-Tabs.
6. **M6 Beta → Paid sauber.** Trial-Expiry-Migration auf Prod (E-O4), Kollision Beta-`trial_end` vs. Stripe-Trial
   beheben, Erinnerungsmails T-14/T-3/T-0, Upgrade-Flow im Dashboard, Daten bleiben nach Ablauf lesbar (Downgrade auf Free statt Sperre).
7. **M7 Sicherheit/Betrieb.** Router-Guard für `/admin/*` und `/dashboard/*`, Cron-401 fixen, Monitoring/Alerting für
   Stripe-Webhook und ai-gateway.
8. **M8 Ehrlichkeit.** Keine Demo-Agenten als Produkt, öffentliche `/agents` auf echten Status aus
   `implementation-status.ts` umstellen. `check:fabrication` und `check:landing-claims` grün halten.

---

## 4. Was ich verbessern würde (P1)

**Produkt / UX**
- **Routen-Diät:** von ca. 527 auf etwa 150 aktive Routen. Alte Landings (v2/v4/v5/v7, `/os`, `/aetheros`) bleiben unter
  `/design/*`, sind `noindex` und raus aus Sitemap und Bundle (lazy).
- **Command Center als „Compliance-Ampel“:** 3 Kennzahlen (KI-Systeme erfasst, Risiko klassifiziert, Nachweise
  vollständig) plus „Nächster Schritt“-Karte. Fortschrittsbalken „AI-Act-Readiness in %“ als Bindungsmechanik.
- **Compliance-Pack in 1 Tag:** DSFA, VVT, TOM, AVV und Datenschutzerklärung als geführter Bundle-Wizard, der aus dem
  Firmenprofil vorbefüllt. Ergebnis ist ein exportierbarer Audit-Ordner (PDF + Evidence-Hash). Das ist der stärkste Kaufgrund für KMU.
- **AI-Kompetenz-Nachweis (Art. 4 AI Act):** Schulungs-/Bestätigungsmodul für Mitarbeitende. Gilt seit Feb. 2025,
  ist leicht zu bauen und für jedes Unternehmen relevant.
- **Builder fokussieren:** Der SiteOS-Builder wird als „DSGVO-konforme Website“ verkauft (Cookie-, Impressum-, Datenschutz-
  Checks eingebaut). Den Code-Builder bis nach Q1 2027 nicht weiter ausbauen.

**Technik**
- Lazy Loading aller `/app`- und Design-Routen, Lighthouse-Budget in CI.
- `eu_local` als expliziter Residency-Modus im Router (Ollama/LM Studio), im Dashboard sichtbar.
- Hostinger-Altlast-Workflows archivieren, toten Code (`AgentsView.tsx`, Mock-Daten) entfernen.

**Marketing**
- **Content-Hub statt Blog:** MDX-Ratgeber zu AI-Act-Pflichten, DSGVO + KI, Branchen-Guides (Kanzlei, Praxis, FinTech).
  Jeder Artikel endet mit dem kostenlosen Scan als CTA.
- **Case Studies** aus den 10 Pilotkunden (Vorher/Nachher, Zeitersparnis, Audit bestanden).
- **E-Mail-Nurture** nach Scan: 5 Mails über 14 Tage (Befund → Risiko → Lösung → Social Proof → Angebot).

---

## 5. Monetarisierung

**Preisleiter (SSoT `shared/pricing.ts`, keine neuen Preise ohne Owner-Freigabe):**

| Stufe | Rolle im Funnel |
|---|---|
| Free + kostenloser Scan | Lead-Magnet, zeigt Risiken, kein Nachweis-Export |
| **Governance Launch 349 € einmalig** | bezahlter Einstieg: Compliance-Pack + Erstbefund, wird bei Abo-Abschluss angerechnet (Vorschlag) |
| **Starter 79 €/Monat** | 1 Organisation, KI-Register, Basis-Evidence |
| **Growth 249 €/Monat** | Kernplan: Agenten-Freigaben, Evidence-Export, Builder-Publish, mehrere Nutzer |
| **Agency 699 €/Monat** | Multi-Mandant, White-Label (Add-on), Skalierungshebel über Agenturen |
| **Enterprise ab 1.249 €** / Partner 1.999 € | SSO, eu_local/On-Prem, SLA, Partner-Revenue-Share |

**Hebel**
1. **Beta-Conversion:** Beta-Nutzer bekommen beim Upgrade vor dem 31.01. einen Gründerpreis (z. B. 12 Monate Preisgarantie).
   Muss der Owner freigeben.
2. **Nutzungsbasiert (WP-5 Credits):** `credit_rates`, Budget-Check, Ledger, Stripe-Meter (`stripe-meter-sync` existiert).
   Agenten-Runs und KI-Calls über dem Kontingent werden abgerechnet.
3. **Upsell-Trigger im Produkt:** Limit erreicht (`limit.ai_calls_monthly`, `limit.sites`), Hinweis „Evidence-Export ab
   Growth“. Läuft über die vorhandenen `planAccess.ts`/`useModuleAccess.ts`.
4. **Partnerkanal:** 5–10 Datenschutz-/IT-Rechtskanzleien (`docs/partner-kanzlei-outreach.md`) mit 20–30 % Revenue-Share.
   Kanzleien bringen Vertrauen, wir liefern die Technik.
5. **Add-ons:** Compliance-Pack, White-Label, WhatsApp/Voice-Bots (erst wenn aus „Preview“ raus).
6. **Jahrespreise:** aktivieren, sobald Stripe-Preise angelegt sind. Das ist eine Owner-Entscheidung, bringt aber
   Cashflow und weniger Kündigungen.

---

## 6. Skalierung (Go-to-Market)

**Motor:** Product-led mit Partner-Beschleuniger.

```
SEO/Content + LinkedIn + Partner ─► Kostenloser Scan (/audit) ─► Befund-Report per Mail
   ─► Registrierung ─► Activation (<15 min) ─► Command Center ─► Trial/Beta ─► Paid ─► Expansion (Credits, Agency)
```

| Kanal | Maßnahme | Ziel-KPI |
|---|---|---|
| SEO | Content-Hub, Tools-Seiten (Cookie-Scanner, AI-Act-Klassifizierer) als Einstieg | 5.000 organische Besuche/Monat bis Q2 2027 |
| LinkedIn (Gründer-Brand) | 3 Posts/Woche: AI-Act-Fristen, Befunde aus anonymisierten Scans | 50 Scans/Monat aus Social |
| Partner | Kanzleien + Agenturen (Agency-Plan) | 30 % Neukunden über Partner bis Ende 2027 |
| Webinare | monatlich „AI Act für [Branche] in 45 Min“ | 20 % Teilnehmer → Scan |
| E-Mail | Nurture nach Scan, Newsletter (Double-Opt-in vorhanden) | 10 % Scan → Registrierung |

**Funnel-KPIs (in `marketingAnalytics.ts` instrumentieren):** Besuch → Scan (Ziel 5 %), Scan → Registrierung (25 %),
Registrierung → Activation abgeschlossen (60 %), Activation → Paid (15 %), Netto-Umsatzbindung > 100 %.

**Technische Skalierung:** Supabase EU und Cloudflare reichen bis in den niedrigen fünfstelligen Nutzerbereich.
Engpässe sind ai-gateway-Kosten (Quoten und Credits) und Cron-Zuverlässigkeit. `services/realsync-runtime-core`
nur für Enterprise/On-Prem aktivieren, keine dritte Laufzeit für KMU.

---

## 7. Roadmap (Phasen)

| Phase | Zeitraum | Inhalt | Ergebnis |
|---|---|---|---|
| **0 Stabilisieren** | KW 44–45 (bis 08.11.) | M7 (Guards, Cron-401), E-O4 Migration, M3 Evidence pro KI-Call, toten Code und Mocks entfernen | Basis ehrlich und sicher |
| **1 Ein Weg** | KW 46–48 (bis 29.11.) | M1 Onboarding, M2 Dashboard, M5 Agenten-Register, Routen-Diät | Neuer Nutzer kommt ohne Hilfe zum ersten Nachweis |
| **2 Governance-Kette + Conversion** | KW 49–51 (bis 20.12.) | M4 O-WP6 + Rollback, M6 Beta → Paid, Upgrade-Flow, Erinnerungsmails, Compliance-Pack-Wizard | Zahlbar, nachweisbar, verkaufbar |
| **3 Beta-Abschluss** | 01.01.–31.01.2027 | Gründerpreis-Kampagne, 10 Pilot-Case-Studies, Content-Hub Start, Partner-Onboarding | ≥ 15 % Beta → Paid |
| **4 Skalieren** | Q1–Q2 2027 | WP-5 Credits, Agency/White-Label, Partnerprogramm, Art.-4-Schulungsmodul, Jahrespreise | 10–15 k € MRR |
| **5 Enterprise** | Q3–Q4 2027 | SSO/SCIM (ADR 0007), eu_local/On-Prem, DORA/TISAX-Packs, ISO 42001 | Enterprise-Deals |

Arbeitsweise bleibt wie gehabt: **ein WP pro Session und PR**, Merge, Migration, Preise und Rechtstexte nur mit separater Owner-Freigabe.

---

## 8. Offene Owner-Entscheidungen (blockieren Umsetzung)

- **E-O4:** Trial-Expiry-Migration auf Produktion anwenden
- Gründerpreis / Beta-Konditionen ab 01.02.2027
- Jahrespreise in Stripe anlegen
- **E-F4** Partner 1.999 €, **E-F5** `/unified-entry/scan` vs. `/audit` als kanonischer Scan-Einstieg (Empfehlung: `/audit`)
- **E-V5–E-V9** (eu_local, On-Prem/SCIM, SSO), **E-R1–E-R5** (Responsive WP8)
- Welche Dashboards und Landings endgültig stillgelegt werden (Empfehlung siehe M2 und Routen-Diät)
- **M3-Fehlerverhalten:** Evidence-Schreibfehler fail-open (Antwort geht raus, Fehler wird geloggt) oder fail-closed
  (Call scheitert ohne Nachweis). Empfehlung: fail-open plus Alerting, fail-closed ab Enterprise

---

## 9. Nächste Schritte

1. Owner entscheidet die Punkte aus §8 (mindestens E-O4, Gründerpreis, E-F5).
2. Phase 0 und 1 laufen als einzelne Arbeitsaufträge, je eine Session und ein PR:
   - `.claude/commands/wp9-evidence-per-call.md` (M3)
   - `.claude/commands/wp10-canonical-onboarding.md` (M1)
   - `.claude/commands/wp11-one-dashboard.md` (M2, M7-Guards)
   - `.claude/commands/wp12-agent-lifecycle.md` (M5, M8)
3. Danach M4 (O-WP6 Governance-Kette) und M6 (Beta → Paid) als eigene WPs.

## Prüfregeln für jedes WP

- `npm run build`, `npm run lint`, betroffene Tests
- `npm run check:landing-claims`, `check:fabrication`, `check:entitlements`, `check:context`
- Fakten gegen die Quelle prüfen: Preise `shared/pricing.ts`, Beta `src/config/beta.ts`, Routen `src/App.tsx`,
  Status `src/product/implementation-status.ts`
