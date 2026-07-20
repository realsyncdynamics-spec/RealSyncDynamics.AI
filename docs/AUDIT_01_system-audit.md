# Audit #1: System-Audit — Routes, Pages, Features

**Ausführungsdatum**: 2026-07-20  
**Analysiert**: 438 Route-Definitionen, 173 Page-Komponenten, 40+ Feature-Module

---

## 📊 Überblick der Dimensionen

| Dimension | Zahl | Status | Notizen |
|-----------|------|--------|---------|
| **Öffentliche Seiten** | 150+ | Teilweise verlinkt | Marketing, Tools, Docs |
| **Auth-gated Routes** | 250+ | In App.tsx definiert | Dashboard, Governance, Settings |
| **Öffentliche Tools** | 15+ | Live & Free | Cookie-Scanner, AI-Act-Klassifikator, etc. |
| **Feature-Module** | 40+ | Teilweise Hidden | Lazy-loaded in src/features/ |
| **Edge Functions** | 169 | Deployiert | Backend-Services in Supabase |
| **DB-Tabellen** | 237+ | Mit RLS | Multi-Tenant Isolation |
| **Components** | 138 | Katalogisiert | Shared UI in src/components/ |

---

## 🎯 Das Kernproblem: 3 unterschiedliche App-Ebenen

```
Ebene 1: MARKETING (Öffentlich, keine Auth)
├─ Landing Pages (173 verschiedene)
├─ Branchen-Doorways (8 Industrien)
├─ Nische-LPs (SaaS, Agenturen, Praxen, etc.)
├─ Competitor-Doorways (OneTrust-Alter, etc.)
└─ Free Tools (15+ Tools, keine Auth nötig)

Ebene 2: PREVIEW (Öffentlich, Demo ohne Auth)
├─ /preview - Public Workspace Preview
├─ /demo-* - Demo-Flows
└─ Showcases für Salesreps

Ebene 3: PRODUCT (Auth-gated, Subscription)
├─ /app/* - Adaptiver Dashboard
├─ /governance/* - Governance-OS Module
├─ /settings/* - Account Management
└─ 26+ Live Module + Roadmap
```

**Das Problem:**
- User springt von **Landing (vertrauend, rund, hell)** 
- → zu **Product (technisch, kantig, dunkel)**
- → visueller Bruch, verwirrende Navigation
- → Features sind "versteckt" (nur über direkte URLs oder Feature-Flags)
- → Kunden sehen nicht, was sie bereits haben

---

## 🗺️ Öffentliche Routes (Public Landing Pages)

### Haupteingänge

| Route | Komponente | Zweck | Status |
|-------|-----------|------|--------|
| `/` | MainLanding | CEO-Cockpit Demo + Hero | ✅ Live (Design-Locked) |
| `/landing` | Landing | Legacy Marketing-LP | ✅ Live |
| `/preview` | PublicWorkspacePreview | Workspace Demo (kein Auth) | ✅ Live |
| `/aetheros` | AetherOSLanding | 3D-Konzept | ✅ Live |

### Free Audit & Tools (15+ ohne Auth nötig)

| Route | Tool | Zweck | Status |
|-------|------|------|--------|
| `/audit` | AuditLanding | DSGVO-Scan Einstieg | ✅ Live |
| `/cookie-scanner` | CookieScanner | Cookie-Erkennung | ✅ Live |
| `/avv-generator` | AvvGenerator | AVV-Vorlage | ✅ Live |
| `/ai-act-classifier` | AiActClassifier | AI-Act Klassifizierung | ✅ Live |
| `/vvt-wizard` | VvtWizard | VVT-Generator | ✅ Live |
| `/tom-generator` | TomGenerator | TOM-Generator | ✅ Live |
| `/datenschutz-generator` | DatenschutzGenerator | Datenschutzerklärung | ✅ Live |
| `/dsfa-wizard` | DsfaWizard | DSFA/DPIA Generator | ✅ Live |
| `/busseld-rechner` | BusseldRechner | Bußgeld-Rechner | ✅ Live |
| `/meldepflicht-timer` | MeldepflichtTimer | Meldepflicht-Countdown | ✅ Live |
| `/dokumente-bundle` | DokumenteBundle | DSGVO-Dokumente-Paket | ✅ Live |
| `/dsgvo-ki-checkliste` | DsgvoKiChecklist | KI + DSGVO Checkliste | ✅ Live |
| `/ai-act-workflows` | AiActWorkflows | AI-Act Workflows-Guide | ✅ Live |

