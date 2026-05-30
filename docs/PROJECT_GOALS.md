# RealSyncDynamics.AI — Projektziel, Ist-Stand, Bedarf

> **Zweck dieses Dokuments:** Eine zitierbare Single Source für die Frage
> „Was ist das Ziel, was haben wir, was brauchen wir?". Es synthetisiert
> `PRODUCT_FOCUS.md`, `ROADMAP.md`, `runtime-status-matrix.md` und
> `qa/claim-to-feature-audit.md` zu einem Bild.
>
> **Konfliktregel:** Bei Widerspruch zwischen Reifegrad-Aussagen gewinnt
> `docs/runtime-status-matrix.md`. Dieses Dokument referenziert sie, ersetzt
> sie nicht.

---

## 1. Das Ziel

**RealSyncDynamics.AI ist eine EU-souveräne Realtime-Governance- &
Compliance-Infrastruktur.**

Jedes Business-Event wird zu einem Governance-Event mit *Evidence → Severity
→ Remediation*. Die Plattform macht bestehende Kundensysteme revisionssicher
und AI-Governance-fähig — sie erkennt, belegt und unterstützt die Behebung von
DSGVO- und EU-AI-Act-Risiken, kontinuierlich und mandantengetrennt.

**Kategorie-Positionierung:** näher an **Vanta · Datadog · ServiceNow ·
CrowdStrike** — *nicht* an Cookiebot, generischen DSGVO-Scannern oder
„KI-baut-Websites"-Tools.

**Geschäftsmodell:** Wir verkaufen nicht Webseiten, Cookie-Banner oder HTML.
Wir verkaufen **Risikoreduktion + Nachweisbarkeit + Automatisierung +
Monitoring + Infrastruktur.**

### Was bewusst NICHT zum Kern gehört
(siehe `docs/PRODUCT_FOCUS.md` für die vollständige Scope-Disziplin)

- Kein ERP, keine Buchhaltung, kein eigenes CRM/IAM/Ticket-System — das sind
  Connector-Ziele, kein Kern.
- Kein generischer Website-Builder, keine LLM-only-Datenschutzerklärungen.
- **C2PA / CreatorSeal / Provenance-Branding und „Agent OS" für allgemeine
  Agentenausführung** sind *separate, spätere Positionierungen* — nicht der
  aktuelle Produktkern.

> **Hinweis zur Alt-Last:** Frühere Dokumente positionierten das Produkt als
> „SaaS für Creator & Agenturen mit C2PA" bzw. „RealSync Agent OS". Diese
> Framings sind überholt. Verbindlich ist die Governance-/Compliance-Runtime
> oben.

---

## 2. Was wir haben (Ist-Stand)

Substanz: **~90 Edge Functions, ~139 Migrations**, breite React-SPA (80+
Seiten inkl. SEO-/Nischen-Landingpages). Produktiv (🟢) laut Status-Matrix:

| Bereich | Produktiv heute |
|---|---|
| **Detection** | Cookie-/Tracker-Scan (server-side), Consent-Detection mit Reject-Parität (e2e-verifiziert), Sub-Processor-Inventar |
| **Classification** | Rule Engine (DSGVO + AI-Act, versioniert), AI-Act-Klassifikation (regelbasiert), Risk Score |
| **Evidence & Audit** | Append-only Audit-Log, Evidence-Vault-Export, Audit-Report-PDF |
| **Workflows** | DSGVO Art. 15 Export, Art. 17 Löschung, DPIA-Workflow |
| **Remediation** | Priorisierte Hinweise + Auto-Fix-Empfehlungen (Copy-Paste-Snippets, 5 Patterns) |
| **Plattform** | Multi-Tenancy (RLS), RBAC, EU-Hosting (Supabase eu-central), opt-in EU-lokale Inferenz (Ollama gemma3:4b), Stripe-Billing (5 Tiers), Governance-Agent, Shopify-Integration, Doc-Generatoren (DSE/Impressum/AVV/VVT/TOM) |

**Harte Caveats (Pflicht in externer Kommunikation):**
- AI-Act-Klassifikation ist *regelbasiert*, **keine rechtsverbindliche
  Einstufung** → „unterstützt die AI-Act-Klassifikation", nie „AI-Act-konform".
- Risk Score ist *interner Indikator*, nicht extern validiert.
- „unterstützt", nie „garantiert"; ersetzt keinen DSB.

---

## 3. Was wir brauchen (Bedarf, priorisiert)

### P0 — Operative Blocker (Feature existiert im Code, ist aber „dunkel")
- [ ] `Resend`-Vault-Key setzen → **E-Mail-Alerts / Monatlicher Re-Scan** aktiv
- [ ] `anthropic_api_key`-Vault-Eintrag → **Governance-Agent** aktiv
- [ ] Security-Header auf Hostinger deployen (Code fertig: `infra/nginx/security-headers.conf`) + `curl -I` verifizieren → von 🟡 auf 🟢
- [ ] Playwright-Scanner-Microservice deployen → Consent-Timing über statisch hinaus

### P1 — Claim-vs-Realität schließen (Pricing verspricht mehr als live)
- [ ] Evidence-Vault **Hash-Chain-Trigger** migrieren (Schema da, Trigger fehlt) — *Enterprise-kritisch*
- [ ] White-Label **Logo-Upload-UI** (heute nur Template-Variable) — *Agency-Reklamationsrisiko*
- [ ] „Tägliches Monitoring": Daily-Cron operationalisieren *oder* Copy auf „wöchentlich/on-demand" angleichen
- [ ] Veraltete **Bronze/Silver/Gold-Preise** in 5 Seiten korrigieren (siehe `qa/claim-to-feature-audit.md`)

### P2 — Spezifikationen (Enterprise-Glaubwürdigkeit)
- [ ] **Governance Spec v1.0**: ESS (Event Schema), ACS (Agent Contract), RCS (Runtime Contract), formale Hash-Chain-/Replay-/Retention-Definition

### P3 — Konsolidierung & Roadmap
- [ ] 3 parallele Browser-Extensions → **eine** kanonische Variante
- [ ] Roadmap: Policy-as-Code (OPA), Runtime-Enforcement (allow/warn/block), autonome Remediation, Incident-/Vendor-Workflows, WORM-Storage, externe Audits (SOC 2 / ISO 27001 / Pentest)

### P4 — Dokumentations-Hygiene
- [x] Veraltete Positionierung in `CLAUDE.md` und root `ARCHITECTURE.md` an die Governance-Runtime angleichen *(dieses Update)*

---

## 4. Verwandte Dokumente

- `docs/PRODUCT_FOCUS.md` — Scope-Disziplin (Kern vs. Connector vs. Nicht-Kern)
- `docs/runtime-status-matrix.md` — verbindlicher Reifegrad je Modul (🟢/🟡/🔴/⚪)
- `docs/qa/claim-to-feature-audit.md` — jeder Pricing-Claim auf seinen Code-Pfad zurückverfolgt
- `ROADMAP.md` — Phasen A → 1 → 2 → 3 → 4
- `docs/ARCHITECTURE.md` — Ziel-Architektur (Continuous-Compliance-Infrastructure)

---

*Letzte Aktualisierung: Mai 2026 · RealSyncDynamics.AI*
