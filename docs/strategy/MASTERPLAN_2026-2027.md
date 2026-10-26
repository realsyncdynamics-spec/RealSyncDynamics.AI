# Masterplan RealSync Dynamics AI 2026–2027: Umsetzung, Skalierung, Monetarisierung

Stand: 26.10.2026 (Rev. 2) · Grundlage: Repo-Analyse (`src/App.tsx`, `shared/pricing.ts`, `src/config/beta.ts`,
`.claude/os-funnel/PLAN.md` + `OKTOBER-2026.md`, `docs/claude/BETA_V5_WORKPLAN.md`, `docs/PRODUCT_PRIORITIZATION.md`)
sowie Rechtsstand AI Act nach Digital Omnibus (VO (EU) 2026/1744)

> **Änderungen ggü. Rev. 1:** neuer Abschnitt 0 (Annahmen, Kapazität, Ausgangswerte), neuer Abschnitt 2a
> (Rechtsrahmen nach Omnibus), M3 als erste Aufgabe in Phase 0, Streichreihenfolge bei Kapazitätsengpass,
> Owner-Entscheidungen mit Deadlines, Marketing-Anlässe Dezember 2026 ergänzt.

---

## Kontext

Der Owner wollte einen vollständigen Masterplan: Gesamtziel, Ist-Stand, Must-haves, Verbesserungen und nächste
Schritte, aufgeteilt nach Onboarding, Dashboard, Agenten, Builder, DSGVO/AI Act und Monetarisierung.

**Kernbefund:** Das Produkt ist **breit, aber nicht tief**. Technisch steht viel: Stripe ist verdrahtet,
Entitlements werden serverseitig durchgesetzt, ein großes DSGVO-/AI-Act-Toolset existiert, der Publish-Gate läuft
serverseitig. Ein Kunde findet aber keinen klaren Weg durch das Produkt:

- ca. **527 Routen**, **5 Landing-Versionen** plus `/os` und `/aetheros`
- **ca. 12 Dashboard-artige Seiten**, **6 Agenten-Oberflächen** mit unterschiedlichen Datenquellen
- **6+ Onboarding-Einstiege** und kein kanonischer Pfad nach der Registrierung
- Das zentrale Versprechen „jeder KI-Call wird geloggt“ hat eine Lücke: `ai-gateway` schreibt ein fail-closed
  Audit-Log (`anon_chat_runs`) nur für den anonymen Pfad. Authentifizierte Calls buchen lediglich `usage_events`
  (best-effort, ein Fehler wird nur geloggt). Ein Evidence-Eintrag pro authentifiziertem Call fehlt.

**Die Beta endet am 31.01.2027.** Bis dahin muss aus „kostenlos testen“ zahlende Nutzung werden. Daraus folgt
die Leitlinie des Plans: **ein Weg, ein Dashboard, ein Agenten-Register, eine Beweiskette**. Erst danach skalieren.

---

## 0. Annahmen, Kapazität, Ausgangswerte

Der Plan wird von einem Solo-Gründer neben einer Anstellung im Schichtdienst umgesetzt. Kapazität ist deshalb
der eigentliche Engpass, nicht Technik. Alle Zeiträume in Abschnitt 8 gelten nur unter der hier eingetragenen Annahme.

| Annahme | Wert |
|---|---|
| Verfügbare Entwicklungsstunden pro Woche | ‹eintragen› |
| Davon Marketing/Vertrieb | ‹eintragen› |
| Arbeitsweise | 1 WP pro Claude-Code-Session und PR, Owner reviewt und merged |

**Ausgangswerte (Stand 26.10.2026, vom Owner einzutragen):**

| Kennzahl | Heute | Ziel 31.12.2026 |
|---|---|---|
| Aktive Beta-Workspaces (Login in letzten 30 Tagen) | ‹eintragen› | 100 |
| Scans pro Monat (`/audit`) | ‹eintragen› | ‹eintragen› |
| Registrierungen pro Monat | ‹eintragen› | ‹eintragen› |
| Zahlende Kunden / MRR | ‹eintragen› | ‹eintragen› |
| Time-to-First-Evidence | nicht gemessen | < 15 min |

