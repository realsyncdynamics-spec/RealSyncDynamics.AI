# Landing-to-Runtime Parity Matrix

**Stand:** 2026-10-13  
**Referenz-Commit (main):** `85402fcf9f5394adb54ec2a6454f375fa7cd5a9e`  
**Kanonische Landing:** `/` → `src/pages/LandingV4.tsx` + `src/components/landing/v4/landing-v4-content.ts`  
**Quellen:** Landing-v4-content, `src/product/implementation-status.ts`, `shared/pricing.ts`, offene PRs, `docs/qa/claim-to-feature-audit.md`

Ziel: Jeder öffentlich beworbene Claim hat einen nachweisbaren technischen Pfad  
`Landing → CTA → Auth → Tenant → Entitlement → Policy → Risk → Approval → Execution → Verification → Evidence → Reporting`

Status-Legende:  
- **FULL**: End-to-End nutzbar, serverseitig abgesichert, getestet, in Produktion verifiziert  
- **PARTIAL**: Teilweise vorhanden, aber Lücken in Execution, Isolation, Evidence oder Verifikation  
- **BLOCKED**: Code vorhanden, aber durch Credentials, Secrets, externe Abhängigkeiten oder offene PRs blockiert  
- **MISSING**: Kein oder nur Mock-/Frontend-Pfad

Priorität: P0 (Sicherheit + Kundenaktivierung) → P1 (Governance-Kern + Report) → P2 (Tools + Billing-Vollständigkeit)

---

## Matrix

