# Masterplan RealSyncDynamicsAI 2026/2027 (faktisch bereinigt)

Stand: 26.10.2026 · Code-Basis `main@5c3e718` · Laufzeit-Abgleich read-only gegen Supabase-Projekt
`RealSyncDynamicsLive` (Logs 24 h, Tabellen 30 Tage) am 26.10.2026.

Status: **Überarbeitete Planfassung; keine Implementierungs-, Merge- oder Produktionsfreigabe.** Ersetzt die Erstfassung aus PR #2009 inhaltlich. Ziele, Preise,
Stilllegungen und Rechtsaussagen sind Owner-Entscheidungen (§8). Dieses Dokument gibt **keine**
Routenlöschung, keine Preisänderung und keine Rechtsfrist frei.

---

## 0. Leitplanken (gelten für alle Phasen)

- **Die Startseite `/` bleibt Landing v6** (`src/pages/LandingV6.tsx`, `src/App.tsx:505`). v7 bleibt unter
  `/design/landing-v7`, ältere Fassungen (v2, v4, v5) bleiben unter `/design/*`.
- **Keine Routenlöschung** ohne gesonderte Owner-Freigabe pro Route bzw. Routengruppe.
- **Keine Preisänderung** ohne Owner-Freigabe; maßgeblich ist die gemergte SSoT `shared/pricing.ts` (§5).
- **Keine Produktänderung und keine Kampagne auf Basis unbelegter Rechtsgrundlagen oder Fristen** (§1).
- Ziele sind **Planungsziele**, keine Prognose (§2).
- Ein WP pro Session und PR. Merge, Deploy, Migrationen und Secrets nur mit separater Owner-Freigabe.

### Belegstatus

Jede Ist-Aussage trägt einen dieser Status:

| Status | Bedeutung |
|---|---|
| **belegt (Code)** | Datei/Zeile im Repo nachgewiesen |
| **belegt (Laufzeit)** | in Produktions-Logs oder -Daten nachgewiesen (read-only) |
| **Prüfbefund** | plausibel, aber nicht nachgewiesen; vor Umsetzung belegen |
| **widerlegt / veraltet** | Aussage der Erstfassung trifft nicht (mehr) zu |

---

## 1. Rechtsgrundlage

Amtlicher Quellenabgleich vom 26.10.2026 (Ergänzung zu Revision 3): Die EU-Kommission bestätigt die VO (EU) 2026/1744 und das Inkrafttreten am 27.07.2026. Sie ist nicht mehr nur ein unbelegter Prüfbefund.

| Thema | Bestätigter Planungspunkt | Einschränkung |
|---|---|---|
| Hochrisiko Anhang III | betreffende Anforderungen ab 02.12.2027 | Kein allgemeiner Aufschub aller AI-Act-Pflichten |
| Hochrisiko Anhang I | betreffende Anforderungen ab 02.08.2028 | Einordnung nach Produkt und Rolle erforderlich |
| Art. 50 | Transparenzregeln grundsätzlich seit 02.08.2026 | Einzelpflichten unterscheiden sich nach Rolle/System |
| Art. 50 Abs. 2, Übergang | 02.12.2026 für bestimmte Anbieter synthetische Inhalte erzeugender Systeme, die vor dem 02.08.2026 auf den Markt kamen | Keine allgemeine Dezemberfrist für jede Website oder jeden KI-Nutzer |
| Neue Verbote | bestimmte nicht einvernehmliche sexuelle Deepfakes und Darstellungen sexuellen Kindesmissbrauchs ab 02.12.2026 | Andere Verbote gelten bereits |

Quellen:
- EU-Kommission, Rechtsakt und Inkrafttreten: https://commission.europa.eu/law/law-making-process/better-regulation/simplification-implementation-and-enforcement/simplification_en
- Amtlicher Zeitplan: https://ai-act-service-desk.ec.europa.eu/en/ai-act/eu-ai-act-implementation-timeline
- Änderungsakt: https://eur-lex.europa.eu/eli/reg/2026/1744/oj/eng

