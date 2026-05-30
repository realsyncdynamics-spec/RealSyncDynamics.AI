# Restrukturierung auf Government-/Enterprise-Niveau — Architektur- & Positionierungsanalyse

> **Status:** v1, 2026-05-30
> **Auftrag:** Vollständige Analyse von Informationsarchitektur, Positionierung und Government-Readiness.
> **Lens:** Enterprise-Kunde · Compliance Officer · öffentlicher Auftraggeber. Keine Marketing-Floskeln.
> **Companion:** `docs/positioning/positioning-v1.md`, `docs/PRODUCT_FOCUS.md`, `docs/architecture/governance-os-blueprint.md`, `ROADMAP.md`
> **Verbotene Phrasen (aus positioning-v1 §3):** „rechtssicher", „garantiert DSGVO-konform", „Bußgeld droht" — in diesem Dokument und in jeder daraus abgeleiteten Copy hart vermeiden.

---

## 0. Befund in einem Satz

> **Die Architektur ist Government-grade. Die öffentliche Informationsarchitektur ist es nicht.**
> RealSyncDynamics.AI hat intern eine Governance-Runtime auf Kategorie-definierendem Niveau gebaut (1.442-Zeilen-Blueprint, 70+ Edge Functions, ~25 Governance-Views, Hash-Chain-Evidence, AI-Act-Classifier) — präsentiert sie aber öffentlich über eine 4-Punkte-Navigation und eine Agentur-Hero („Mehrere Websites. Kontinuierlich überwacht."). Enterprise- und Behördenkäufer sehen 10 % der Plattform und ziehen die falsche Kategorie-Schlussfolgerung.

Die Aufgabenstellung vermutet, die Plattform werde „zu technisch" präsentiert. Der reale Befund ist das **Gegenteil**: Die öffentlich sichtbare Oberfläche ist **zu klein und zu agenturlastig** für die tatsächlich gebaute Substanz. Das Problem ist nicht „Features vor Nutzen" — es ist „Snapshot-Tool-Framing vor Runtime-Substanz".

---

## 1. Executive Summary

### 1.1 Die drei Kernprobleme

1. **Positionierungs-Mismatch zwischen `/` und der internen Strategie.**
   `positioning-v1.md` (offizielle SSOT, 2026-05-20) und `PRODUCT_FOCUS.md` definieren die Plattform als **„Realtime Governance Runtime"**, Kategorie „näher an Datadog · Vanta · CrowdStrike · ServiceNow". Die Live-Homepage (`src/pages/Landing.tsx`, Route `/`) führt dagegen mit *„Governance-Runtime für Agenturen und Multi-Site-Betreiber. Mehrere Websites. Kontinuierlich überwacht. Audit-ready."* — das ist die Agentur-Nische, nicht die Enterprise-/Government-Kategorie. **Die eigene Positioning-RFC wird auf der wichtigsten Surface nicht eingehalten.**

2. **Die Enterprise-Narrative existiert als Code — aber sie ist nicht verdrahtet.**
   In `src/components/sections/` liegen 38 fertige Sektions-Komponenten: `HeroSection`, `GovernanceArchitectureSection`, `PolicyEngineSection`, `EnterpriseEvidenceVaultSection`, `AgentOversightSection`, `SystemLevelGovernanceSection`, `TechSecuritySixtySecondsSection`, `TrustCertificationsSection`, `PersonaCardsSection` u. a. — plus `src/components/ArchitectureDiagram.tsx`. Die Route `/` rendert davon **fast nichts**; sie nutzt eine minimale Eigenkonstruktion. Die Mission→Problem→Lösung→Architektur→Evidence-Story ist gebaut und liegt im Repo brach.

3. **Navigations-Unterdeckung.** Die Hauptnavigation (`src/components/Navbar.tsx`) exponiert **4 Punkte**: Runtime · AI Act · Preise · Doku. Dahinter liegen ~50 öffentliche Seiten und eine Auth-Suite mit ~25 Governance-Views (DPIA, Incidents, Vendors, Scans, Remediation, Auditor-Console, DSR-Tracker, Cost-Tracking). Ein Behördenkäufer hat keinen Pfad, um in 15 Sekunden „Was / Warum / Wie / Warum vertrauenswürdig" zu erfassen — er sieht einen Cookie-Scanner mit CTA „Run Scan".

### 1.2 Das Gute (nicht beschönigt, sondern belegt)

- **Backend-Substanz real:** `supabase/functions/` enthält u. a. `governance-agent`, `governance-dpias`, `governance-incidents`, `governance-risk-score`, `governance-remediate`, `evidence-export`, `evidence-vault-export`, `ai-act-classify`, `gdpr-export`, `gdpr-delete`. Evidence-Hashing (`src/core/runtime/evidence.ts`, SHA-256 über kanonisches JSON) ist laut `ROADMAP.md` „implementiert".
- **DSGVO-Tiefe real:** VVT (`/governance/vvt`), DSFA (`/governance/dpias` + `/dsfa-wizard`), DSR-Tracker (`/governance/dsr`), AVV (`/legal/avv`), Sub-Prozessoren (`/legal/sub-processors`, 8 dokumentiert), Art.-15/17-Export/Löschung (`/settings/account`), Meldepflicht-Timer (`/datenpanne-meldung`).
- **EU-Souveränität real:** Per-User/Per-Tenant-Residency-Toggle (`/settings/ai-residency`), `eu_local`-Routing über Ollama-Stack (Frankfurt), On-Premise-Variante für Behörden (`PublicSectorLanding.tsx`).
- **Multi-Tenancy real:** RLS-Migrations, `ai_tool_runs`/`workflow_runs`-Audit-Log, Tenant-Invites, RBAC.

### 1.3 Die Top-5-Hebel (nach Wirkung)

| # | Hebel | Aufwand | Wirkung |
|---|---|---|---|
| 1 | Homepage `/` neu komponieren aus vorhandenen `sections/`-Komponenten (Mission→Evidence-Story) | **niedrig** (Komponenten existieren) | **sehr hoch** |
| 2 | Hauptnavigation auf 7 Punkte mit Kategorie-Sprache umstellen | niedrig | hoch |
| 3 | Positionierung von „für Agenturen" auf „EU Governance Operating System" anheben | niedrig | sehr hoch |
| 4 | GovTech-Lücken schließen: BSI C5 / NIS2 / KRITIS-Mapping, FRIA, formales Risikoregister | hoch | hoch (Behörden-Tür) |
| 5 | Trust-Center mit Zertifizierungs-Roadmap (SOC2/ISO 27001/BSI C5) öffentlich machen | mittel | hoch (Procurement) |

---

## 2. Aufgabe 1 — Government Benchmark & Priorisierungsmatrix

Abgeleitet aus der IA-Logik von Microsoft Purview/Compliance, ServiceNow GRC, Palantir Foundry, Datadog, Splunk, AWS (Cloud Adoption / Governance) sowie EU-AI-Act-Governance-Frameworks (OneTrust, Credo AI, IBM watsonx.governance — wie in `governance-os-blueprint.md §0` als Wettbewerb benannt).

### 2.1 Welche Seiten zwingend vorhanden sein müssen

Querschnitt aller Benchmark-Plattformen — ein Enterprise-/Gov-Käufer erwartet diese Seiten **immer**:

1. **Platform / Overview** — eine Seite, die das Betriebssystem als Ganzes erklärt (nicht ein Feature).
2. **Use Cases / Solutions by Role** — nach Rolle und Regulierung sortiert (DPO, CISO, Behörde).
3. **Architecture / How it works** — Datenfluss, Runtime, Control-/Data-/Workflow-Plane.
4. **Security & Trust Center** — Hosting, Verschlüsselung, Zertifikate, Sub-Prozessoren, Pen-Test, Statuspage.
5. **Compliance / Frameworks** — welche Regulierungen werden gemappt (DSGVO, AI Act, NIS2, ISO, SOC2).
6. **Evidence / Audit** — wie Nachweis erzeugt, signiert, exportiert, versioniert wird.
7. **Integrations** — Konnektoren, SDK, API.
8. **Pricing / Editions** — am Ende, mit „Contact Sales" für Enterprise.
9. **Resources / Docs / Changelog / Status** — Vertrauen durch Transparenz.
10. **Company / Legal / Impressum / DPA** — Procurement-Pflicht.

**Status bei RealSync:** 1 fehlt (es gibt keine echte „Platform"-Overview-Seite, nur Feature-Seiten), 2–10 existieren in Fragmenten, aber unverbunden und ohne Navigationspfad.

### 2.2–2.4 Erwartete Reihenfolge je Käufertyp

| Rang | Enterprise-Tech-Buyer (CTO/CISO) | Behörde (öff. Auftraggeber) | Investor |
|---|---|---|---|
| 1 | Platform / Architektur | **Souveränität & Hosting (EU/On-Prem)** | Kategorie & Markt (TAM) |
| 2 | Security & Trust | Rechtsrahmen-Mapping (AI Act High-Risk, DSGVO, NIS2, BSI) | Mission & Wedge |
| 3 | Integrations / API | **Auditierbarkeit & Nachweis** | Architektur-Moat (Runtime vs. Dokument) |
| 4 | Compliance-Frameworks | Barrierefreiheit (BFSG/BITV), OZG | Traction / Pilots |
| 5 | Evidence / Audit | Beschaffung (EVB-IT, Referenzen) | Compliance-Tiefe (Defensibility) |
| 6 | Rollen / Use Cases | Rollen (Behörden-DSB) | Pricing / Unit Economics |
| 7 | Pricing | Pricing / Lizenz / On-Prem | Team & Roadmap |

**Lesart:** Enterprise führt mit *Architektur*, Behörde führt mit *Souveränität + Rechtsrahmen + Nachweis*, Investor führt mit *Kategorie + Moat*. Alle drei wollen **Pricing zuletzt** — exakt die in der Aufgabenstellung geforderte Ebene 9.

### 2.5 Priorisierungsmatrix (Seite × Käufer, P0 = Pflicht)

| Seite | Enterprise | Behörde | Investor | Vorhanden? |
|---|---|---|---|---|
| Platform-Overview | P0 | P0 | P0 | ❌ fehlt als Single Surface |
| Architektur / How-it-works | P0 | P1 | P0 | 🟡 Komponenten (`ArchitectureDiagram`, `GovernanceArchitectureSection`) ungenutzt |
| Security & Trust Center | P0 | P0 | P1 | 🟡 `/security`, `/trust` existieren, unverlinkt in Nav |
| Compliance / Frameworks | P0 | P0 | P1 | 🟡 `/ai-act`, `/legal/compliance-matrix`; BSI/NIS2/KRITIS fehlen |
| Evidence / Audit | P0 | P0 | P1 | 🟡 `/evidence`, `evidence-vault-export`; Story nicht erzählt |
| Rollen / Use Cases | P1 | P0 | P2 | 🟡 Niche-Landings + `PersonaCardsSection` ungenutzt |
| Integrations / API | P0 | P2 | P1 | ✅ `/integrations`, `/api`, `/developers` |
| Souveränität / Hosting | P1 | **P0** | P1 | ✅ `/settings/ai-residency`, On-Prem; öffentlich schwach |
| Pricing / Editions | P1 | P1 | P1 | ✅ `/pricing` (6 Tiers) |
| Trust-Signale (Status/Changelog/Cert) | P1 | P0 | P2 | 🟡 `/status`, `/changelog`; Zertifikate fehlen |

---

## 3. Aufgabe 2 — Plattform-Reorganisation (Zielhierarchie Ebene 1–9)

Die geforderte 9-Ebenen-Hierarchie wird auf konkrete Routen/Komponenten gemappt. **Grün = baubar mit vorhandenen Assets, Rot = Lücke.**

| Ebene | Inhalt | Ziel-Surface | Vorhandene Bausteine | Lücke |
|---|---|---|---|---|
| **1 Mission** | Warum die Plattform existiert | Homepage-Hero `/` | `HeroSection.tsx` (Runtime-first Copy vorhanden) | Hero auf `/` ist die falsche Variante |
| **2 Problem** | Risiken ohne Governance: DSGVO, AI Act, Vendor-Risk, Shadow AI, Doku-Aufwand | Homepage Abschnitt 2 | `ConsentLimitsSection`, `LiveFindingsSection`, `OutcomeBulletsSection` | Shadow-AI/Vendor-Risk-Problem nicht explizit auf `/` |
| **3 Lösung** | Governance Runtime: Detect · Monitor · Govern · Automate | `/` + `/runtime` | `RuntimeCanvasSection`, `SystemLevelGovernanceSection` | „Detect/Monitor/Govern/Automate" als 4-Wort-Modell nicht verankert |
| **4 Architektur** | Scanner → Policy Engine → Runtime → Evidence Chain → Audit Layer | neue `/platform` + `/runtime` | `ArchitectureDiagram.tsx`, `GovernanceArchitectureSection`, `ScannerTechStackSection`, `PolicyEngineSection` | keine zusammenhängende Architektur-Seite |
| **5 Compliance** | DSGVO · AI Act · NIS2 · Vendor Governance | `/compliance` (neu) | `/ai-act`, `/legal/compliance-matrix`, `AiActGovernancePage` | **NIS2/BSI/KRITIS-Mapping fehlt** |
| **6 Evidence** | Nachweis · Audit-Trail · Signaturen · Export · Versionierung | `/evidence` + `/evidence-vault` | `EnterpriseEvidenceVaultSection`, `EvidenceVaultPreview`, `evidence-vault-export`, `evidence.ts` | qualifizierte Signatur (eIDAS), Ledger-Anchoring fehlen |
| **7 Rollen** | DSB · Compliance Officer · CTO · Agenturen · Behörden | `/solutions` (neu) | `PersonaCardsSection`, Niche-Landings, `PublicSectorLanding` | nicht in Nav, kein Rollen-Hub |
| **8 Security** | Hosting · Verschlüsselung · Isolation · RLS · Tenant-Separation | `/security` + `/trust` | `TechSecuritySixtySecondsSection`, `TrustCertificationsSection`, `GovernanceTrustSection` | Zertifikate/Pen-Test-Nachweis fehlen |
| **9 Pricing** | Editions, Sales-led Enterprise | `/pricing` | `src/config/pricing.ts` (6 Tiers) | Enterprise-Edition-Story dünn |

**Empfohlene Seiten-Konsolidierung:**
- **Neu bauen:** `/platform` (Overview, Ebene 3+4), `/solutions` (Rollen-Hub, Ebene 7), `/compliance` (Framework-Hub, Ebene 5).
- **Aufwerten:** `/` (komplette Story), `/security` + `/trust` zu einem **Trust Center** zusammenführen, `/evidence` zur Evidence-Story ausbauen.
- **Bestand halten, aber aus Hauptnav nehmen:** 8 Competitor-Alternative-Seiten, SEO-Doorways, Niche-Verticals → unter `/solutions` und Footer (SEO-Wert bleibt, Nav bleibt sauber).

---

## 4. Aufgabe 5 — Navigation Redesign (max. 7 Punkte)

### 4.1 Ist-Zustand (`src/components/Navbar.tsx`)

`Runtime` · `AI Act` · `Preise` · `Doku` + CTA „Run Scan". → Liest sich wie ein Tool, nicht wie ein Betriebssystem. Kein Pfad zu Security, Architektur, Rollen, Compliance, Evidence.

### 4.2 Soll-Navigation (7 Punkte, Kategorie-Sprache)

| # | Label | Ziel | Dropdown / Inhalt |
|---|---|---|---|
| 1 | **Plattform** | `/platform` | Übersicht · Runtime · Scanner · Policy Engine · Agent Layer · Evidence Chain (= `governance-os-blueprint` Loop) |
| 2 | **Lösungen** | `/solutions` | Nach Rolle: DSB · Compliance Officer · CTO/CISO · Agenturen · **Behörden** — nach Regulierung: DSGVO · AI Act · NIS2 |
| 3 | **Compliance** | `/compliance` | DSGVO · EU AI Act · NIS2 · Vendor Governance · Framework-Matrix |
| 4 | **Evidence & Audit** | `/evidence` | Evidence Vault · Audit-Trail · Export · Signaturen · Versionierung |
| 5 | **Security & Trust** | `/trust` | Hosting (EU/On-Prem) · Verschlüsselung · RLS/Tenant-Isolation · Sub-Prozessoren · Statuspage · Zertifizierungs-Roadmap |
| 6 | **Ressourcen** | `/resources` | Docs · API · Changelog · Blog · Case Studies · Tools-Hub |
| 7 | **Preise** | `/pricing` | Editions; Enterprise = „Sales kontaktieren" |

**CTAs (rechts):** primär „Demo anfragen" / „Pilot starten" (Enterprise-konform) — sekundär „Kostenloser Audit" (Lead-Funnel bleibt, aber nicht mehr als einziger CTA). Der heutige „Run Scan"-CTA suggeriert Tool-Niveau und wird in den Sekundär-Slot verschoben.

**15-Sekunden-Test:** Plattform (Was) → Compliance/Lösungen (Warum) → Plattform/Architektur (Wie) → Security & Trust (Warum vertrauenswürdig). Erfüllt.

---

## 5. Aufgabe 6 — Landingpage Redesign (`/`)

Vollständige Neukomposition. **Alle genannten Sektionen existieren bereits als Komponenten in `src/components/sections/`** — die Arbeit ist Komposition + Copy, nicht Neubau.

| # | Abschnitt | Überschrift | Unterüberschrift | Kernbotschaft | CTA | Komponente |
|---|---|---|---|---|---|---|
| 1 | **Hero** | „Die Governance-Runtime für KI und Websites." | „Kontinuierlich. EU-souverän. Auditfähig." | Wir messen, versionieren und beweisen den regulatorischen Zustand Ihrer Systeme in Echtzeit. | Demo anfragen / Audit starten | `HeroSection` |
| 2 | **Problem** | „Ohne Runtime ist Compliance ein Schnappschuss." | „DSGVO, AI Act, Vendor-Risk und Shadow AI ändern sich täglich — Ihre Doku nicht." | Manuelle Audits veralten in dem Moment, in dem das PDF gespeichert wird. | „Risiken sehen" | `ConsentLimitsSection` + `OutcomeBulletsSection` |
| 3 | **Lösung** | „Detect · Monitor · Govern · Automate." | „Vier Funktionen, ein kontinuierlicher Loop." | Jedes Business-Event wird zum Governance-Event mit Evidence, Severity und Remediation. | „Wie es funktioniert" | `SystemLevelGovernanceSection` |
| 4 | **Runtime / Architektur** | „Website → Scanner → Policy Engine → Runtime → Evidence Chain → Audit Bundle." | „Server-seitige Telemetrie, kein Snapshot." | Die Runtime ist der Kern — nicht das Dashboard. | „Architektur ansehen" | `ArchitectureDiagram` + `GovernanceArchitectureSection` + `PolicyEngineSection` |
| 5 | **Governance Layer** | „DSGVO. AI Act. NIS2. Ein Modell." | „Ein Event beweist mehrere Frameworks gleichzeitig." | Policy-as-Code mappt Artikel auf Laufzeit-Checks. | „Frameworks ansehen" | `GovernanceAgentsSection` + `AgentOversightSection` |
| 6 | **Evidence Layer** | „Kein Claim ohne Hash." | „Append-only, deterministisch, exportierbar." | Hash-Chain-Evidence (SHA-256) + Audit-Bundle für Behörde und DSB. | „Evidence-Beispiel" | `EnterpriseEvidenceVaultSection` + `EvidenceVaultPreview` |
| 7 | **Security** | „EU-souverän by default." | „Frankfurt-Hosting, On-Premise-Option, RLS-Tenant-Isolation." | Service-Role nur in Edge Functions, Per-Tenant-Datenresidenz. | „Trust Center" | `TechSecuritySixtySecondsSection` + `TrustCertificationsSection` |
| 8 | **Rollen** | „Für DSB, CISO, Agenturen und Behörden." | „Ein Betriebssystem, fünf Blickwinkel." | Rollenbasierte Sichten statt One-size-fits-all. | „Ihre Rolle" | `PersonaCardsSection` |
| 9 | **Pricing** | „Editions vom Free Audit bis Enterprise." | „Self-serve bis Sales-led." | Transparent, EU-Billing, kein Lock-in. | „Preise ansehen" | `PricingTeaserSection` |
| 10 | **CTA** | „Starten Sie mit einem Scan — skalieren Sie zur Runtime." | „In zwei Minuten der erste Report, in einem Quartal die Runtime." | Funnel-Brücke vom Lead zum Enterprise-Pilot. | Demo anfragen / Audit starten | `AuditCTA` |

**Regel:** Hero-Copy aus `positioning-v1 §6` übernehmen (dort als ✅ markiert: „AI Governance Runtime for EU privacy and AI Act"). Die agenturlastige Copy aus `Landing.tsx` wird nach `/fuer-agenturen` verschoben — dort ist sie korrekt.

---

## 6. Aufgabe 7 — Positionierung

### 6.1 Bewertung der Optionen

| Option | Stärke | Schwäche | Eignung Enterprise/Gov |
|---|---|---|---|
| A) „Governance Runtime für Agenturen" | klare Nische, heutiger Stand | deckelt bei Agentur-Budget; Behörde fühlt sich nicht angesprochen; widerspricht `PRODUCT_FOCUS` | ⛔ niedrig |
| B) „Compliance Operating System" | OS-Frame = Kategorie | „Compliance" zu eng (positioning-v1 §2 verbietet Compliance-Lead); kein KI-Bezug | 🟡 mittel |
| C) **„Governance Operating System für KI und Websites"** | OS-Frame + KI (AI-Act-Driver 2026) + Websites (Scanner-Erbe); deckt beide Asset-Klassen | etwas länger | ✅ **hoch** |
| D) „EU Governance Runtime" | Souveränität als Lead — stark für Behörde | „Runtime" allein erklärt den Nutzen nicht; KI fehlt | 🟡 mittel-hoch |
| E) „Continuous Compliance Platform" | etablierte Analyst-Kategorie | „Platform" < „OS"; austauschbar mit Vanta/Drata | 🟡 mittel |

