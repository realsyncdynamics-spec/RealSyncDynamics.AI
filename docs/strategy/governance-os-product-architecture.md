# RealSyncDynamics.AI — Produkt- & Workspace-Architektur (Redesign)

> **Status:** Architektur-Entwurf, 2026-05-30 · **Rolle:** Principal Product / UX / Platform Architect
> **Kein Code · keine Migration · keine Implementierung.** Reines Produkt- & Workspace-Design.
> **Ziel:** Von „Sammlung einzelner Compliance-Seiten" zu **„Betriebssystem für Governance, Compliance & AI Governance"**.

---

## A. Aktuelle Architektur (IST)

**106 Routen**, grob in 6 Welten — die sich heute **nicht** wie ein Produkt anfühlen, weil sie nebeneinander statt ineinander liegen:

| Welt | Beispiele (IST-Routen) | Problem |
|---|---|---|
| Marketing/Public (~55) | `/`, `/ai-act`, `/evidence`, `/runtime`, `/pricing`, Verticals, Competitor-Alternativen, SEO | Produkt-Sprache vermischt mit Verkauf |
| Tools (Free, ~9) | `/dsfa-wizard`, `/vvt-wizard` (via Tools), `/tom-generator`, `/avv-generator`, `/cookie-scanner`, `/ai-act-classifier`, `/datenschutz-generator`, `/meldepflicht-timer`, `/bussgeld-rechner` | Jedes Tool = eigene Insel, kein gemeinsamer Kontext |
| Governance-Suite (~14) | `/governance`, `/governance/{admin-log,agents,approvals,assets,auditor,dpias,dsr,incidents,reports,resources,runtime,vendors}` | Mächtig, aber als lose Unterseiten ohne Workspace-Rahmen |
| Dashboards (mehrfach) | `/dashboard` (Chat), `/command-center`, `/monitoring`, BusinessDashboard | **Drei konkurrierende „Home"** — kein kanonischer Einstieg |
| Settings (6) | `/settings`, `/settings/{account,ai-residency,api-keys,security,team}` | OK, aber Team/Security gehören in Workspace-Governance |
| Admin (RSD-intern, 6) | `/admin/*` | Korrekt getrennt |

### Schwächen (Kern-Diagnose)
1. **Kein kanonischer Post-Login-Ort.** `/dashboard` ist ein **Chat** (CreatorDashboard), nicht ein Governance-Überblick. Drei Dashboards konkurrieren.
2. **Kein persistenter App-Shell.** Jede Seite rendert ihren **eigenen** Voll-Header (`min-h-screen` + eigene Top-Bar) → kein durchgehendes Sidebar-Gerüst, kein „Ort"-Gefühl. Jede Navigation fühlt sich wie ein Seitenwechsel an, nicht wie ein Panel-Wechsel im selben Produkt.
3. **Objekt-Fragmentierung.** Eine **Website** existiert verstreut über cookie-scanner, monitoring, vendors, evidence, audit — nie als **ein Objekt mit allen Facetten**. Gleiches für **KI-Systeme** (agents, ai-act-classifier, dpias verstreut).
4. **Funktions- statt Objekt-Navigation.** Navigation führt zu *Werkzeugen* (DSFA-Wizard, TOM-Generator), nicht zu *Dingen, die man verwaltet* (diese Website, dieses KI-System, dieses Risiko).
5. **Risiken & Evidence haben kein Zuhause.** Findings entstehen überall, aber es gibt kein **Risiko-Center** und kein **Evidence-Center** als Sammelpunkt.
6. **Tools ≠ Produkt.** Die Free-Tools (stärkster Funnel) sind nicht als „Aktionen im Workspace" integriert, sondern als separate Marketing-Inseln.

---

## B. Warum sich ChatGPT/Claude/Grok/Notion/Linear/Datadog/Vanta/ServiceNow wie Produkte anfühlen