| Claim | Quelle | Frontend | Backend | Persistenz | Auth | Entitlement | Execution | Evidence | Tests | Produktion | Status | Priorität | Folge-PR |
|-------|--------|----------|---------|------------|------|-------------|-----------|----------|-------|------------|--------|-----------|----------|
| Kostenloser Governance-Scan (90s, Cookies/Tracker/KI) | Landing Hero / `/audit` | `AuditLanding.tsx` | `supabase/functions/gdpr-audit` | `gdpr_audits` | Anonym möglich | Free | Ja (statisch + optional Playwright) | Scan-Report | Unit + E2E vorhanden | Live | PARTIAL (SSRF-Härtung in #1860) | P0 | #1860 |
| Audit-Ergebnis → Registrierung → Tenant-Claim | `/audit` → Signup → Workspace | Onboarding-Flows | Claim-Writer (geplant) | `gdpr_audits` + memberships | JWT + Membership | Free | Nein (UUID allein unsicher) | Claim-Event | Fehlend | Nicht verifiziert | BLOCKED | P0 | #1867 |
| Workspace-Onboarding (Org, Branchen, KI-Systeme, Frameworks) | Post-Audit Funnel | `GovernanceActivation` / WP2 | `provision-tenant` | Tenant-Tabellen | JWT | Free/Starter | Teilweise | Activation-Evidence | Teilweise | Live (Basis) | PARTIAL | P0 | #1841 |
| EU-AI-Act-Klassifizierung (öffentlich) | `/ai-act-klassifikator` | `AiActClassifier.tsx` | `ai-act-classify` | Keine (ohne Persist) | Anonym | Free | Ja | Keine | Unit | Live | FULL (ohne Inventar-Persist) | P1 | - |
| AI-Act Inventar Persistenz | `/app/risk-inventory` | Button vorhanden | `ai-act-risk-inventory` | `governance_assets` | JWT + Membership | Plan-Gate | Nein | Fehlt | Fehlend | Nicht | MISSING | P1 | - |
| Governance Runtime (Risk, Approvals, DSR, DSFA, Vendors) | `/governance-runtime` / `/app` | Shell + Module | Verschiedene Edge Functions | RLS-Tabellen | JWT + RLS | Plan-abhängig | Teilweise | Teilweise | Integration vorhanden | Live | PARTIAL | P1 | #1724 |
| Evidence Vault / Hash-Chain | `/app/evidence` | Evidence-Views | `governance-ingest`, `evidence-r2` | `governance_evidence` + R2 | JWT | Plan | Ja (append-only) | Hash-Chain | Tests vorhanden | Live (R2 Secrets?) | PARTIAL | P1 | - |
| Policy Engine | `/policy-engine` | Policy-UI | Policy-Functions | Policies-Tabelle | JWT | Plan | Teilweise (nicht überall Blocking) | Decision-Logs | Unit | Live | PARTIAL | P1 | - |
| AI Gateway (Routing, Logging, EU-Option) | Dashboard / Optimizer | Gateway-UI | `ai-invoke` etc. | Usage-Logs | JWT | Plan + Quota | Ja | Call-Logs | Unit | Live | PARTIAL | P1 | - |
| KI-Governance-Report (individuell, PDF) | Dashboard / Report | Report-UI | `audit-report-pdf` (HTML?) | Report-Objekte | JWT | Plan | Nein (HTML statt PDF) | Fehlt | Fehlend | Nicht | BLOCKED | P1 | #1868 / #1866 |
| WhatsApp Bot | Tools-Sektion | Bot-Builder | Provider-Adapter | Conversations | JWT | Plan | Nein (kein Provider) | Fehlt | Fehlend | Nicht | MISSING | P2 | - |
| Telefonbot / Voice | Tools-Sektion | Bot-Builder | Voice-Adapter | Call-Logs | JWT | Plan | Nein | Fehlt | Fehlend | Nicht | MISSING | P2 | - |
| Website-Chatbot | Tools / Builder | Chat-Config | Bot-Runtime | Conversations | JWT | Plan | Teilweise | Teilweise | Teilweise | Preview | PARTIAL | P2 | - |
| DSGVO Web App Builder / SiteOS | `/build` | BuildStudio | SiteOS Functions | Projects | JWT | siteos.builder | Preview only | Teilweise | Unit | Preview | PARTIAL | P1 | #1862 |
| Claude Code Optimizer | Tools / `/claude-code-optimizer` | Optimizer-UI | Repo-Analyse | Findings | JWT + GitHub | Plan | Teilweise | Fehlt | Fehlend | Nicht | PARTIAL | P1 | - |
| Monatspläne Starter/Growth/Agency | Pricing-Sektion | Checkout-CTAs | `stripe-checkout` + Webhook | Subscriptions | JWT | Plan | Ja (Testmodus) | Billing-Events | Unit | Live (Test) | PARTIAL (kein Full Revenue-Test) | P1 | - |
| Dashboard-Vorschau (statische KPIs) | Landing Workspace | Statisch (bewusst) | - | - | - | - | Beispiel | - | - | Live (als Beispiel gekennzeichnet) | FULL (als Beispiel) | - | - |
| Echtes Dashboard (reale Mandantendaten) | `/app/dashboard` | CommandCenter | Verschiedene Queries | Tenant-Daten | JWT + RLS | Plan | Ja | - | Integration | Live | PARTIAL (keine Fake-Daten) | P1 | - |

---

## Offene P0-Blocker (Stand 2026-10-13)

1. **SSRF-Schutz öffentlicher Scans** — PR #1860 (needs-rebase). Muss DNS-Rebinding, Redirects, private IPs, Metadata-Endpoints abdecken.
2. **Audit-Claim mit expliziter Tenant-Auswahl** — Draft-PR #1867. UUID allein darf nicht autorisieren; Multi-Tenant-Auswahl erforderlich.
3. **Onboarding ohne Sackgasse** — #1841. Persistenz nach Bestätigung, nicht nur localStorage.
4. **Keine Erfolgsmeldungen ohne reale Ausführung** — systemweit prüfen.

## Nächste Schritte (nicht-blockierend)

- Phase 0: Diese Matrix aktualisieren nach Verifikation der offenen PRs.
- Phase 1: P0-Härtungen mergen (nach Review + CI), dann Audit-Funnel E2E testen.
- Koordination mit Claude Code: Vermeide parallele Änderungen an `gdpr-audit`, Claim-Writer und Report-PDF.

**Definition of Done für FULL:** Kunde kann die Funktion erreichen und bedienen → Backend führt reale Aktion aus → serverseitige Auth/Entitlement/RLS → Persistenz + Reload → Evidence → Tests bestanden → Staging verifiziert → Produktion separat bestätigt.