Ohne diese Werte lassen sich die Ziele in Abschnitt 1 nicht als realistisch oder unrealistisch einordnen.
Messen beginnt in Phase 0 (Event-Instrumentierung in `src/lib/marketingAnalytics.ts`).

**Streichreihenfolge bei Kapazitätsengpass** (von oben nach unten wird zuerst verschoben):

1. P1-Verbesserungen (Abschnitt 4) außer Compliance-Pack
2. M5 Agenten-Register-Lebenszyklus (auf Q1 2027)
3. Routen-Diät über Redirects hinaus (Löschen statt Umleiten)
4. M4 Publish-Rollback (Approval-Kette bleibt)
5. **Nie gestrichen:** M3 Evidence pro KI-Call, M6 Beta → Paid, M7 Sicherheit, M8 Ehrlichkeit

---

## 1. Gesamtziel (Nordstern)

**Positionierung (unverändert, entschieden K2):** EU-souveräne AI-Governance-Runtime für regulierte KMU
(5–500 MA: Kanzleien, Arztpraxen, FinTech, Verwaltung, Agenturen als Multiplikator). Kein Chatbot.

**Nordstern-Metrik:** *Anzahl Organisationen mit aktivem Evidence-Nachweis pro Monat*, also Kunden, deren KI-Nutzung
nachweisbar protokolliert, klassifiziert und freigegeben ist. Daran hängen Umsatz und Bindung.

**Ziele (Vorschlag, vom Owner nach Eintrag der Ausgangswerte zu bestätigen):**

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
| **DSGVO / AI Act** | AI-Act-Klassifizierer, DSFA-, VVT-, TOM-, AVV-, Datenschutz-Generator, Cookie-Scanner, Meldepflicht-Timer, Evidence Vault + Export + Anchor, DSR, Risk-Score, Audit-PDF; versionierter Cookie-Consent; alle Rechtsseiten | **Per-Call-Evidence für AI-Gateway fehlt** (nur `usage_events`, best-effort); `eu_local` nicht als expliziter Routing-Key; DORA/TISAX „coming soon“; Fristen-Texte noch auf Stand vor Omnibus (ca. 20 Fundstellen „August 2026“ in `src/pages`, `src/components/landing`, `public/llms.txt`; siehe 2a) |
| **Monetarisierung** | SSoT `shared/pricing.ts` (Free, Starter 79 €, Growth 249 €, Agency 699 €, Enterprise 1.249 €, Partner 1.999 €, Governance Launch 349 € einmalig, Add-ons); Stripe Checkout/Portal/Webhook/Meter; Entitlements in ca. 45 Functions | Jahrespreise bewusst nicht kaufbar (Owner-Entscheid); Credits (WP-5) nicht gestartet; Beta-`trial_end` verbraucht späteren 14-Tage-Trial; Erinnerungsmail 14 Tage vor Beta-Ende offen; Trial-Expiry-Migration (E-O4) auf Prod offen |
| **Marketing / Growth** | First-Party-Analytics nach Consent (`track.ts`, `marketingAnalytics.ts`), SEO-SSoT `src/config/seo.ts`, Sitemap (109 URLs), `llms.txt`, Newsletter mit Double-Opt-in, Sales-Lead-Function, ca. 29 Branchen-Landings, Tools-Seiten | Blog dünn (9 statische Links, kein Content-Hub); keine Nurture-Sequenzen; keine Referenzen/Case Studies; Funnel-Ausgangswerte nicht gemessen |
| **Infra / Betrieb** | 38 CI-Workflows inkl. Drift-Guards (Entitlement, Migration, Pricing, Fabrication), Cloudflare Pages, Security-Härtung (SSRF, Residency fail-closed) | 3 Cron-Functions antworten 401 (Function-Secret ≠ Vault); Hostinger-VPS-Workflows vermutlich Altlast |

---

## 2a. Rechtsrahmen nach Digital Omnibus (VO (EU) 2026/1744)

Der Digital Omnibus on AI ist seit **27.07.2026** in Kraft. Er verändert die Fristen, auf denen Produkt-Texte,
Landings und Content aufbauen. Vor jeder Fristen-Aussage im Marketing gilt: Primärquelle ist der Text im Amtsblatt.