### 6.2 Empfehlung

> **Primär: „Governance Operating System für KI und Websites" (Option C).**
> **Souveränitäts-Modifikator: „EU-native" / „EU-souverän" als ständiger Zusatz (Option D als Attribut, nicht als Lead).**

**Begründung:**
1. **Konsistent mit der eigenen SSOT.** `PRODUCT_FOCUS.md` sagt wörtlich „Realtime Governance Runtime" und Kategorie „Datadog/ServiceNow"; `governance-os-blueprint.md §2` sagt „RealSyncDynamics.AI is the operating system for AI and privacy governance. Not a dashboard. Not a document mill. An OS." Option C ist die **externe Sprache für die bereits getroffene interne Entscheidung**.
2. **„OS" schlägt „Platform"/„Tool" im Enterprise-Framing.** Ein OS besitzt Control-Plane, Data-Plane, Evidence — genau die Drei-Plane-Trennung des Blueprints. Das rechtfertigt Enterprise-Preise und Behörden-Vertrauen.
3. **„für KI und Websites" hält beide Asset-Klassen.** Der AI Act ist der Driver 2026 (Behörden-KI = High-Risk); „Websites" bewahrt das Scanner-Erbe und den Lead-Funnel. Kein Pivot, der bestehende SEO/Tools entwertet.
4. **„EU-souverän" ist der Behörden-Türöffner**, aber laut positioning-v1 §3 ein Differentiator, **kein Lead** — also als Attribut, nicht als Headline-Kategorie.