Der direkte EUR-Lex-Abruf war hier durch eine JavaScript-Prüfung blockiert. Vor konkreter rechtlicher Implementierung den authentischen Amtsblatttext prüfen. Der genaue aktuelle Art.-4-Wortlaut und O7 (Art. 3 Nr. 23, Art. 25 Abs. 1 Buchst. b, Art. 43 Abs. 4) bleiben gesondert zu prüfen. Keine pauschalen Compliance-Garantien; dieses Dokument gibt keine Änderungen an Rechtstexten oder Kampagnen frei.

---

## 2. Ziele (Planungsziele, keine Prognose)

**Nordstern-Metrik:** Anzahl Organisationen mit aktivem Evidence-Nachweis pro Monat.

Die folgenden Werte sind **Planungsziele zur Steuerung**, keine belastbare Prognose. Es gibt dafür derzeit
keine Datenbasis: In Produktion wurden in den letzten 30 Tagen **0** `usage_events` und **0**
`ai_evidence_events` geschrieben (Laufzeit, 26.10.2026). Eine Prognose ist erst nach mindestens einem
Messzeitraum mit echten Nutzern sinnvoll.

| Zeitpunkt | Planungsziel |
|---|---|
| 31.12.2026 | 1 kanonischer Funnel live, Time-to-First-Evidence < 15 min; Zahl aktiver Beta-Workspaces wird gemessen, Zielwert vom Owner |
| 31.01.2027 (Beta-Ende) | Beta → Paid-Quote messen; Zielwert vom Owner |
| 2027 | MRR- und Partner-Ziele erst nach Beta-Auswertung festlegen |

Die Erstfassung nannte „100 aktive Workspaces“, „≥ 15 % Beta → Paid“, „10–15 k € MRR“ und „40–60 k € MRR“.
Diese Zahlen sind **nicht hergeleitet** und bleiben bis zur Owner-Festlegung gestrichen.

---

## 3. Kapazität

Die Erstfassung hat eine Kapazitätsannahme unterstellt, die die tatsächliche Situation nicht trifft.
Der Plan rechnet deshalb **nicht** mit einer angenommenen Stundenzahl:

- Die Phasen in §7 sind eine **Reihenfolge**, keine zugesagten Termine.
- Der Owner trägt die tatsächlich verfügbare Kapazität ein (Stunden/Woche, Review-Fenster für PRs und
  Freigaben). Daraus ergeben sich die Zielfenster.
- Engpass ist nicht nur Umsetzung, sondern **Owner-Freigabe** (Merge, Secrets, Preise, Recht). Pro Woche
  sollten nur so viele PRs entstehen, wie auch geprüft werden können.

---

## 4. Ist-Stand mit Belegen