| Thema | Stand nach Omnibus | Folge für uns |
|---|---|---|
| **Art. 4 KI-Kompetenz** | Gilt weiter seit 02.02.2025 für Anbieter und Betreiber; neu formuliert: „ausreichendes Niveau“ fördern, rollenbezogen | Schulungsmodul bleibt sinnvoll; Messaging „Nachweis der Förderung“, nicht „garantiertes Niveau pro Person“ |
| **Hochrisiko Anhang III** | verschoben vom 02.08.2026 auf **02.12.2027** | Kein „Pflicht seit August 2026“ mehr in Texten; Story wird „Vorbereitung mit 13 Monaten Vorlauf“ |
| **Hochrisiko Anhang I** | verschoben vom 02.08.2027 auf **02.08.2028** | Enterprise/Produktsicherheit: längere Vertriebszyklen einplanen |
| **Art. 50 Transparenz** | gilt seit 02.08.2026; Bestandssysteme mit synthetischen Inhalten: Kennzeichnung nach Art. 50(2) bis **02.12.2026** | Konkreter, kurzfristiger Kaufanlass (siehe Abschnitt 7) |
| **Neue Verbote Art. 5** | gelten ab **02.12.2026** | Content-Anlass Dezember; Klassifizierer-Regeln prüfen |
| **KMU / Small Mid-Caps** | vereinfachtes QMS und technische Doku, Bußgeld-Deckel | Kernzielgruppe profitiert; im Produkt als „KMU-Modus“ abbilden |

**Pflicht-WP in Phase 0** (`.claude/commands/wp10-omnibus-fristen.md`): `check:landing-claims` um eine Fristen-Liste
erweitern und alle Fristen-Aussagen (Landings, `llms.txt`, Branchen-Seiten, AI-Act-Klassifizierer) auf den
Omnibus-Stand bringen. Für ein Compliance-Produkt sind veraltete Fristen ein direktes Glaubwürdigkeitsrisiko.

---

## 3. Must-haves (P0, vor Beta-Ende 31.01.2027 Pflicht)

Reihenfolge = Priorität.

1. **M3 Lückenlose KI-Call-Evidence (zuerst).** Jeder authentifizierte `ai-gateway`/`ai-invoke`-Call erzeugt einen
   Evidence-Eintrag (Tenant, Modell, Provider-Region, Zweck, Token, Policy-Entscheid, Hash-Kette über `packages/evidence-chain`).
   Das ist das Produktversprechen. Solange es fehlt, sind die Landing-Claims angreifbar. → `wp9-evidence-per-call.md`
2. **M7 Sicherheit/Betrieb.** Router-Guard für `/admin/*` und `/dashboard/*`, Cron-401 fixen, Monitoring/Alerting für
   Stripe-Webhook und ai-gateway.
3. **M8 Ehrlichkeit.** Keine Demo-Agenten als Produkt, öffentliche `/agents` auf echten Status aus
   `implementation-status.ts` umstellen, Fristen-Texte auf Omnibus-Stand (2a). `check:fabrication` und
   `check:landing-claims` grün halten. → `wp10-omnibus-fristen.md`
4. **M1 Ein kanonischer Onboarding-Pfad.** `Scan (/audit) → Registrierung (/welcome) → Workspace + Firmenprofil
   → Activation (KI-Systeme erfassen) → Command Center`. Alle anderen Einstiege leiten per `Navigate` dorthin.
   Ziel: erstes Evidence-Item in unter 15 Minuten, gemessen per Event. → `wp11-canonical-onboarding.md`
5. **M2 Ein Dashboard.** `/app/dashboard` (Command Center) ist das einzige Kunden-Dashboard. Die übrigen werden zu
   Tabs/Modulen darin oder per Redirect stillgelegt. Mock-Dashboards (`EnterpriseAiOsDashboard`, `mock-data.ts`) entfernen.
   → `wp12-one-dashboard.md`
6. **M6 Beta → Paid sauber.** Trial-Expiry-Migration auf Prod (E-O4), Kollision Beta-`trial_end` vs. Stripe-Trial
   beheben, Erinnerungsmails T-14 (17.01.)/T-3 (28.01.)/T-0 (31.01.), Upgrade-Flow im Dashboard, Daten bleiben nach
   Ablauf lesbar (Downgrade auf Free statt Sperre).
