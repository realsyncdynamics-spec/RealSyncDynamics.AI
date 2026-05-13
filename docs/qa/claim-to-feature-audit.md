# Claim-to-Feature Audit

> Jeder Pricing-/Landing-Page-Claim auf seinen Code-Pfad zurückverfolgt.
> Risiko-Bewertung: wie groß ist die Lücke zwischen Versprechen und Realität.

---

### URL-Scan mit Compliance-Score 0–100
- **Gefunden auf**: Pricing-Seite (Free Audit Bullet), Hero-Stat-Bar, Free-Audit-Landing
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: `supabase/functions/gdpr-audit/index.ts` → `scoreReport()`. UI: `src/pages/AuditLanding.tsx`
- **Risiko**: low
- **Empfohlene Copy**: bleibt wie ist

### Top-3-Risiken sichtbar
- **Gefunden auf**: Pricing (Free Audit Bullet)
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: `AuditLanding.tsx` rendert `issues` sortiert nach severity (clientseitig). Backend liefert vollständige Liste, UI begrenzt auf Top-3 für anonym.
- **Risiko**: low
- **Empfohlene Copy**: bleibt

### Mini-PDF-Report
- **Gefunden auf**: Pricing (Free Audit Bullet)
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: `supabase/functions/audit-report-pdf/index.ts` + `@react-pdf/renderer`
- **Risiko**: low
- **Empfohlene Copy**: bleibt

### Vollständiger DSGVO-Scan mit Paragraphenbezug
- **Gefunden auf**: Pricing (Starter Bullet)
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: gdpr-audit Issue-Schema hat `paragraph_ref`. Rule-Engine in `_shared/rules/` mit DSGVO-Artikel-Referenzen pro Rule.
- **Risiko**: low

### DSE- und Impressums-Generator
- **Gefunden auf**: Pricing (Starter Bullet)
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: `supabase/functions/generate-document/index.ts` + Templates für DSE, Impressum, AVV, VVT, TOM
- **Risiko**: low