| # | Aussage der Erstfassung | Status | Beleg / Korrektur |
|---|---|---|---|
| I-1 | „ca. 527 Routen“ | **widerlegt** (Zahl) | `src/App.tsx` enthält **517** `<Route>`-Elemente, davon **92** reine `Navigate`-Weiterleitungen (≈ 425 rendernde Routen). Breite des Produkts bleibt als Befund bestehen. |
| I-2 | „`/admin/*` und `/dashboard/*` ohne Router-Guard“ | **belegt (Code), aber kein Sicherheitsbefund** | Kein Guard auf Router-Ebene (`src/App.tsx:969–972`, `1070–1082`). Aber: 8 von 10 `/admin`-Seiten prüfen `profiles.is_super_admin` in der Komponente; die Admin-RPCs prüfen serverseitig (z. B. `admin_customers_list`, `admin_system_health`). `/admin/social` und `/admin/onboarding` laufen über `AuthGate` + Mandanten-Kontext. Eine ausnutzbare Lücke ist **nicht nachgewiesen** → Router-Guard ist Defense-in-Depth (P1), nicht Phase 0. |
| I-3 | `/dashboard/enterprise-ai-os` mit Mock | **belegt (Code)** | `src/pages/EnterpriseAiOsDashboard.tsx` importiert `mockAiSystems` u. a. aus `lib/enterprise-ai-os/mock-data`, öffentlich erreichbar (`src/App.tsx:631`). Ehrlichkeitsthema (M8), kein Sicherheitsproblem. |
| I-4 | „3 Cron-Functions antworten 401“ | **veraltet** → neuer Befund **belegt (Laufzeit)** | Letzte 24 h: `scheduler-dispatch` 91×, `governance-monitoring-scheduler` 23×, `memory-decay-worker` 23× **HTTP 500**, keine erfolgreichen Läufe. Im Code ist für die beiden letzteren `500` ausschließlich `CRON_KEY_MISSING` (leeres Function-Secret); bei `scheduler-dispatch` zusätzlich „could not load due schedules“. Vault hat 9 `cron_*`-Einträge. Wahrscheinliche Ursache: Function-Secrets fehlen. Behebung laut `docs/runbooks/cron-vault-secrets.md` (manueller Schritt, kein Code). |
| I-5 | Evidence-Lücke im `ai-gateway` | **belegt (Code)**; Laufzeit-Auswirkung derzeit 0 | Authentifizierter Pfad: `logAccess` (Konsole) + `bookUsage` → `usage_events` (`supabase/functions/ai-gateway/handler.ts:265–296`, `490–538`); `pdpCheck`/`decide` schreibt keinen Evidence-Eintrag. Kein Schreibzugriff auf `ai_evidence_events`. 0 `usage_events` belegen nur fehlende gespeicherte Nutzungsereignisse, nicht das Ausbleiben sämtlicher Calls oder Datenverluste. Das Produktversprechen muss durch einen Ende-zu-Ende-Test geprüft werden. |
| I-6 | Freigabe-Evidence außerhalb der Hash-Kette | **belegt (Code)** | `supabase/functions/governance-approvals/index.ts:152–160` schreibt `governance_evidence` mit `content_hash: null`, `previous_hash: null` statt über `append_governance_evidence` (O1). |
| I-7 | „Trial-Expiry-Migration (E-O4) auf Prod offen“ | **widerlegt** | `20260928160000` ist in `supabase_migrations.schema_migrations` eingetragen (Laufzeit); `.claude/os-funnel/OKTOBER-2026.md` führt E-O4 als erledigt. |
| I-8 | Enterprise 1.249 € | **belegt (Code) – aber abweichend von Owner-Vorgabe** | Siehe §5. |
| I-9 | 38 CI-Workflows, Sitemap 109 URLs | **belegt (Code)** | `.github/workflows/` (38 Dateien), `public/sitemap.xml` (109 `<loc>`). |
| I-10 | ca. 12 Dashboards, 6 Agenten-Oberflächen, 6+ Onboarding-Einstiege, Entitlements in ca. 45 Functions | **Prüfbefund** | Nicht nachgezählt. Vor WP10/WP11/WP12 mit Datei-Liste belegen. |
| I-11 | Beta endet 31.01.2027 | **belegt (Code), nur Anzeige** | `src/config/beta.ts`: `endsLabel` nennt 31. Januar 2027 ausdrücklich als Text ohne Ablaufautomatik. `publicOffer` ist an; `active` ist per Build-Flag steuerbar. Server-Ablauf, Stripe-Trial und tatsächliche Berechtigungen sind separat zu prüfen. |

---

## 5. Preise

- **Gemergte SSoT** (`shared/pricing.ts` auf `main`): Enterprise `monthlyEur: 1_249`, `priceOnRequest: true`,
  Self-Service-Checkout gesperrt (`ENTERPRISE_SELF_SERVICE_BLOCKED`).
- **Produktion:** Enterprise-Produkt „Enterprise (inquiry · no self-service checkout)“ – also **nicht
  selbst buchbar**, nur per Anfrage/Vertrag.
- **Owner-Vorgabe zuletzt:** 1.498 € / Monat netto. Umgesetzt nur in **offenen** PRs: #1995
  (Self-Service-Checkout zu 1.498 €) und #1999 (Enterprise-Festpreis überall). Beide nicht gemergt.
