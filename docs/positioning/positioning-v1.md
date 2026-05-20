# Positioning v1 — Runtime-native AI Governance

**Status:** Active
**Owner:** Founder / Product
**Last updated:** 2026-05-20
**Companion to:** `runtime-event-standard.md`, `evidence-graph-rfc.md`, `runtime-event-shadow-validation-rfc.md`

Single Source of Truth für Marketing-, SEO- und Sales-Copy. Code-Copy (Hero, Pricing-Page, Legal-Pages) muss konsistent zu diesem RFC sein.

---

## 1. Was wir sind

**Technische Beschreibung (technische Audience, Investoren, Enterprise-Tech-Buyers):**

> RealSyncDynamics.AI ist eine Runtime-native AI-Governance-Plattform, die Browser-, Netzwerk- und AI-Systeme kontinuierlich analysiert, regulatorische Risiken erkennt und auditfähige Evidenzketten erzeugt.

**Marktpositionierung (eine-Zeile-Pitch):**

> Ein europäisches B2B-SaaS-Scale-up im Bereich AI Governance, Continuous Compliance und Evidence Infrastructure.

**Strategische Langzeitvision:**

> Nicht nur Compliance dokumentieren — sondern regulatorische Zustände von AI- und Web-Systemen in Echtzeit messen, versionieren und beweisen.

---

## 2. Was wir NICHT sind

Wer in diesen Kategorien sucht, ist nicht primär unser Markt:

- ❌ „Ein DSGVO-Tool" — zu klein gedacht, falsch positioniert
- ❌ Klassischer Consent-Manager (Cookiebot, Usercentrics) — wir sind eine Ebene tiefer (Telemetrie + Evidence)
- ❌ Statisches Audit-Tool / PDF-Generator — wir liefern continuous runtime, nicht Snapshot
- ❌ GRC-Dashboard / Document-Management-System — wir erzeugen Evidence, nicht Dokumente
- ❌ Anwalts-/Beratungs-Ersatz — wir liefern die technische Grundlage, Human Review bleibt

---

## 3. Vokabular — was wir sagen

### Lead-Begriffe (verwenden)

| Begriff | Context |
|---|---|
| **Runtime** | Kern-Token. Code- und Surface-Pflicht. Beispiele: „Governance Runtime", „Runtime-native", „Compliance Runtime" |
| **Evidence** | Was wir produzieren. Beispiele: „Evidence Graph", „Evidence Vault", „auditfähige Evidenz", „kryptografisch nachvollziehbare Evidenz" |
| **Policy** | Das Regelwerk. Beispiele: „Policy Engine", „Policy Evaluation", „policy.violation_detected" |
| **Drift** | Was wir erkennen. Beispiele: „Drift-Detection", „Konfigurations-Drift" |
| **AI Governance** | Marktkategorie. Lead vor „DSGVO" / „Compliance" |
| **Continuous Compliance** | Abgrenzung zu Snapshot-Audits |
| **Telemetrie** | Was wir messen. Browser-, Netzwerk-, AI-Telemetrie |
| **Audit-fähig / audit-grade** | Quality-Anker |

### Sekundär-Begriffe (verwenden, aber nicht führend)

| Begriff | Context |
|---|---|
| DSGVO / TTDSG | Compliance-Frameworks. Konkret nennen, aber nicht als Marktkategorie führen |
| EU AI Act | Wichtigster Driver in 2026 — nennen, aber im Kontext der Architektur |
| EU-souverän / EU-Hosting | Differentiator, kein Lead |
| Audit-Trail | Konkretes Feature, OK |

### Verbotene Phrasen

| Verboten | Warum |
|---|---|
| ❌ „rechtssicher" | niemand kann das seriös versprechen — Promotion-Engine-Guardrail |
| ❌ „garantiert DSGVO-konform" / „100 % rechtssicher" | dito |
| ❌ „Bußgeld droht" | Fear-Sells schaden Marke langfristig |
| ❌ „DSGVO-Tool" / „Cookie-Tool" / „Compliance-Plattform" als Lead | zu klein gedacht, falsche Marktkategorie |
| ❌ „Anwalts-Ersatz" / „ersetzt Rechtsberatung" | rechtliches Eigentor |
| ❌ „vollautomatisch rechtlich geprüft" | Vermischung Technik/Recht |

---

## 4. Drei-Ebenen-Modell

### Ebene 1 — Technische Beschreibung

Adressat: CTO, Tech-Buyers, Enterprise-Architekten, Investoren.

> RealSyncDynamics.AI ist eine Runtime-native AI-Governance-Plattform, die Browser-, Netzwerk- und AI-Systeme kontinuierlich analysiert, regulatorische Risiken erkennt und auditfähige Evidenzketten erzeugt.

### Ebene 2 — Marktpositionierung

Adressat: Sales-Decks, Investor-One-Pager, Press.

> Ein europäisches B2B-SaaS-Scale-up im Bereich AI Governance, Continuous Compliance und Evidence Infrastructure.

### Ebene 3 — Strategische Langzeitvision

Adressat: Strategie-Diskussionen, Mission-Statement, internes Alignment.

> Nicht nur Compliance dokumentieren — sondern regulatorische Zustände von AI- und Web-Systemen in Echtzeit messen, versionieren und beweisen.

---

## 5. Architektur-Verankerung

Die Positionierung ist nicht Marketing-Copy — sie ist die externe Sprache für eine intern bereits gebaute Architektur:

| Architektur-Baustein | PR | Was es ist |
|---|---|---|
| `RuntimeEvent` v0 (envelope + spec_version) | #373 | normalisierte Telemetrie-Schicht |
| Adoption Beachheads (mock + policy) | #374, #375 | erste Pfade in der gemeinsamen Sprache |
| Shadow-Validation RFC | #376 | non-rejecting validation rollout |
| Evidence-Graph RFC v0 | #378 | causal governance history |
| Typed Evidence Layer v0 (Phase B1) | #379 | RuntimeEventNode → EvidenceNode → IncidentNode |