### Branchen-spezifische Landingpages (8 Industrien + Nischen)

| Route | Industrie | Status |
|-------|-----------|--------|
| `/healthtech` | Gesundheitswesen | ✅ |
| `/legal-tech` | Rechtswesen | ✅ |
| `/fintech` | Finanzdienstleistungen | ✅ |
| `/oeffentliche-verwaltung` | Public Sector | ✅ |
| `/fuer-saas`, `/saas-anbieter` | SaaS | ✅ |
| `/agenturen`, `/agenturenconversion` | Marketing-Agenturen | ✅ |
| `/praxen`, `/arztpraxen` | Ärzte | ✅ |
| `/kanzleien` | Rechtsanwälte | ✅ |
| `/steuerberater` | Steuerberater | ✅ |
| `/versicherungen` | Versicherungen | ✅ |
| `/ecommerce` | E-Commerce | ✅ |
| `/hr-software` | HR-Tools | ✅ |
| `/bildung` | Bildung | ✅ |

### Competitor Alternative Doorways (7 Alternativen)

```
OneTrust     → /onetrust-alternative
Usercentrics → /usercentrics-alternative
DataGuard    → /dataguard-alternative
Borlabs      → /borlabs-alternative
Cookiebot    → /cookiebot-alternative
Proliance    → /proliance-alternative
Iubenda      → /iubenda-alternative
```

### Cloud Code Optimizer (Separater Sales Funnel)

```
/optimizer
├─ /optimizer - Landing
├─ /optimizer/scan - Scan UI
├─ /optimizer/scanning - Scanning Prozess
├─ /optimizer/results - Ergebnisse (FREE, kein Auth)
├─ /optimizer/auth - Login
├─ /optimizer/auth/verify - 2FA
├─ /optimizer/pricing - Preisierung (FREE, kein Auth)
├─ /optimizer/dashboard - Auth-gated
├─ /optimizer/checkout - Zahlung
├─ /optimizer/optimizing - Auto-Optimizer läuft
└─ /optimizer/complete - Fertigstellung
```

### Governance Runtime & Content Pages

```
/runtime                          - Runtime Doku
/monitoring                       - Monitoring Doku
/agents                           - Agents Doku
/governance-runtime               - Governance Runtime Details
/docs/governance                  - Governance Dokumentation
/ai-act                           - AI Act Informationen
/ai-act-governance                - AI Act Vertiefung
/ai-dsgvo-bot                     - AI DSGVO Bot
/governance-browser               - Governance Browser Demo
/governance-score                 - Governance Score Info
/evidence                         - Evidence Vault Info
/policy-engine                    - Policy Engine Info
/deployment-governance            - Deployment Governance Info
/governance-graph                 - Governance Graph Seite
/agent-governance                 - Agent Governance Page
/digitale-souveraenitaet          - EU Digital Sovereignty
/digital-sovereignty              - (EN version)
```

### SEO & Content Marketing (Doorway Pages)

Über 30 SEO-Landingpages für Compliance-Topics:
```
/pre-consent-tracking             - Consent-Tracking Guide
/continuous-compliance            - Compliance Automation
/ai-act-readiness                 - AI Act Readiness
/matomo-dsgvo-konfiguration      - Matomo DSGVO Setup
/cookie-compliance                - Cookie Laws
/bait-compliance                  - BAIT Compliance
/marisk-audit                     - MA-Risk Audit
/eu-ai-act-check                  - AI Act Checkliste
/dsgvo-tool-vergleich             - DSGVO Tools
/schrems-ii-erklaert              - SCHREMS II Erklärung
/fix-paket                        - Quick-Fix Paket
```