**Verbotene Worte beachten:** Headline nie mit „Compliance-Plattform" / „DSGVO-Tool" führen (positioning-v1 §3 hard-fail).

---

## 7. Aufgabe 8 — Technische Architekturdarstellung

### 7.1 Soll-Diagramm (Besucher-tauglich)

```
   [ Website / KI-System / Agent ]
                │  Telemetrie (Browser · Server-SDK · Connector)
                ▼
        ┌───────────────┐
        │    SCANNER    │  Cookie/Tracker/Vendor-Discovery, Shadow-AI-Erkennung
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │ POLICY ENGINE │  Regel-/Policy-Auswertung → allow · warn · approve · block
        └───────┬───────┘
                ▼
        ┌─────────────────────┐
        │ GOVERNANCE RUNTIME  │  Event-Bus · Risk-Score · Agent-Layer · Remediation
        └───────┬─────────────┘
                ▼
        ┌───────────────┐
        │ EVIDENCE CHAIN│  SHA-256 über kanonisches JSON, append-only, versioniert
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │  AUDIT BUNDLE │  Export (PDF + signiertes JSON), DSGVO Art. 30 / AI-Act Annex IV
        └───────────────┘
```

Diese Kette ist exakt der Loop aus `governance-os-blueprint.md §2.1` (DISCOVER→…→EVIDENCE) in besucherfreundlicher Linearform.