7. **M4 Governance-Kette O-WP6.** Publish-/Agenten-Request → Approval (`governance_approvals`) → Evidence, mit
   Ablehnungstest. Dazu Publish-Rollback (O-WP9).
8. **M5 Ein Agenten-Register mit Lebenszyklus.** `Erfassen → Klassifizieren (AI Act) → Freigeben → Ausführen → Nachweisen`.
   Eine Datenquelle, `/app/ai-systems/agents` als einzige Oberfläche, `/app/agents` und `/app/bots` als Ausführungs-Tabs.
   → `wp13-agent-lifecycle.md`

---

## 4. Was ich verbessern würde (P1)

**Produkt / UX**
- **Routen-Diät:** von ca. 527 auf etwa 150 aktive Routen. Alte Landings (v2/v4/v5/v7, `/os`, `/aetheros`) bleiben unter
  `/design/*`, sind `noindex` und raus aus Sitemap und Bundle (lazy).
- **Command Center als „Compliance-Ampel“:** 3 Kennzahlen (KI-Systeme erfasst, Risiko klassifiziert, Nachweise
  vollständig) plus „Nächster Schritt“-Karte. Fortschrittsbalken „AI-Act-Readiness in %“ als Bindungsmechanik,
  mit Countdown auf die jeweils relevante Frist (Art. 50: 02.12.2026, Anhang III: 02.12.2027).
- **Compliance-Pack in 1 Tag:** DSFA, VVT, TOM, AVV und Datenschutzerklärung als geführter Bundle-Wizard, der aus dem
  Firmenprofil vorbefüllt. Ergebnis ist ein exportierbarer Audit-Ordner (PDF + Evidence-Hash). Das ist der stärkste Kaufgrund für KMU.
- **AI-Kompetenz-Nachweis (Art. 4 AI Act):** Schulungs-/Bestätigungsmodul für Mitarbeitende, rollenbezogen.
  Art. 4 gilt seit 02.02.2025 und bleibt nach dem Omnibus bestehen. Leicht zu bauen, für jedes Unternehmen relevant.
- **Art.-50-Kennzeichnungs-Check:** prüft, ob KI-generierte Inhalte (Website, Chatbot, Bilder) gekennzeichnet sind.
  Passt zum Builder und zum Cookie-Scanner.
- **Builder fokussieren:** Der SiteOS-Builder wird als „DSGVO-konforme Website“ verkauft (Cookie-, Impressum-, Datenschutz-,
  KI-Kennzeichnungs-Checks eingebaut). Den Code-Builder bis nach Q1 2027 nicht weiter ausbauen.

**Technik**
- Lazy Loading aller `/app`- und Design-Routen, Lighthouse-Budget in CI.
- `eu_local` als expliziter Residency-Modus im Router (Ollama/LM Studio), im Dashboard sichtbar.
- Hostinger-Altlast-Workflows archivieren, toten Code (`AgentsView.tsx`, Mock-Daten) entfernen.

**Marketing**
- **Content-Hub statt Blog:** MDX-Ratgeber zu AI-Act-Pflichten nach Omnibus, DSGVO + KI, Branchen-Guides (Kanzlei, Praxis, FinTech).
  Jeder Artikel endet mit dem kostenlosen Scan als CTA. Fristen nur mit Quelle (VO 2026/1744).
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
   **Owner-Entscheid bis 12.12.2026** (siehe Abschnitt 9), weil Upgrade-Flow und Mails darauf aufbauen.
2. **Nutzungsbasiert (WP-5 Credits):** `credit_rates`, Budget-Check, Ledger, Stripe-Meter (`stripe-meter-sync` existiert).
   Agenten-Runs und KI-Calls über dem Kontingent werden abgerechnet.
3. **Upsell-Trigger im Produkt:** Limit erreicht (`limit.ai_calls_monthly`, `limit.sites`), Hinweis „Evidence-Export ab
   Growth“. Läuft über die vorhandenen `planAccess.ts`/`useModuleAccess.ts`.
4. **Partnerkanal:** 5–10 Datenschutz-/IT-Rechtskanzleien (`docs/partner-kanzlei-outreach.md`) mit 20–30 % Revenue-Share.
   Kanzleien bringen Vertrauen, wir liefern die Technik.