### Pricing & Checkout

```
/pricing                          - Pricing Hauptseite
/pricing/:slug                    - Preis-Detail-Seite
/features/:slug                   - Feature-Detail-Seite
/checkout/:planKey                - Checkout
/checkout/success                 - Bestätigung
/checkout/cancelled               - Abbruch
/contact-sales                    - Sales Contact
```

### Service & Legal Pages

```
/about, /ueber-uns                - About
/security                         - Security Policy
/trust                            - Trust & Compliance
/status                           - System Status
/press                            - Press Hub
/api, /api-docs                   - API Dokumentation
/integrations                     - Integrations
/developers                       - Developer Portal
/changelog                        - Release Notes
/partners                         - Partner Program
/blog, /case-studies, /resources  - Content
```

### Demo Pages (Public, aber für Demo nur)

```
/demo-landing                     - Demo Startseite
/demo-login                       - Demo Login
/demo-tour                        - Produkttour Start
/demo-tour/signup                 - Tour Signup
/demo-tour/checkout               - Tour Checkout
/demo-tour/dashboard              - Tour Dashboard View
```

---

## 🔒 Protected/Auth-Gated Routes (/app/*)

### Live Module in Governance Browser (26 + 1 Beta)

Die Hauptnavigation ist als **Tabs** organisiert. Jeder Tab führt zu einem Feature-Modul.

#### TAB_MODULES (Immer sichtbar, aber teilweise plan-locked)

| Modul | Route | Plan | Status | Beschreibung |
|-------|-------|------|--------|-------------|
| **1. Überblick** | `/app/dashboard` | Free | ✅ Live | CEO-Cockpit mit KPIs |
| **2. Workspace** | `/app/home` | Free | ✅ Live | Live Workspace-Daten |
| **3. Websites** | `/app/websites` | Free | ✅ Live | Website Governance & Scans |
| **4. Nachweise** | `/app/evidence` | Free | ✅ Live | Evidence Vault (Read-only in Free) |
| **5. KI-Systeme** | `/app/ai-systems` | Starter | ✅ Live | KI-Registry + Agents List |
| **6. Risiken** | `/app/risks` | Starter | ✅ Live | Risk Center Prioritization |
| **7. Monitoring** | `/app/monitoring` | Starter | ✅ Live | Runtime Drift Alerts |
| **8. Sicherheit** | `/app/security-signals` | Starter | ✅ Live | Security Findings Integration |
| **9. Anbieter** | `/app/vendors` | Growth | ✅ Live | Vendor & DPA Tracking |
| **10. Reports** | `/app/reports` | Growth | ✅ Live | Compliance & Audit Reports |
| **11. Warnungen** | `/app/alerts` | Free | ✅ Live | Laufzeit-Alerts |
| **12. Billing** | `/app/billing` | Free (AAL2) | ✅ Live | Plan, Abrechnung, Invoices |
| **13. Team** | `/app/team` | Free (AAL2) | ✅ Live | Rollen, Team, Access |
| **14. Workflows** | `/app/workflows` | Starter | ✅ Live | DSGVO-Automationen (n8n) |
| **15. Agenten** | `/app/agents` | Agency | ✅ Live | Enterprise Skills (15+ Agenten) |
| **16. Bots** | `/app/bots` | Agency | ✅ Live | Conversational Bots (Chat, Voice, Telegram) |
| **17. Automations** | `/app/automations` | Agency | ✅ Live | Automation Skills & Execution |
| **18. Kodee** | `/kodee` | Agency | ✅ Live | VPS-Assistent (SSH-Ops, Logs, Risk-Advisor) |
| **19. Herkunft** | `/app/provenance` | Scale | ✅ Live | C2PA Herkunftsnachweis |
| **20. Bulk-Jobs** | `/app/bulk` | Scale | ✅ Live | Massen-Scan mit CSV-Import |
| **21. Scheduler** | `/app/scheduler` | Scale | ✅ Live | Geplante Scans |
| **22. Vault** | `/app/evidence-vault` | Enterprise | ✅ Live | Advanced Vault (versioniert, immutable) |
| **23. Policys** | `/app/policy-packs` | Enterprise | ✅ Live | Aktivierbare Compliance-Regelwerke |
| **24. Dokumente** | `/app/documents` | Free | ✅ Live | DSGVO-Dokumentengenerator |
| **25. Audit** | `/app/audit` | Growth | ✅ Live | Audit-Ready Reports & Exports |
| **26. Einstellungen** | `/app/settings` | Free | ✅ Live | Mandant, Sicherheit, Integrationen |