- **Folge für den Plan:** Der Masterplan nennt **keinen Enterprise-Betrag**, bis Preisquelle (SSoT),
  Stripe-Price und tatsächlich buchbarer Tarif übereinstimmen. Abgleich ist Owner-Entscheidung **E-P1** (§8).
- Übrige Stufen (Starter 79 €, Growth 249 €, Agency 699 €, Partner 1.999 €, Governance Launch 349 €) stehen so
  in der SSoT; Partner ist in `shared/pricing.ts` als `availability: legacy` markiert; der interne Wert 1.999 € ist kein aktives Neukundenangebot. Eine Reaktivierung bleibt eigene Entscheidung E-F4. Gründerpreis und Jahrespreise sind
  Vorschläge, keine Angebote.

---

## 6. Phase 0 – nur nachgewiesene Sicherheits-, Evidence- und Betriebsprobleme

Aufgenommen wird nur, was in §4 als **belegt** markiert ist und Sicherheit, Evidence oder Betrieb betrifft.

| ID | Problem | Beleg | Maßnahme | Art | Abnahme |
|---|---|---|---|---|---|
| **P0-1** | Cron-Functions laufen nicht (HTTP 500) | I-4 | Function-Secrets `CRON_SCHEDULER_DISPATCH_KEY`, `CRON_MEMORY_DECAY_KEY`, `CRON_GOVERNANCE_MONITORING_KEY` (+ `CRON_WEBSITE_RESCAN_KEY`) auf den Wert der `cron_*`-Vault-Einträge setzen, nach Runbook | Owner, manuell (Dashboard) | `function_edge_logs`: 2xx für alle drei Functions über 24 h |
| **P0-2** | Alarm ohne Inhalt | I-4. Korrektur 26.10.: Der Alarm existiert. `Cron Health Guard` prüft Nicht-2xx über `net._http_response`, `drift-alert.yml` hält Issue #1521 seit 22.09. offen. Aber alle 35 Folgekommentare lauteten nur „Weiterhin rot“, ohne Ursache, und der Wechsel von 401 auf 500 war nicht zu sehen | Kommentar nennt Ursache, Status und Anzahl und meldet „geändert“ oder „unverändert seit …“ (`scripts/cron-befund.mjs`) | Code, eigener PR | Nach Merge: `Cron Health Guard` per `workflow_dispatch` auf main, Kommentar in #1521 nennt HTTP 500 / `CRON_KEY_MISSING` |
| **P0-3** | Kein Evidence-Eintrag pro authentifiziertem KI-Call | I-5 | WP9: pro Call ein Eintrag in `ai_evidence_events` (bestehende Tabelle, Hash-Kette per Trigger, keine Migration) | Code, eigener PR | Unit-Test + ein Testcall erzeugt genau einen verketteten Eintrag |
| **P0-4** | Freigabe-Evidence außerhalb der Hash-Kette | I-6 | `governance-approvals` auf `append_governance_evidence` umstellen (O1); Abgleich mit offenem PR #2006 | Code, eigener PR | Neuer Eintrag hat `content_hash`/`previous_hash` gesetzt, Kette lückenlos |

Entscheidung vor P0-3: **fail-open** (Antwort geht raus, Fehler wird geloggt und alarmiert) oder
**fail-closed** (Call scheitert ohne Nachweis). Die Entscheidung wird nach Schutzbedarf und zugesagter Nachweispflicht getroffen, nicht allein nach Tarif. Vor Umsetzung sind Datenminimierung, Wiederholung/Idempotenz, Parallelität, Providerfehler und Evidence-Schreibfehler zu testen.

**Nicht in Phase 0** (aus der Erstfassung entfernt):

- Router-Guard `/admin/*`, `/dashboard/*` → P1 Defense-in-Depth (I-2, keine Lücke nachgewiesen)
- E-O4-Migration → bereits angewendet (I-7)
- Toten Code und Mocks entfernen → Phase 1 / M8 (Ehrlichkeit, nicht Sicherheit)
- Monitoring für Stripe-Webhook und `ai-gateway` → erst Bedarf belegen (keine Ausfälle nachgewiesen)