### 7.2 Bewertung: Kommuniziert die heutige Oberfläche diese Architektur?

**Nein — Bewertung 3/10.**
- `ArchitectureDiagram.tsx` und `GovernanceArchitectureSection.tsx` existieren, sind aber auf `/` **nicht eingebunden**.
- Die Route `/runtime` zeigt Teile, ist aber nur über einen von 4 Nav-Punkten erreichbar und nicht als „so funktioniert das System" gerahmt.
- Ein Besucher auf `/` sieht „Score 38/100, 8 Findings, Report-PDF" — also den **Output eines Scanners**, nicht die **Runtime-Architektur**. Die Kausalkette Website→Evidence bleibt unsichtbar.
- **Fix:** Diagramm als Abschnitt 4 der neuen Homepage (siehe §5) + eigene `/platform`-Seite. Aufwand niedrig, Komponenten vorhanden.

---

## 8. Aufgabe 4 — GovTech Gap-Analyse

Status direkt aus dem Code verifiziert (Routen, `supabase/functions/`, `supabase/migrations/`, `src/rules/`).

| # | Bereich | Status | Evidenz / Lücke |
|---|---|---|---|
| 1 | **BSI Mapping (IT-Grundschutz / C5)** | 🟡 **nur Referenz** | in `src/config/seo.ts` benannt; generischer `framework_controls`-CUSTOM-Slot vorhanden, aber **kein BSI-C5-Kriterienkatalog seeded**, kein Mapping-Modul |
| 2 | **NIS2 Mapping** | 🟡 **Schale** | `public.framework_controls` mit `framework='NIS2'` seeded; Typ in `src/types/governance/legal.ts` — aber **keine NIS2-Evaluationslogik** |
| 3 | **KRITIS Mapping** | ❌ **fehlt** | keine Tabelle/Function/Implementierung (nur Marketing-Erwähnung) |
| 4 | **TOM Generator** | ✅ **vorhanden** | `generate-document` erzeugt `tom`-Dokumenttyp; `/tom-generator` → `TomGenerator.tsx`; Migration `20260508030000_generated_documents.sql` |
| 5 | **Risiko-Register** | ✅ **vorhanden (Basis)** | `public.asset_risk_history` + `governance_assets.risk_score` (0–100) + `asset_control_mappings` (gap/in_progress/implemented); `governance-risk-score`. **Lücke:** versioniertes Register mit Treatment-Plan/Owner |
| 6 | **Compliance Dashboard** | 🟡 **UI ja, Backend dünn** | `GovernanceDashboardView` + `ComplianceReportView` existieren; laut Inventar **keine vereinheitlichte Aggregations-/Metrik-Schicht** im Backend |
| 7 | **KI-Inventar** | ✅ **vorhanden** | `public.enterprise_ai_system_registry` (name, provider, model, `risk_level`, `contains_personal_data/sensitive_data`); Migration `20260513300000_enterprise_ai_os.sql`. **Lücke:** automatische Shadow-AI-Discovery (Blueprint) |
| 8 | **AI Act Register** | ✅ **vorhanden (Basis)** | `governance_assets.ai_act_class` (minimal/limited/high/prohibited/unknown) + `ai-act-classify` (LLM-Annex-III-Matcher); **Lücke:** Obligation-Tracking + Annex-IV-Generierung |
| 9 | **DSFA-Generator (DPIA)** | ✅ **vorhanden** | `public.dpias` (draft→in_review→approved, `dpo_consulted`); `governance-dpias`; `/dsfa-wizard` + `/governance/dpias` |
| 10 | **FRIA-Generator** | ❌ **fehlt** | „FRIA" nur als Label in `src/rules/annex-iii.json:547`; keine Tabelle/Function/Workflow (AI Act Art. 27 Pflicht für High-Risk!) |
| 11 | **Incident Register** | ✅ **vorhanden** | `public.incidents` (`notification_deadline_at`, Risk-Klassifikation); `governance-incidents`; `/governance/incidents` |
| 12 | **Supplier/Vendor Register** | ✅ **vorhanden** | `public.vendors` (`dpa_status`) + `asset_vendor_links`; `/governance/vendors`; zusätzlich `/operations/suppliers` (`inventory_suppliers`) |
| 13 | **Audit Register** | ✅ **vorhanden (Basis)** | `public.audit_logs` (Prüfpfad, append-only) + `audit_events` + `enterprise_ai_audit_events`; `/governance/auditor`, `/governance/admin-log`, `tenant-audit`. **Lücke:** formaler Auditplan/-zyklus |