#### DOCK_MODULES (In "Mehr" Dropdown, Roadmap/Beta)

| Modul | Route | Plan | Status | Beschreibung |
|-------|-------|------|--------|-------------|
| **ISO 42001** | `/app/governance/iso42001` | Enterprise | 🔄 Beta | AI Management System |
| **ISO 27001** | `/app/governance/iso27001` | Enterprise | 🔄 Beta | Information Security |
| **AI-Act Assessment** | `/app/governance/ai-act-assessment` | Enterprise | 🔄 Beta | Risk Assessment |
| **NIS2 Incidents** | `/app/governance/nis2-incidents` | Enterprise | 🔄 Beta | Security Incidents |
| **DSFA/DPIA** | `/app/dpia` | Enterprise | 🔄 Beta | Data Protection Impact |
| **Remediation** | `/app/remediation` | Enterprise | 🔄 Beta | Auto-Fixes & Pull Requests |
| **Custom Frameworks** | `/app/governance/custom-frameworks` | Enterprise | 🔄 Roadmap | Benutzerdefinierte Frameworks |
| **Compliance Analytics** | `/app/governance/compliance-analytics` | Enterprise | 🔄 Roadmap | Analytics Dashboard |
| **Audit Trail** | `/app/governance/audit-trail` | Enterprise (AAL2) | 🔄 Roadmap | System Audit Log |

### 6-Tier Pricing-Modell

```
Free         → Kostenlos (Audit + Basic)
Starter      → €79/Monat
Growth       → €249/Monat (Professional)
Agency       → €699/Monat
Scale        → Intermediate
Enterprise   → €1.249/Monat (Full Access)
```

### Weitere Protected Routes (Nicht-Tab-basiert)

```
Operations:
/app/operations              - Operations Dashboard
/app/operations/inventory    - Inventory Items
/app/operations/stock        - Stock Movements
/app/operations/suppliers    - Suppliers
/app/operations/locations    - Locations
/app/operations/reports      - Reports

Finance:
/app/finance                 - Finance Dashboard
/app/tax-evidence            - Tax Evidence Export
/app/tax-documents           - Tax Documents
/app/tax-exports             - Tax Exports

API & Integration:
/app/api-setup               - API Setup Wizard
/app/api-docs                - API Documentation
/app/api-monitoring          - API Monitoring

Workspace:
/app/workspace               - Workspace Home
/app/workspace/embed         - Embed Widget

Admin:
/app/admin                   - Admin Dashboard
/app/admin/members           - Members
/app/admin/billing           - Billing Admin
/app/admin/api-keys          - API Keys
/app/admin/audit             - Audit Log

Other:
/app/company                 - Company Info
/app/market                  - Market Gaps
/app/outreach                - Outreach Management
/app/analytics               - Dashboard Analytics
/app/invite/:token           - Accept Workspace Invite
```

---

## 🔴 Das Hidden Feature Problem

### Features die EXISTIEREN, aber NICHT VERLINKT sind

Aus App.tsx erkannt:

```
ROADMAP-FEATURES (Vollständig implementiert, aber nicht sichtbar):
├─ ISO 42001 Compliance Hub (12 Views!)
│  ├─ Control Library
│  ├─ Control Details
│  ├─ Readiness Assessment
│  ├─ Evidence Vault für ISO 42001
│  ├─ Gap Analysis
│  ├─ Remediation Workflow
│  ├─ Maintenance Tracking
│  ├─ Auditor Engagement
│  ├─ Certification Reports
│  └─ ...weitere
│
├─ AI-Act Compliance (5+ Views)
│  ├─ Risk Assessment
│  ├─ Data Governance
│  ├─ AI System Register
│  └─ Auto-Classification
│
├─ Analytics & Reporting (8+ Views)
│  ├─ Compliance Analytics
│  ├─ Report Builder
│  ├─ Compliance Roadmap
│  ├─ Dashboard Analytics
│  └─ KPI Tracking
│
├─ Custom Frameworks (2+ Views)
│  ├─ Framework Builder
│  └─ Framework Management
│
├─ Advanced Operations (4+ Views)
│  ├─ Inventory Management
│  ├─ Stock Movements
│  ├─ Supplier Management
│  └─ Location Tracking
│
└─ 20+ weitere unverlinkte Views
```

### Warum sind sie versteckt?

1. **Plan-Gating** — Sie sind nur für Enterprise/Scale verfügbar
2. **Phase 2/3-Features** — Noch nicht stabiler für GA
3. **Feature-Flags** — Administrativ disabled
4. **Unvollständig** — UI fertig, aber Backend/Integrationen fehlen

---

## 📊 Feature-Status Matrix

| Feature | Code | Live | Tab-Verlinkt | DB-Ready | Status |
|---------|------|------|--------------|----------|--------|
| **Governance Dashboard** | ✅ | ✅ | ✅ | ✅ | 🟢 Live |
| **Evidence Vault** | ✅ | ✅ | ✅ | ✅ | 🟢 Live |
| **KI-Systeme Registry** | ✅ | ✅ | ✅ | ✅ | 🟢 Live |
| **Risk Center** | ✅ | ✅ | ✅ | ✅ | 🟢 Live |
| **Monitoring Runtime** | ✅ | ✅ | ✅ | ✅ | 🟢 Live |
| **Bots & Chat** | ✅ | ✅ | ✅ | ✅ | 🟢 Live |
| **Automations** | ✅ | ✅ | ✅ | ✅ | 🟢 Live |
| **ISO 42001 Hub** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |
| **AI-Act Assessment** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |
| **Compliance Analytics** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |
| **Custom Frameworks** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |
| **Remediation Workflow** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |
| **Audit Trail (Full)** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |
| **Operations Module** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |
| **Finance Module** | ✅ | ✅ | ❌ | ✅ | 🟡 Hidden |

---

## 🏗️ Information Architecture Problem

### Aktuelle Struktur (Chaos)

```
Governance Browser (Tab-based)
├─ 26 Live Tabs (deutlich sichtbar)
├─ "Mehr" Dropdown (versteckt weitere 10)
└─ Direkte URLs für 30+ weitere Routes

Plus:
├─ /app/operations/* (Separater Modul)
├─ /app/finance/* (Separater Modul)
├─ /app/admin/* (Admin-Only)
└─ /app/api/* (API Management)
```

**Problem:**
- Kunden sehen 26 Dinge in Tabs
- Aber es gibt 60+ weitere Features per direkter URL
- Operations & Finance sind "versteckt"
- Keine klare Hierarchie

---

## ✅ Audit-Abschluss

**Erkannt:**
- 438 Route-Definitionen
- 150+ öffentliche Seiten (150% davon sind Marketing/SEO-Doorways)
- 26 Live-Module + 10+ Hidden/Roadmap
- 15+ Free Tools (ohne Auth)
- 3 unterschiedliche Design-Systeme (Marketing vs. App vs. Demo)

**Problem-Kategorien:**
1. **Navigation-Verwirrung** — Features überall, keine klare Struktur
2. **Design-Bruch** — Landing ≠ App Visuell komplett unterschiedlich
3. **Plan-Gating Nicht-Klar** — Kunden wissen nicht, was in ihrer Plan enthalten ist
4. **Hidden Gems** — Enterprise-Features sind im Code, aber nicht erreichbar

**Nächster Schritt:** Audit #2 (Component-Inventory) + Audit #3 (Design-Audit)
