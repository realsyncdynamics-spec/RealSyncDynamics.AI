# RealSyncDynamics.AI — Produkt-Roadmap

> **Positionierung:** Automated Digital Compliance Infrastructure — nicht "KI baut Websites", sondern strukturierte Datenschutz-, Consent- und Website-Compliance-Infrastruktur fuer Unternehmen und Agenturen.

> **Scope-Disziplin:** Was im Kern liegt und was bewusst draußen bleibt, ist in [`docs/PRODUCT_FOCUS.md`](docs/PRODUCT_FOCUS.md) festgelegt. Phase A (siehe unten) ist Voraussetzung für Phase 2–4.

> **Reifegrad-Quelle:** Die Status-Icons (✅ / [x] / [ ]) in diesem Dokument
> markieren Entwicklungs-Meilensteine, **nicht** audit-festen Reifegrad. Für
> jede externe Kommunikation (Website, Deck, Sales) gilt
> [`docs/runtime-status-matrix.md`](docs/runtime-status-matrix.md) als
> verbindliche Quelle. Ein [x] hier bedeutet „Code existiert", nicht
> automatisch 🟢 produktiv.

---

## Phase A — Runtime härten (aktuell)

**Ziel:** Bevor neue Features dazukommen, ist der Kern stabil. Vier Bausteine:

| Baustein | Quelle | Status |
|---|---|---|
| Event-Schema (Governance Signals) | `src/core/runtime/governanceEvents.ts` | ✅ eingefroren |
| Evidence-Hashing (kanonisches JSON + SHA-256) | `src/core/runtime/evidence.ts` | ✅ implementiert |
| Agent-Contracts | `src/core/runtime/types.ts` + `src/lib/enterprise-ai-os/agents/` | ✅ definiert |
| Remediation-Layer (typisiert) | `src/core/runtime/remediation.ts` | ✅ Skelett |

Was bewusst *nicht* in Phase A ist: eigene CMS-Plugins, eigenes CRM/IAM/Ticket-System, vollständiges Evidence-Vault mit Ledger-Anchoring, AI-Act-Vollumfang. Siehe `docs/PRODUCT_FOCUS.md`.

---

## Produkt-Struktur

| Produkt | Ziel | Monetarisierung |
|---|---|---|
| Audit Engine | Lead-Generator | Freemium |
| Compliance Monitoring | SaaS Core | Recurring Revenue |
| Auto-Remediation | High Value | Upsells |
| Agency/Enterprise Suite | Skalierung | Hohe Vertraege |

---

## Preisstruktur

> **Single Source of Truth:** `src/config/pricing.ts`. Diese Tabelle nur Marketing-Erlaeuterung.

| Plan | Preis | Zielgruppe |
|---|---|---|
| Free Audit | 0 EUR | Lead-Generierung, SEO, virale Verbreitung |
| Starter | 79 EUR/Monat | Kleine Unternehmen, Freelancer, lokale Businesses |
| Growth / Business | 249 EUR/Monat | KMU, E-Commerce, SaaS — **Hauptprodukt** |
| Agency Suite | 699 EUR/Monat | Webagenturen, Datenschutzberater, IT-Dienstleister |
| Enterprise | ab 1.500 EUR/Monat | Konzerne, Oeffentliche Stellen, Healthcare, Banken |

### Free Audit
- URL Scan + Compliance Score
- Cookie Detection + Tracker Detection
- 3 kritische Risiken + Mini PDF Report

### Starter (79 EUR/Monat)
- Vollstaendiger DSGVO-Scan + Consent-Analyse
- Datenschutzerklaerung Generator + Impressum Generator
- Monatlicher Re-Scan + E-Mail Alerts

### Growth / Business (249 EUR/Monat)
- Taeglisches Monitoring + Third-Party Detection
- **Consent Timing Analyse** (welche Tracker laden VOR Consent?)
- Auto-Fix Empfehlungen + PDF Audit Reports
- Teamzugaenge + Verlauf & Historie + Risk Dashboard
- Security Header Analyse + Form Validation