**Zusätzlich geprüft (Substanz vorhanden):** Continuous Monitoring (`monitored_domains`, `audit_monitor_results` mit Drift, `audit-monitor-cron`/`audit-recheck-weekly`) ✅ · Evidence Chain (`evidence.ts` SHA-256, `audit_evidence` append-only, `evidence-vault-export`) ✅ · **C2PA/Herkunftsnachweis** (`c2pa_assets`, `provenance_records.c2pa_manifest_uri`) ✅ · DSR-Tracker (`public.dsr_requests`, `/governance/dsr`) ✅ · Multi-Tenant-RLS (120+ Tabellen) ✅ · Datenresidenz/EU-Verschlüsselung (AES-256 at rest, TLS 1.3, Frankfurt, `/settings/ai-residency`) ✅. **Bonus-Frameworks** in `framework_controls`: ISO 27001, SOC 2, **DORA** (geseedet, Evaluationslogik offen).

**Die kritischen Behörden-Lücken (P-relevant):** **KRITIS** (fehlt ganz), **FRIA** (fehlt ganz — AI-Act-Pflicht für High-Risk-Behörden-KI, exakt der Bereich, den `PublicSectorLanding.tsx` bereits bewirbt), sowie **NIS2 + BSI C5** (nur Schale/Referenz, keine Evaluationslogik/Korpus). Diese vier sind die eigentliche Government-Readiness-Bremse — nicht die Kernarchitektur, die für DSGVO/AI-Act bereits trägt.