| Muster | Was es bewirkt | Bei uns heute |
|---|---|---|
| **Persistenter App-Shell** (Sidebar + Topbar bleiben, nur Panel wechselt) | „Ein Ort", nie Kontextverlust | ❌ jede Seite eigener Voll-Header |
| **Ein kanonischer Home-State** (Linear Inbox, Datadog Overview, Vanta Dashboard) | sofort „wo stehe ich?" | ❌ 3 konkurrierende Dashboards |
| **Objekt-zentriert** (Notion-Page, Linear-Issue, Datadog-Host, Vanta-Control) — jedes Ding hat **eine** Detailseite mit allen Facetten | man verwaltet *Dinge*, nicht *Menüs* | ❌ funktions-/seiten-zentriert |
| **Command/Quick-Action** (⌘K, „New") überall | Geschwindigkeit, Tiefe ohne Navigation | 🟡 nur Chat-Assistent |
| **Status-first** (Vanta/Datadog: Health/Score zuerst, Details on demand) | Vertrauen in 3 Sek | ❌ kein Status-Home |
| **Progressive Disclosure** (Übersicht → Liste → Objekt → Aktion) | nie überfordert | ❌ flache Seitenliste |
| **Konsistente Primitive** (überall gleiche Tabelle/Drawer/Filter) | „ein System" | 🟡 uneinheitlich |

**Was NICHT übernommen werden darf (bewusste Anti-Muster):**
- ❌ **ChatGPT-as-Home** (leeres Chatfenster als Startseite). Chat ist ein *Werkzeug im* Workspace, **nicht** der Workspace — Governance braucht Status, nicht einen Prompt. (Genau der heutige `/dashboard`-Fehler.)
- ❌ Grok/Consumer-Verspieltheit, ablenkende Animationen — Enterprise/Behörde will Ruhe & Nachvollziehbarkeit.
- ❌ Notion-„blank canvas/totale Flexibilität" — Governance braucht **opinionierte** Struktur, keine leere Seite.
- ❌ ServiceNow-Überladung (1000 Menüpunkte) — wir kürzen, nicht kopieren.

**Übernehmen:** Linear's Shell+Inbox-Klarheit · Datadog's Status-Overview · Vanta's Control/Evidence-Objektmodell · ⌘K-Command-Bar · objekt-zentrierte Detail-Drawer.

---

## C. Neue Architektur — „Governance OS"

### Leitprinzip: **Objekte, nicht Seiten.**
Der Nutzer verwaltet vier Objekt-Klassen — **Websites, KI-Systeme, Risiken, Evidence** — innerhalb **eines** persistenten Workspace. Alle bisherigen „Seiten" werden zu **Sichten auf diese Objekte** oder **Aktionen** darauf.

```
┌──────────────────────────────────────────────────────────────┐
│ Topbar:  [Tenant ▾]   ⌘K Command/Suche      [?] [Assistent] [◔]│
├────────────┬─────────────────────────────────────────────────┤
│ SIDEBAR    │  PANEL (wechselt — Shell bleibt)                 │
│            │                                                  │
│ 🏠 Übersicht│   ← Home-Dashboard (Status-first)               │
│ 🌐 Websites │   ← Objekt-Liste → Objekt-Detail-Drawer         │
│ 🤖 KI-Systeme│  ← Objekt-Liste → Objekt-Detail-Drawer         │
│ ⚠️ Risiken  │   ← Risiko-Center (aggregiert)                  │
│ 📋 Compliance│  ← Compliance-Center (DSGVO/AI Act/Register)    │
│ 📑 Evidence │   ← Evidence-Center                             │
│ 📊 Monitoring│  ← Live/Drift                                  │
│ ─────────── │                                                 │
│ 👥 Team     │   ← (P0b TenantAdminConsole)                    │
│ ⚙️ Einstellungen│                                             │
└────────────┴─────────────────────────────────────────────────┘
```

---

## D. Phase 1 — Bestandsanalyse: Modul → Soll-Position

| Modul/Seite (IST) | Zweck | Aktuelle Position | **Soll-Position** |
|---|---|---|---|
| CreatorDashboard (Chat) | KI-Assistent | `/dashboard` (= „Home"!) | **Assistent-Panel** (⌘K / Topbar), **nicht** Home |
| command-center | Ops-Übersicht | `/command-center` | → in **🏠 Übersicht** aufgehen |
| monitoring | Live/Drift | `/monitoring` | **📊 Monitoring** (+ pro Objekt eingebettet) |
| governance (Hub) | Governance-Start | `/governance` | → **🏠 Übersicht** ersetzt es |
| governance/assets | Asset-Liste | Unterseite | Quelle für **🌐 Websites** + **🤖 KI-Systeme** |
| governance/agents | KI-Registry | Unterseite | **🤖 KI-Systeme** (Liste) |
| governance/incidents | Vorfälle | Unterseite | **⚠️ Risiken** (Tab Incidents) |
| governance/dpias | DSFA | Unterseite | **📋 Compliance** › DSFA + im KI-Objekt |
| governance/dsr | Betroffenenrechte | Unterseite | **📋 Compliance** › DSR |
| governance/vendors | Vendor-Register | Unterseite | **⚠️ Risiken** › Vendoren + im Website-Objekt |
| governance/reports | Compliance-Report | Unterseite | **📑 Evidence** › Reports |
| governance/auditor | Auditor-Konsole | Unterseite | **📑 Evidence** › Auditor-Sicht |
| governance/admin-log | Prüfprotokoll | Unterseite | **📑 Evidence** › Audit-Trail (+ Team) |
| governance/approvals | Freigaben | Unterseite | **🏠 Übersicht** (Inbox) + Risiko/Compliance |
| governance/resources, runtime | Runtime/Resources | Unterseite | **📊 Monitoring** / Übersicht |
| dsfa-wizard, vvt-wizard, tom-generator, avv-generator, datenschutz-generator | Doku-Generatoren | Einzel-Tools | **📋 Compliance** › „Dokument erstellen" (Aktionen) |
| cookie-scanner, ai-act-classifier | Scanner/Classifier | Einzel-Tools | **Aktionen** auf Website-/KI-Objekt („Scan", „Klassifizieren") |
| meldepflicht-timer, bussgeld-rechner | Hilfs-Tools | Einzel-Tools | **⚠️ Risiken** (Timer) / Marketing (Rechner) |
| audit / audit/result | Free-Audit-Funnel | Public | Public bleibt; Ergebnis → „Website hinzufügen" in Workspace |
| settings/* | Konto/Billing/MFA/Residenz | `/settings/*` | **⚙️ Einstellungen** + **👥 Team** (security/team) |
| admin/* | RSD-intern | `/admin/*` | bleibt getrennt (interne Konsole) |
| Marketing/Verticals/Competitor/SEO | Akquise | Public | bleibt Public (außerhalb Workspace) |

---

## E. Phase 2 + 4 — Governance Workspace & Home-Dashboard (🏠 Übersicht)

**Nach Login landet der Nutzer auf `/app` = 🏠 Übersicht** (nicht Chat, nicht Einzelseite). Status-first, in 3 Sekunden erfassbar:

| Kachel | Inhalt | Quelle (vorhanden) | Klick-Ziel |
|---|---|---|---|
| **Compliance-Status** | Gesamt-Score 0–100 + Trend + DSGVO/AI-Act-Ampel | governance_assets.risk_score, reports | 📋 Compliance |
| **Offene Risiken** | Anzahl nach Severity (kritisch/hoch/…) | findings, incidents, risk-score | ⚠️ Risiken |
| **Kritische Findings** | Top 3–5 nach Schwere, mit Objektbezug | findings | Objekt-Detail |
| **Websites** | Anzahl + schlechteste Scores | monitored_domains, scans | 🌐 Websites |
| **KI-Systeme** | Anzahl + High-Risk-Count | enterprise_ai_system_registry | 🤖 KI-Systeme |
| **Evidence-Status** | versiegelte Nachweise + letzter Export | audit_evidence, evidence-export | 📑 Evidence |
| **Monitoring-Status** | aktiv/letzter Scan/Drift-Alerts | audit_monitor_results | 📊 Monitoring |
| **Aktions-Inbox** | offene Freigaben/DSR/Meldefristen (Linear-artig) | approvals, dsr, incidents | jeweiliges Objekt |

Darunter: **Schnellaktionen** (Website hinzufügen · KI-System erfassen · Audit starten · Report exportieren) + optionaler **Assistent**-Einstieg.

---

## F. Phase 3 + 10 — Informationsarchitektur & Navigation

### Workspace-Sidebar (verbessert ggü. Vorschlag)
Der Vorschlag ist gut; meine Optimierung: **Compliance** bündelt die Frameworks/Register, **Team** rückt nach unten, klare Trennlinie zwischen „Objekten" und „Verwaltung".

```
ARBEITSBEREICH
  🏠 Übersicht          (Home/Status/Inbox)
  🌐 Websites           (Objekt)
  🤖 KI-Systeme         (Objekt)
  ⚠️ Risiken            (aggregiert)
  📋 Compliance         (DSGVO · AI Act · VVT · TOM · DSFA · DSR)
  📑 Evidence           (Nachweise · Reports · Audit-Trail · Auditor)
  📊 Monitoring         (Live · Drift · Alerts)
VERWALTUNG
  👥 Team               (Mitglieder · Rollen · Sicherheit/MFA)
  ⚙️ Einstellungen      (Konto · Billing · Datenresidenz · API-Keys)
```
*(8 Arbeits- + 2 Verwaltungspunkte — bewusst ≤10. „Agents/Approvals/Auditor" werden Tabs in den Objekten, keine Top-Level-Punkte.)*

### Die 5 Navigationen
1. **Öffentliche Navigation** (Marketing, bereits live): Produkt · Lösungen · Automatisierung · Sicherheit · Preise · Dokumentation · Login.
2. **Workspace-Navigation (Desktop):** persistente linke Sidebar (oben) + Topbar (Tenant-Switch · ⌘K · Assistent · Account).
3. **Tablet:** Sidebar kollabiert zu Icon-Rail (Hover/Tap expandiert); Topbar bleibt.
4. **Mobile:** Sidebar → Bottom-Tab-Bar mit 5 Kernen (🏠 ⚠️ 🌐 🤖 ☰), Rest unter „Mehr"; Detail-Drawer wird Full-Screen-Push.
5. **Command-Bar (⌘K):** quer über alles — „Gehe zu Website X", „Neues KI-System", „DSFA erstellen", „Report exportieren". Ersetzt Tiefen-Navigation.

---

## G. Phase 5 — Modul-Konsolidierung: **Compliance Center** (📋)

Statt 5+ Einzelseiten **ein** Center mit Tabs — jede Aktion erzeugt Objekte/Evidence im selben Kontext:

```
📋 Compliance
  ├─ Überblick        (welche Frameworks, Erfüllungsgrad)
  ├─ DSGVO            (VVT · TOM · DSFA · DSR · Sub-Prozessoren)
  ├─ EU AI Act        (KI-Inventar-Bezug · Klassifikation · Pflichten)
  ├─ Register         (VVT · Risiko · Vendor · Incident · Audit)
  └─ Dokument erstellen  (DSFA-/VVT-/TOM-/AVV-/DSE-Generator als Aktionen)
```
Analog werden **Risiko-** und **Evidence-Center** zu Sammelpunkten (H, I).

---

## H. Phase 6 — Risiko-Center (⚠️)
Alle Risiken aus Websites, KI-Systemen, DSGVO, AI Act, Vendoren laufen hier zusammen — **ein** priorisierter Stream:
```
⚠️ Risiken
  ├─ Alle (Tabelle: Severity · Quelle · Objekt · Status · Alter)
  ├─ Filter: nach Objekt (Website/KI/Vendor) · Framework · Severity
  ├─ Incidents (Meldefristen-Timer DSGVO Art. 33)
  ├─ Vendoren (DPA-Status, Adäquanz)
  └─ Risiko-Detail-Drawer → Maßnahme/Remediation/Freigabe + Evidence-Link
```

## I. Phase 7 — Evidence-Center (📑)
Ein Ort für Nachweisbarkeit:
```
📑 Evidence
  ├─ Nachweise (versiegelt, Hash-Chain, durchsuchbar)
  ├─ Reports (Compliance-Report, Annex-IV-Export)
  ├─ Audit-Trail (Prüfprotokoll, append-only)
  ├─ Auditor-Sicht (read-only Konsole für externe Prüfer)
  └─ Exporte (PDF/JSON/ZIP, Signatur-Status)
```

## J. Phase 8 — Website Governance (🌐 Objekt-Detail)
**Eine** Oberfläche pro Domain (Drawer/Detail), Tabs:
```
🌐 maschinenbau-gmbh.de   [Score 72 · B]   [Scan starten]
  Überblick · Risiken · Cookies/Tracker · Vendoren · Monitoring · Evidence · Compliance
```
Alle heute verstreuten Daten (cookie-scanner, monitoring, vendors, evidence) **an einem Objekt**.

## K. Phase 9 — AI Governance (🤖 Objekt-Detail)
**Eine** Oberfläche pro KI-System:
```
🤖 CV-Screening-LLM   [High-Risk · Annex III §4]   [Neu klassifizieren]
  Überblick · Klassifizierung · Risiken · Dokumentation (DSFA/FRIA) · Evidence · Monitoring (Drift)
```

---

## L. Phase 12 — Endergebnis

### Neue Customer Journey
```
Public: / → Audit starten → Ergebnis → „In Workspace übernehmen" → Konto
Workspace: Login → 🏠 Übersicht (Status+Inbox)
  → Website/KI hinzufügen → Objekt-Detail → Scan/Klassifizieren
  → Risiken sehen (⚠️) → Maßnahme/Doku (📋) → Nachweis (📑) → Monitoring (📊)
Alles im selben Shell, ⌘K als Beschleuniger, Assistent als Helfer (nicht als Home).
```

### Desktop-Konzept
Persistenter Shell (Sidebar + Topbar), Panel-Wechsel statt Seitenwechsel, Objekt-Detail als **Drawer über** der Liste (Kontext bleibt), ⌘K überall.

### Mobile-Konzept
Bottom-Tab (🏠 ⚠️ 🌐 🤖 ☰), Listen→Full-Screen-Detail-Push, Schnellaktion als FAB, Assistent als Sheet. Status-Kacheln 1-spaltig, gleiche Daten.

### Prioritäten P0–P3 (reines Design→Umsetzungs-Sequencing, hier nur Plan)
- **P0 — Fundament des „Produkt-Gefühls":**
  1. **Persistenter App-Shell** (Sidebar+Topbar) als Layout-Wrapper für alle Auth-Routen.
  2. **Kanonisches `/app` = 🏠 Übersicht** (Status-Dashboard) als Post-Login-Ziel; CreatorDashboard-Chat → Assistent-Panel.
  3. Bestehende `governance/*`-Views **in den Shell einhängen** (Header-Doppelung entfernen).
- **P1 — Objekt-Zentrierung:** 🌐 Websites & 🤖 KI-Systeme als Objekt-Liste→Detail-Drawer; cookie-scanner/classifier werden Objekt-Aktionen.
- **P2 — Center-Konsolidierung:** ⚠️ Risiko-, 📑 Evidence-, 📋 Compliance-Center aus bestehenden Views zusammenführen; ⌘K-Command-Bar.
- **P3 — Politur & Mobile:** Bottom-Tab-Mobile, einheitliche Primitive (Tabelle/Drawer/Filter), Tablet-Icon-Rail, Empty-States/Onboarding.

### Kernaussage
Es fehlt **kein Feature** — es fehlen **drei Strukturentscheidungen**: (1) **ein Shell**, (2) **ein Status-Home**, (3) **Objekt- statt Seiten-Navigation**. Damit wird aus „Sammlung von Compliance-Seiten" das **„Betriebssystem für Governance, Compliance & AI Governance"** — ohne neue Backend-Features, nur durch Re-Komposition des Vorhandenen.