Die Vokabel-Linie `Runtime / Evidence / Policy / Drift / Audit-Bundle` zieht sich durch Code, Tests und RFCs hindurch konsistent. **Das Marketing darf jetzt nachziehen.**

---

## 6. Code-Surface-Adoption

Wo dieses Vokabular **im Repo aktiv ist** (Stand 2026-05-20):

| Surface | Status |
|---|---|
| Hero (`src/components/sections/HeroSection.tsx`) | ✅ Runtime-first: „This system is already running" + „AI Governance Runtime for EU privacy and AI Act" |
| `<title>` (`index.html`) | ✅ aktualisiert in diesem PR |
| `og:title` / `og:description` (`index.html`) | ✅ aktualisiert in diesem PR |
| `twitter:title` / `twitter:description` | ✅ aktualisiert in diesem PR |
| JSON-LD `Organization.description` (`index.html`) | ✅ aktualisiert in diesem PR |
| JSON-LD `SoftwareApplication.description` (`index.html`) | ✅ aktualisiert in diesem PR |
| Meta `keywords` (`index.html`) | ✅ Runtime/Evidence-Begriffe lead |
| Impressum-Tätigkeitsbeschreibung | ✅ 1:1 aus Gewerbeanmeldung 13.05.2026 — kompatibel mit Runtime-Lead |
| Pricing-Page Tagline | ⚠ noch DSGVO-lastig — Folge-PR |
| Footer-Copy | ⚠ uneinheitlich — Folge-PR |
| Niche-Landings (`/saas`, `/agencies`, `/praxen`) | ⚠ DSGVO-Lead — Folge-PR pro Page |
| SEO-Doorway-Pages (DataGuard-/OneTrust-/Usercentrics-Alternative) | ⚠ DSGVO-Lead beibehalten (Suchintent matcht — bewusste Ausnahme) |

---

## 7. Konsistenz mit der Gewerbeanmeldung

Die offizielle Tätigkeitsbeschreibung (Anlage zu GewA 1, Feld 18, registriert 13.05.2026) lautet:

> „Entwicklung und Betrieb von Software-as-a-Service (SaaS)-Lösungen im Bereich Datenschutz-, Compliance- und KI-Governance, insbesondere automatisierte Website- und Tracking-Analysen, DSGVO-/TTDSG-Compliance-Monitoring, technische Audit- und Reporting-Systeme sowie digitale Compliance-Tools. Erbringung von IT-Dienstleistungen, Softwareentwicklung und Bereitstellung webbasierter Analyse- und Monitoringplattformen."

Diese Beschreibung ist **rechtlich bindend** und steht 1:1 im Impressum (`src/features/legal/Impressum.tsx`, Sektion „Tätigkeitsschwerpunkte").

**Konflikt mit der Runtime-first-Positionierung?** Nein. Die Gewerbe-Beschreibung führt „DSGVO-/TTDSG-Compliance-Monitoring" und „KI-Governance" gleichwertig. Die externe Marketing-Positionierung darf den AI-Governance-Lead frei wählen — die Gewerbe-Tätigkeit deckt beides ab.

**Praktische Regel:** Im Impressum + AGB + Datenschutzerklärung → Gewerbe-Wortlaut. Auf jeder anderen Surface → Positioning-v1-Vokabular.

---

## 8. Sales-Anker („das nimmt Vertrauenshürden raus")

Bei Kanzleien, Agenturen oder Enterprise-Kunden funktioniert dieser Satz:

> „Wir haben Impressum, Datenschutz, AVV, Sub-Prozessoren und Speicherfristen sauber dokumentiert. Wir verkaufen Vertrauenswürdigkeit von AI-Systemen — mit Evidenz, Nachvollziehbarkeit und regulatorischer Reproduzierbarkeit."

Pfade im Repo, die das stützen:
- `/impressum` + `/legal/impressum` — §5 TMG sauber
- `/legal/privacy` — Datenschutzerklärung
- `/legal/avv` — AVV-Vorlage
- `/legal/sub-processors` — 8 Anbieter dokumentiert
- `/legal/compliance-matrix` — Methodology

---

## 9. Was diese RFC ausdrücklich NICHT festlegt

- ❌ Keine Pricing-Strategie (separate Entscheidung)
- ❌ Keine Vertikalisierungs-Strategie (HealthTech vs. FinTech vs. Agentur-Lead)
- ❌ Keine Niche-Landing-Copy (Folge-PRs pro Page)
- ❌ Keine Verträge / SLA-Templates
- ❌ Keine Investor-Pitch-Slides

Die RFC ist **Sprach-Disziplin**, nicht GTM-Strategie.

---

## 10. Erweitern / Bumpen

Wer ein neues Surface oder eine neue Copy-Variante in die Code-Base bringt:

1. **Lead-Begriff prüfen** — kommt „Runtime" / „Evidence" / „Policy" vor?
2. **Verbotene Phrasen scannen** — siehe § 3 — „rechtssicher" / „garantiert" / „Bußgeld droht" sind hard-fails
3. **Konsistent mit Impressum?** — Gewerbe-Wortlaut bleibt unangetastet
4. **Surface-Tabelle in § 6 erweitern** — neue Page → neue Zeile

Major-Bump (Positioning v2): nur bei strategischer Re-Positionierung (z. B. Pivot zu B2C oder zu reinem Infrastructure-Sell). Versions-Bumps sind Single-PR-Entscheidung, keine Marketing-Iteration.