---

## 9. Aufgabe 3 — Readiness Scorecard

Bewertung 0–10 aus Sicht Enterprise-Käufer + Compliance Officer + öffentlicher Auftraggeber. Honest, nicht beschönigt.

| Bereich | Score | Begründung | Schwächen | Handlungsempfehlung |
|---|---|---|---|---|
| **Enterprise Readiness** | **6** | Multi-Tenant, RBAC, Billing, Audit-Log, ~25 Governance-Views, API/SDK real | Öffentliche IA verkauft Tool-Niveau; kein SSO/SAML/SCIM sichtbar; keine Edition-Story | Homepage+Nav (P0); SSO/SAML auf Enterprise-Edition-Roadmap (P1) |
| **Government Readiness** | **4** | EU-Hosting, On-Prem-Option, `PublicSectorLanding` adressiert OZG/BFSG/High-Risk korrekt | BSI C5/Grundschutz, KRITIS, formales NIS2 fehlen; keine Procurement-Artefakte (EVB-IT, Referenzen); BITV nur behauptet | BSI-C5/NIS2-Mapping (P1); BITV-Audit nachweisen (P1); Procurement-Paket (P2) |
| **AI Act Readiness** | **6** | Classifier (`ai-act-classify`), Annex-III-Regeln, DPIA, Obligation-Konzept im Blueprint detailliert | **FRIA fehlt** (Art. 27); Annex-IV-Generierung Blueprint-Stadium; GPAI-Pflichten offen | FRIA-Generator (P1); Annex-IV-Report aus Live-State (P1) |
| **DSGVO Readiness** | **7** | VVT, DSFA, DSR-Tracker, AVV, Sub-Prozessoren, Art.15/17, Meldepflicht-Timer — breit abgedeckt | Risikoregister nicht formalisiert; Lösch-/Aufbewahrungsfristen-Automatik teilweise | Risikoregister-Schema (P2); Retention-Engine (P2) |
| **Security Readiness** | **6** | RLS, EU-Hosting, Residency-Routing, Service-Role-Isolation, Sub-Prozessoren dokumentiert | Keine öffentlichen Zertifikate (SOC2/ISO 27001/BSI C5), kein Pen-Test-Nachweis, kein SSO | Zertifizierungs-Roadmap öffentlich (P1); Pen-Test beauftragen+veröffentlichen (P1) |
| **Evidence Readiness** | **7** | Hash-Chain (SHA-256/kanonisches JSON), Evidence-Vault-Export, Audit-Log als SoT | Kein Ledger-Anchoring, keine qualifizierte eIDAS-Signatur, Langzeit-Archiv-Retention offen | eIDAS-Signatur für Audit-Bundle (P1); Ledger-Anchoring (P2, Phase 4) |
| **Platform Governance** | **6** | RBAC-Rollen (owner/admin/dpo/dev/auditor), Approval-Workflows, Admin-Log, Agent-Registry | ABAC, vollständiger Agent-Runtime, Policy-as-Code (Rego) noch Blueprint | ABAC + Policy-as-Code aus Blueprint priorisieren (P2) |