5. **Add-ons:** Compliance-Pack, White-Label, WhatsApp/Voice-Bots (erst wenn aus „Preview“ raus).
6. **Jahrespreise:** aktivieren, sobald Stripe-Preise angelegt sind. Das ist eine Owner-Entscheidung, bringt aber
   Cashflow und weniger Kündigungen. Sinnvoll gekoppelt an die Gründerpreis-Kampagne.

---

## 6. Skalierung (Go-to-Market)

**Motor:** Product-led mit Partner-Beschleuniger.

```
SEO/Content + LinkedIn + Partner ─► Kostenloser Scan (/audit) ─► Befund-Report per Mail
   ─► Registrierung ─► Activation (<15 min) ─► Command Center ─► Trial/Beta ─► Paid ─► Expansion (Credits, Agency)
```

| Kanal | Maßnahme | Ziel-KPI |
|---|---|---|
| SEO | Content-Hub, Tools-Seiten (Cookie-Scanner, AI-Act-Klassifizierer, Art.-50-Check) als Einstieg | 5.000 organische Besuche/Monat bis Q2 2027 |
| LinkedIn (Gründer-Brand) | 3 Posts/Woche: Omnibus-Fristen, Befunde aus anonymisierten Scans | 50 Scans/Monat aus Social |
| Partner | Kanzleien + Agenturen (Agency-Plan) | 30 % Neukunden über Partner bis Ende 2027 |
| Webinare | monatlich „AI Act für [Branche] in 45 Min“ | 20 % Teilnehmer → Scan |
| E-Mail | Nurture nach Scan, Newsletter (Double-Opt-in vorhanden) | 10 % Scan → Registrierung |

**Funnel-KPIs (in `marketingAnalytics.ts` instrumentieren, ab Phase 0 messen):** Besuch → Scan (Ziel 5 %),
Scan → Registrierung (25 %), Registrierung → Activation abgeschlossen (60 %), Activation → Paid (15 %),
Netto-Umsatzbindung > 100 %.

**Technische Skalierung:** Supabase EU und Cloudflare reichen bis in den niedrigen fünfstelligen Nutzerbereich.
Engpässe sind ai-gateway-Kosten (Quoten und Credits) und Cron-Zuverlässigkeit. `services/realsync-runtime-core`
nur für Enterprise/On-Prem aktivieren, keine dritte Laufzeit für KMU.

---

## 7. Marketing-Kalender bis Beta-Ende

| Datum | Anlass | Maßnahme |
|---|---|---|
| KW 45–47 | Omnibus in Kraft, Fristen verschoben | Artikel + LinkedIn-Serie „Was der Omnibus für KMU ändert“ |
| bis 02.12.2026 | Art. 50(2)-Kennzeichnung für Bestandssysteme, neue Art.-5-Verbote | Kampagne „Ist Ihre KI gekennzeichnet?“ mit Scan als CTA |
| Dezember | Jahresplanung bei KMU | Webinar „AI-Act-Fahrplan 2027 bis zur Hochrisiko-Frist 02.12.2027“ |
| 01.–31.01.2027 | Beta-Ende | Gründerpreis-Kampagne, Mails T-14/T-3/T-0, Case Studies |

---

## 8. Roadmap (Phasen)

Zeiträume gelten unter der Kapazitätsannahme aus Abschnitt 0. Bei Engpass greift die Streichreihenfolge.

| Phase | Zeitraum | Inhalt | Ergebnis |
|---|---|---|---|
| **0 Stabilisieren** | KW 44–45 (bis 08.11.) | **M3 Evidence pro KI-Call zuerst** (WP9), dann M7 (Guards, Cron-401), E-O4 Migration, Fristen-Texte auf Omnibus-Stand (WP10), Funnel-Events, toten Code und Mocks entfernen | Basis ehrlich, sicher, messbar |
| **1 Ein Weg** | KW 46–48 (bis 29.11.) | M1 Onboarding (WP11), M2 Dashboard (WP12), Routen-Diät (Redirects), Art.-50-Kampagne live | Neuer Nutzer kommt ohne Hilfe zum ersten Nachweis |
| **2 Governance-Kette + Conversion** | KW 49–51 (bis 20.12.) | M6 Beta → Paid, Upgrade-Flow, Erinnerungsmails, Compliance-Pack-Wizard, M4 O-WP6 + Rollback | Zahlbar, nachweisbar, verkaufbar |
| **3 Beta-Abschluss** | 01.01.–31.01.2027 | Gründerpreis-Kampagne, 10 Pilot-Case-Studies, Content-Hub Start, Partner-Onboarding, M5 (WP13) falls verschoben | ≥ 15 % Beta → Paid |
| **4 Skalieren** | Q1–Q2 2027 | WP-5 Credits, Agency/White-Label, Partnerprogramm, Art.-4-Schulungsmodul, Jahrespreise | 10–15 k € MRR |
| **5 Enterprise** | Q3–Q4 2027 | SSO/SCIM (ADR 0007), eu_local/On-Prem, DORA/TISAX-Packs, ISO 42001, Hochrisiko-Pack vor 02.12.2027 | Enterprise-Deals |