### Technische Consent-Setup-Empfehlungen
- **Gefunden auf**: Pricing (Starter Bullet)
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: Empfehlungen in `gdpr-audit` Findings + `governance-remediate` Edge Function (PR #163) für `consent_wrapper`-Pattern.
- **Risiko**: low

### Monatlicher Re-Scan + E-Mail-Alert
- **Gefunden auf**: Pricing (Starter Bullet)
- **Implementierungsstatus**: partial
- **Evidenz im Code**: `audit-recheck-cron` Edge Function existiert. Email-Pfad via `audit-recheck-subscriptions` + Resend.
- **Risiko**: medium — **operativ blockiert durch fehlenden Resend-Vault-Key**
- **Empfohlene Copy**: bleibt, aber P0-Runbook abarbeiten bevor Bewerbung an Pilotkunden

### Tägliches Monitoring + Drift-Detection
- **Gefunden auf**: Pricing (Growth Bullet)
- **Implementierungsstatus**: partial
- **Evidenz im Code**: Drift-Detection-Logik in Shopify-Pipeline (PR feat/shopify-integration). Für DSGVO-Audit selbst: re-runs verglichen mit Vorgänger, aber **kein dediziertes Daily-Cron-System** für regelmäßige Re-Scans heute live.
- **Risiko**: medium
- **Empfohlene Copy**: "Wöchentliches Monitoring" oder "On-demand Drift-Detection nach Theme-/App-Änderungen" bis Daily-Cron operationalisiert

### Consent-Timing-Analyse
- **Gefunden auf**: Pricing (Growth Bullet), Differenzierer-Section
- **Implementierungsstatus**: partial
- **Evidenz im Code**: Static-HTML-Detection erkennt Pre-Consent-Tracker. **Volle Playwright-Headless-Analyse mit JS-Render** noch nicht standardmäßig aktiviert (verfügbar als Code-Pfad in `gdpr-audit/playwright-mode`, aber Production-default ist static).
- **Risiko**: medium
- **Empfohlene Copy**: "Statische Consent-Timing-Indikatoren" mit Note zu "Headless-Browser-Tiefe im Growth-Tarif"

### Fix-Empfehlungen mit Code-Snippets zum Copy-Paste
- **Gefunden auf**: Pricing (Growth Bullet), Differenzierer
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: `governance-remediate` Edge Function (PR #163) + UI `RemediationPanel.tsx` (PR #164). 5 Patterns live.
- **Risiko**: low

### White-Label-Reports mit eigenem Logo
- **Gefunden auf**: Pricing (Agency Bullet)
- **Implementierungsstatus**: partial
- **Evidenz im Code**: Report-Templates haben Logo-Variable, aber **keine UI um per-Tenant Logo hochzuladen**.
- **Risiko**: high — Agency-Kunden würden das Feature reklamieren
- **Empfohlene Copy**: "White-Label-Reports (Logo-Upload via Support, UI in Vorbereitung)"

### Multi-Tenant-Dashboard (10 Kundenseiten inklusive)
- **Gefunden auf**: Pricing (Agency Bullet)
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: TenantProvider + memberships-RLS + Switcher in UI. Limit "10 Sites" ist nicht hart enforced — derzeit keine Quota-Check.
- **Risiko**: medium
- **Empfohlene Copy**: bleibt — Quota kann später als Soft-Limit eingebaut werden

### API und Webhooks
- **Gefunden auf**: Pricing (Agency Bullet), /developers Page
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: Ingest-API via `governance-ingest` Edge Function + per-Tenant API Keys. Webhooks via `governance-webhooks` Function.
- **Risiko**: low — **Public OpenAPI fehlt aber**
- **Empfohlene Copy**: bleibt; OpenAPI-Spec als nächste Lieferung

### AI-Act Governance-Modul
- **Gefunden auf**: Pricing (Enterprise Bullet), RoadmapSection
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: `ai-act-classify` Function, `dpias` Table, AI-Act-Annex-III-Mapping in Rule-Engine.
- **Risiko**: low

### DSB-Integration
- **Gefunden auf**: Pricing (Enterprise Bullet)
- **Implementierungsstatus**: partial
- **Evidenz im Code**: `dsr_requests` Table + UI für DSR-Tracking. **DSB-Notification-Pfad (Email + Slack) für Approval-Workflows noch nicht gewired.**
- **Risiko**: medium
- **Empfohlene Copy**: "DSB-Integration (DSR-Tracking + Workflow-Approvals; Notification-Channels in Vorbereitung)"

### Evidence Vault (Hash-Chain + HMAC-Signaturen)
- **Gefunden auf**: Pricing (Enterprise Bullet), /trust, /evidence-vault Content-Hub
- **Implementierungsstatus**: partial
- **Evidenz im Code**: Schema in PR #153 Blueprint dokumentiert, `governance_evidence` Table existiert. **Hash-Chain-Trigger (chain_index, prev_sha256) sind im Schema, aber Trigger-Function noch nicht migriert.**
- **Risiko**: high
- **Empfohlene Copy**: "Evidence Vault Beta (Hash-Chain-Trigger in Aktivierung) — produktiv für Enterprise-Pilot in 2026 Q3"

### Compliance-Agenten Beta
- **Gefunden auf**: RoadmapSection (Status Beta nach PR #166), /governance Chat-Widget
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: `governance-agent` Edge Function (PR #154), `AgentWidget` UI (PR #156), `agent_runs` Table.
- **Risiko**: low — **operativ blockiert durch fehlenden anthropic_api_key Vault-Eintrag**

### Shopify Integration
- **Gefunden auf**: RoadmapSection (Status Beta nach feat/shopify-integration), /integrations/shopify
- **Implementierungsstatus**: delivered
- **Evidenz im Code**: 4 Edge Functions + Migration + UI in feat/shopify-integration Branch. GraphQL Admin API v2026-01.
- **Risiko**: low — read-only Scopes, defensive copy bei Pre-Consent

### Slack/Teams Alerts
- **Gefunden auf**: RoadmapSection (Status: In Entwicklung)
- **Implementierungsstatus**: partial
- **Evidenz im Code**: `governance-webhooks` Edge Function unterstützt Generic-Webhook + Slack-Payload-Format. **Teams Connector + native UI für Channel-Subscription fehlen.**
- **Risiko**: low — Status "In Entwicklung" entspricht der Realität

### CI/CD Integration
- **Gefunden auf**: RoadmapSection (Status: In Entwicklung)
- **Implementierungsstatus**: missing
- **Evidenz im Code**: GitHub Actions Workflow + Vercel/Netlify-Hooks noch nicht im Code.
- **Risiko**: low — Status "In Entwicklung" markiert es ehrlich

---

## Sonderbefund: Stale Bronze/Silver/Gold-Tiers

In folgenden Dateien finden sich **veraltete Pricing-Tiers** (Bronze/Silver/Gold mit 29/99/299 €) statt der aktuellen 5-Tier-Struktur (Starter/Growth/Agency/Enterprise mit 79/249/699/ab 1500 €):

- `src/pages/BaitMaRiskGuide.tsx:115` — "Silver 99 €/Monat (passt für KMU-FinTechs bis ~50 Mitarbeitende)"
- `src/pages/Faq.tsx:65-66` — "Silver 99 €/Monat", "Gold 299 €/Monat"
- `src/pages/Press.tsx:11` — "Bronze 29 €/M · Silver 99 €/M · Gold 299 €/M"
- `src/pages/LegalTechLanding.tsx:77-78` — "Silver 99 €/M", "Gold 299 €/M"

Plus:

- `src/components/sections/ProductDifferentiationSection.tsx:44` — "Growth ab 199 €/Monat" (sollte 249 € sein)

**Empfehlung:** Alle 5 Stellen in **derselben Mini-PR** korrigieren. Details in `fix-plan.md` P1.