**Gesamtbild:** Durchschnitt ≈ **6,0/10**. Substanz solide, **Government-Readiness (4) ist der Ausreißer nach unten** und gleichzeitig der größte adressierbare Markt-Hebel. Die niedrigste *vermeidbare* Bewertung ist nicht technisch, sondern **Präsentation** — Homepage/Nav drücken den wahrgenommenen Enterprise-Score weit unter den tatsächlichen Code-Stand.

---

## 10. Konkrete Änderungsliste nach Priorität (P0–P3)

### P0 — sofort, niedriger Aufwand, höchste Wirkung (Präsentation)

| # | Änderung | Datei(en) | Begründung |
|---|---|---|---|
| P0-1 | Homepage `/` aus vorhandenen `sections/`-Komponenten neu komponieren (10-Abschnitt-Story §5) | `src/pages/Landing.tsx`, `src/components/sections/*` | Story existiert als Code, ist nur nicht verdrahtet |
| P0-2 | Hero-Copy von Agentur- auf Governance-OS-Framing (Option C) anheben | `src/pages/Landing.tsx` / `HeroSection.tsx` | positioning-v1 §6 fordert Runtime-Lead |
| P0-3 | Hauptnavigation auf 7 Kategorie-Punkte umstellen (§4.2) | `src/components/Navbar.tsx` | 15-Sekunden-Verständnis für Enterprise/Gov |
| P0-4 | `ArchitectureDiagram` + `GovernanceArchitectureSection` auf `/` einbinden | `src/pages/Landing.tsx` | Architektur-Kommunikation 3/10 → behoben |
| P0-5 | Agentur-Copy nach `/fuer-agenturen` verschieben (nicht löschen) | `src/pages/niche/AgenturenLanding.tsx` | Nische bleibt bedient, Homepage wird Kategorie-Surface |