Arbeitsweise bleibt wie gehabt: **ein WP pro Session und PR**, Merge, Migration, Preise und Rechtstexte nur mit separater Owner-Freigabe.

---

## 9. Offene Owner-Entscheidungen (nach Deadline sortiert)

| Entscheidung | Deadline | Blockiert |
|---|---|---|
| Ausgangswerte und Stunden/Woche eintragen (Abschnitt 0) | 01.11.2026 | Zielbestätigung, Phasenplanung |
| **E-O4** Trial-Expiry-Migration auf Produktion | 08.11.2026 | M6 |
| Migration für WP9 (Evidence-Tabelle/Spalten für KI-Calls), falls vorhandene Tabellen nicht reichen | 08.11.2026 | M3 |
| **E-F5** `/unified-entry/scan` vs. `/audit` als kanonischer Scan-Einstieg (Empfehlung: `/audit`) | 15.11.2026 | M1 |
| Welche Dashboards und Landings endgültig stillgelegt werden (Empfehlung siehe M2 und Routen-Diät) | 15.11.2026 | M2, Routen-Diät |
| **Gründerpreis / Beta-Konditionen ab 01.02.2027** | **12.12.2026** | Upgrade-Flow, Mails T-14 (17.01.), Kampagne |
| Jahrespreise in Stripe anlegen | 12.12.2026 | Gründerpreis-Kampagne |
| **E-F4** Partner 1.999 € | 31.12.2026 | Partnerprogramm |
| **E-V5–E-V9** (eu_local, On-Prem/SCIM, SSO), **E-R1–E-R5** (Responsive WP8) | Q1 2027 | Phase 4/5 |

---

## 10. Umsetzung

1. Dieses Dokument liegt unter `docs/strategy/MASTERPLAN_2026-2027.md` (docs/ ist hier explizit genannt).
2. WP-Arbeitsaufträge für Phase 0 und 1 im Stil der bestehenden `.claude/commands/wp*.md`:
   - `wp9-evidence-per-call.md` (M3)
   - `wp10-omnibus-fristen.md` (M8, Fristen)
   - `wp11-canonical-onboarding.md` (M1)
   - `wp12-one-dashboard.md` (M2)
   - `wp13-agent-lifecycle.md` (M5)

   Künftige Sessions setzen jeweils genau ein Paket um (`/wp9-evidence-per-call` usw.).
3. Kein Produktcode in diesem Schritt. Die Umsetzung der Must-haves erfolgt WP für WP in eigenen PRs.

## Verifikation

- Plan-Dokument: `npm run check:context` bleibt grün (CLAUDE.md wird nicht angefasst), Markdown rendert im PR.
- Fakten im Plan gegen den Code geprüft: Preise gegen `shared/pricing.ts`, Beta-Logik gegen `src/config/beta.ts`,
  Routen gegen `src/App.tsx`, WP-Status gegen `.claude/os-funnel/OKTOBER-2026.md`,
  ai-gateway-Logging gegen `supabase/functions/ai-gateway/handler.ts` (`anonAuditLog` vs. `recordUsage`).
- Rechtsfristen gegen VO (EU) 2026/1744 im Amtsblatt (ABl. vom 24.07.2026) prüfen, bevor sie in Produkt oder Marketing gehen.
- Pro späterem WP: `npm run build`, `check:landing-claims`, `check:fabrication`, `check:entitlements`, betroffene e2e-Specs.