### Agency Suite (699 EUR/Monat)
- White Label + Multi-Tenant + mehrere Kundendomains
- API-Zugriff + Kundenverwaltung
- Automatische Reports + Prioritaets-Scans

### Enterprise (ab 1.500 EUR/Monat)
- Individuelle Regeln + SLA + Hosting-Optionen
- Compliance API + AI Act Module + DSB Integration
- Continuous Compliance + Evidence Vault + Audit Trails

---

## Phase 1 — Audit Platform (0–3 Monate) ✅ IN ARBEIT

**Ziel:** MVP mit echtem Nutzen — nur Analyse + Reporting.

### Scanner
- [x] `cookie-scan` Edge Function (Free-Tool, server-side fetch)
- [x] `gdpr-audit` Edge Function (Lead-Magnet, vollstaendiger Audit)
- [x] Rule Engine (`_shared/rules/evaluator.ts` + `gdpr.json` + `ai-act.json`)
- [x] Tracker-Registry (`_shared/rules/tracker-registry.json`)
- [ ] **Playwright-Scanner Microservice** (`deploy/playwright-scanner/`) — _Deployment ausstehend_
- [ ] `cookie-scan-deep` Edge Function (nutzt Playwright statt fetch)

### Reports
- [x] `audit-report-pdf` Edge Function (HTML-Report, druckoptimiert)
- [x] `WebsiteRebuildStatus.tsx` (Realtime-Frontend fuer Rebuild-Jobs)
- [ ] Audit-Report per Email nach Scan (ausstehend)

### Datenbank
- [x] `gdpr_audits` Tabelle mit vollstaendiger Struktur
- [x] `website_rebuilds` + `website_rebuild_steps` (8-Step-Pipeline)
- [x] `get_rebuild_status_by_token` RPC (Public-Status-Check ohne Auth)

### Tech Stack (Phase 1)
| Bereich | Technologie |
|---|---|
| Frontend | Vite + React (SPA auf Hostinger VPS) |
| Backend | Supabase Edge Functions (Deno) |
| Scanner | Server-side fetch + Playwright (Phase 1.5) |
| Queue | pg_cron + Supabase (kein Redis noetig fuer MVP) |
| DB | Supabase Postgres (EU-Region) |
| Storage | Supabase Storage (EU) |
| Auth | Supabase Auth (Magic Link) |
| Deployment | Traefik + Hostinger VPS (EU/DE) |

---

## Phase 2 — Auto Remediation (3–6 Monate)

**Ziel:** Nicht nur erkennen — automatisch beheben.

### Consent Injection
- [ ] Cookie Banner automatisch einbauen (RealSync CMP)
- [ ] Script Blocking: `type="text/plain" data-consent="analytics"`
- [ ] Opt-In Logik + Reject-All Button

### Auto-Fixes
- [x] Google Fonts Self-Hosting (`_shared/website-rebuild/self-host.ts`)
- [x] Tracker Removal (`_shared/website-rebuild/strip-trackers.ts`)
- [x] Consent SDK Injection (`_shared/website-rebuild/inject-consent.ts`)
- [ ] Formular-Absicherung (Consent Checkbox + Datenschutzhinweis)
- [ ] CSP-Templates generieren und injizieren

### CMS-Patch-Engine
- [ ] WordPress: Plugin-Konzept (Option A: eigenes WP-Plugin)
- [ ] Shopify: App (Option B: Liquid-Template-Patch)
- [ ] Webflow: Embed-Code-Injection (Option C: Custom Code)

### Remediation-Beispiel
```html
<!-- VORHER -->
<script src="https://www.googletagmanager.com/gtag/js?id=G-xxx"></script>

<!-- NACHHER (nach Auto-Fix) -->
<script type="text/plain" data-consent="analytics"
  src="https://www.googletagmanager.com/gtag/js?id=G-xxx"></script>
```