### P1 — kurzfristig, mittlerer Aufwand (Substanz + Trust)

| # | Änderung | Bereich | Begründung |
|---|---|---|---|
| P1-1 | Seiten `/platform`, `/solutions`, `/compliance` neu bauen (Ebenen 3/4/5/7) | neue Routen | fehlende Pflicht-Seiten aus Benchmark §2.1 |
| P1-2 | `/security` + `/trust` zu einem **Trust Center** mit Zertifizierungs-Roadmap zusammenführen | `src/pages/Security.tsx`, `Trust.tsx` | Procurement-/Behörden-Pflicht |
| P1-3 | **FRIA-Generator** bauen (AI Act Art. 27) — analog `DsfaWizard` | neue Function + Wizard | High-Risk-Behörden-KI-Pflicht, heute Lücke |
| P1-4 | **NIS2-Control-Set** + Mapping-Modul | `src/rules/`, Governance-View | Behörden-/KRITIS-Tür |
| P1-5 | Annex-IV-Report aus Live-Graph generieren (Blueprint §5.4) | `evidence-vault-export` erweitern | AI-Act-Nachweis materialisieren |
| P1-6 | eIDAS-qualifizierte Signatur für Audit-Bundle | `evidence-export` | Evidence-Readiness 7 → 8 |
| P1-7 | Zertifizierungs-Roadmap (SOC2/ISO 27001/BSI C5) + Pen-Test öffentlich | Trust Center | Security-Readiness 6 → 8 |

### P2 — mittelfristig (Government-Markt erschließen)

| # | Änderung | Begründung |
|---|---|---|
| P2-1 | **BSI C5 / IT-Grundschutz-Mapping** | größte Gov-Readiness-Lücke (4/10) |
| P2-2 | **KRITIS-Modul** (Sektoren, Meldepflichten §8b BSIG) | KRITIS-Betreiber als Käufersegment |
| P2-3 | Formalisiertes **Risikoregister** (versioniert, RLS) | DSGVO/ISO-Erwartung |
| P2-4 | **SSO/SAML/SCIM** für Enterprise-Edition | Enterprise-Deal-Breaker |
| P2-5 | Procurement-Paket (EVB-IT-Bausteine, Referenz-Architektur, On-Prem-Lizenzmodell) | Behörden-Beschaffung |
| P2-6 | BITV/BFSG-Barrierefreiheit auditieren + Nachweis | heute behauptet, nicht belegt |

### P3 — langfristig (Kategorie-Führung, aus Blueprint)

| # | Änderung | Quelle |
|---|---|---|
| P3-1 | Policy-as-Code (YAML→Rego/OPA) produktiv | `governance-os-blueprint §4` |
| P3-2 | ABAC zusätzlich zu RBAC | Blueprint §3.1 |
| P3-3 | Vollständiger Agent-Runtime-Fleet (10 Agenten) | Blueprint §6 |
| P3-4 | Governance-Graph (Postgres + Apache AGE) | Blueprint §3.3 |
| P3-5 | Evidence-Ledger-Anchoring + Langzeit-Archiv | Blueprint §8, ROADMAP Phase 4 |
| P3-6 | Regulatory-Change-Agent (NIS2/AI-Act-Diffs automatisch) | Blueprint §6.1.4 |

---

## 11. Schlussbefund für die drei Käufer-Linsen

- **Enterprise-Käufer (CTO/CISO):** „Die Architektur ist da, ich finde sie nur nicht. Verdrahtet die Homepage und gebt mir SSO + ein Trust Center — dann ist das ein ernstes Betriebssystem." → P0 + P1-2/P1-7 + P2-4.
- **Compliance Officer (DSB):** „DSGVO-Tiefe überzeugt (VVT/DSFA/DSR/AVV). AI Act fast — aber **FRIA fehlt** und Annex-IV muss generierbar sein. Risikoregister formalisieren." → P1-3/P1-5 + P2-3.
- **Öffentlicher Auftraggeber:** „EU-Souveränität und On-Prem sind das richtige Fundament. Ohne **BSI C5, NIS2-Mapping, KRITIS und belegte BITV** ist eine Beschaffung schwer begründbar." → P1-4/P1-7 + P2-1/P2-2/P2-5/P2-6.

**Eine Botschaft:** Der teuerste Fehler ist nicht ein fehlendes Feature — es ist, dass eine Government-grade Runtime sich öffentlich wie ein Cookie-Scanner verkauft. **P0 ist fast gratis und hebt den wahrgenommenen Reifegrad sofort.**

---

*Erstellt 2026-05-30 · Grundlage: direkte Code-Verifikation (Routen, Edge Functions, Migrations, Rules, Sektions-Komponenten) · konsistent zu positioning-v1, PRODUCT_FOCUS, governance-os-blueprint.*