---

## 7. Weitere Phasen (Reihenfolge, Termine nach Kapazität §3)

| Phase | Inhalt | Voraussetzung |
|---|---|---|
| **1 Ein Weg** | M1 kanonisches Onboarding (WP10), M2 ein Dashboard (WP11), M5 Agenten-Register (WP12), M8 Mock-Dashboards als Vorschau kennzeichnen oder auf echten Status umstellen | Prüfbefunde I-10 mit Datei-Listen belegt |
| **2 Governance-Kette + Conversion** | M4 O-WP6 (Publish/Agent → Approval → Evidence, Ablehnungstest) + Publish-Rollback; M6 Beta → Paid (Kollision Beta-`trial_end` vs. Stripe-Trial, Erinnerungsmails, Downgrade statt Sperre) | Phase 0 abgenommen; Preise (E-P1) entschieden |
| **3 Beta-Abschluss** | Auswertung, Case Studies nur mit schriftlicher Referenzfreigabe, Content nur mit geprüften Rechtsaussagen (§1) | Beta-Ende belegt (I-11) |
| **4 / 5** | Credits, Agency/White-Label, Partnerprogramm; Enterprise (SSO/SCIM laut ADR 0007, eu_local/On-Prem) | Owner-Ziele nach Beta-Auswertung |

**Routen:** Statt „Routen-Diät von 527 auf 150“ zuerst eine **Bestandsliste** (Route → Zweck → Nutzung →
Vorschlag behalten/weiterleiten/`noindex`). Stilllegen nur nach Owner-Freigabe je Gruppe. `/` bleibt v6.

**Marketing:** Content-Hub, LinkedIn, Webinare und E-Mail-Nurture bleiben als Richtung bestehen. Keine
Inhalte mit Fristen oder Pflichten, die nicht gegen amtliche Quellen geprüft sind (§1). Kanal-KPIs sind
Planungsziele (§2).

---

## 8. Offene Owner-Entscheidungen

- **E-P1 Enterprise-Preis:** 1.249 € (SSoT `main`, nur Anfrage) vs. 1.498 € (Vorgabe, PRs #1995/#1999) und
  ob Self-Service-Checkout gewollt ist
- **E-K1 Kapazität:** tatsächlich verfügbare Stunden/Woche und Review-Fenster
- **E-Z1 Ziele:** Planungswerte für Workspaces, Conversion, MRR (nach erstem Messzeitraum)
- **E-R1 Recht:** Amtliche Existenz und Zeitplan bestätigt (§1); genaue Artikelanwendung, Art. 4 und O7 durch fachkundige Stelle prüfen, bevor Produkttexte geändert werden
- **P0-1:** Cron-Secrets setzen (manueller Schritt)
- **P0-3:** fail-open vs. fail-closed
- E-F4 Partner 1.999 €, E-F5 `/audit` als kanonischer Scan-Einstieg, Gründerpreis, Jahrespreise
- Welche Routen/Dashboards stillgelegt werden (erst nach Bestandsliste)

Erledigt seit Erstfassung: **E-O4** (WP2a-Migration angewendet).

---

## 9. Verifikation dieser Fassung

- Code: `src/App.tsx` (Routen, Startseite, Admin-Routen), Admin-Komponenten unter `src/features/admin/`,
  `supabase/functions/ai-gateway/{index,handler}.ts`, `supabase/functions/_shared/pdp/decide.ts`,
  `supabase/functions/governance-approvals/index.ts`, Cron-Functions `scheduler-dispatch`,
  `memory-decay-worker`, `governance-monitoring-scheduler`, `shared/pricing.ts`.
- Laufzeit (read-only, 26.10.2026): `function_edge_logs` 24 h; Zählungen `usage_events`,
  `ai_evidence_events` (30 Tage); `supabase_migrations.schema_migrations`; Anzahl `cron_*` in `vault.secrets`
  (nur Namen, keine Werte); `public.products` (Enterprise-Eintrag).
- Nicht verifiziert: alle als **Prüfbefund** markierten Aussagen.