---

## Phase 3 — CMS-Integrationen (6–12 Monate)

**Prioritaet:** WordPress > Shopify > Webflow > Framer > Next.js

### WordPress Plugin
- [ ] Plugin-Grundstruktur (WP boilerplate)
- [ ] Auto-Scan bei Plugin-Aktivierung
- [ ] Dashboard-Widget mit Compliance-Score
- [ ] One-Click-Fix fuer haeufige Probleme
- [ ] Re-Scan Cron (woechentlich)

### Shopify App
- [ ] App-Store-Submission
- [ ] Cookie-Banner-Integration via Script Tags API
- [ ] Checkout-Compliance (DSGVO-konforme Checkout-Felder)

---

## Phase 4 — Continuous Compliance Platform (12+ Monate)

**Ziel:** Aus dem Tool wird Infrastruktur.

### Drift Detection
- [ ] "Marketing hat Hotjar eingebaut" — automatisch erkennen
- [ ] Webhook-Notifications bei neuen Trackern
- [ ] Compliance-Delta (Vorher/Nachher-Vergleich)

### Evidence Vault
- [ ] HAR Files + Screenshots archivieren
- [ ] Consent Logs (DSGVO Art. 7: Nachweis der Einwilligung)
- [ ] Audit-Trail PDF mit Zeitstempel + Signatur
- [ ] Langzeit-Archivierung mit konfigurierbarer Retention (juristische Eignung pro Anwendungsfall durch DSB / Fachjuristen zu pruefen — die Plattform garantiert sie nicht)

### AI Act Compliance
- [ ] AI-Tool-Inventar erfassen
- [ ] Risk Level Assessment (minimal/limited/high-risk/banned)
- [ ] Disclosure-Check fuer Chatbots
- [ ] EU AI Act Art. 52 (Transparenzpflichten) pruefen

### DSB Integration
- [ ] DSB-Dashboard (Datenschutzbeauftragter-Ansicht)
- [ ] Delegierter Datenschutzbeauftragter via Plattform
- [ ] Meldepflicht-Timer (72h DSGVO Art. 33)

---

## Kritische Differenzierer

### 1. Consent Timing Analysis
> Die meisten Tools pruefen nur "Banner vorhanden?". Wir pruefen: "Welche Requests liefen VOR Consent?"

Implementierung: `/scan/consent-timing` im Playwright-Microservice.

### 2. Auto Remediation
Nicht nur Audit — echte technische Fixes. Macht aus einem Reporting-Tool ein Infrastruktur-Produkt.

### 3. Continuous Monitoring
SaaS-Kern. Nicht einmalig scannen, sondern dauernd ueberwachen.

### 4. Nachweisbarkeit
Unternehmen brauchen PDFs, Logs, Historie, Audit-Trails fuer Behoerden und DSBs.

---

## Was wir NICHT tun

- ❌ "100 % rechtssicher" versprechen → "Automatisierte technische Datenschutz-Unterstuetzung"
- ❌ LLM-only Datenschutzerklaerungen → strukturierte Daten + Regelengine + Templates
- ❌ Sofort komplette Websites neu generieren (zu frueh, zu teuer, zu komplex fuer MVP)
- ❌ "KI baut Websites" — wir verkaufen Risikoreduktion, Nachweisbarkeit, Automatisierung

---

## Das eigentliche Geschaeftsmodell

Wir verkaufen **nicht**: Webseiten, Cookie-Banner, HTML.

Wir verkaufen: **Risikoreduktion + Nachweisbarkeit + Automatisierung + Monitoring + Infrastruktur.**

Diese Positionierung skaliert in Richtung groesserer Kunden, weil sie auf nachvollziehbare Evidence, Audit-Trails und kontinuierliches Monitoring zielt — nicht auf einmalige Reports.

---

*Letzte Aktualisierung: Mai 2026 · RealSyncDynamics.AI*
