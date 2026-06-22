# Workflow-Matrix — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Bewertung 0–100 je Funnel. Score = (öffentlich/E2E-verifizierter Anteil) gewichtet mit Code-Beleg. Auth-gegatete Schritte sind ohne Test-Login nur code-seitig beurteilt.

| Workflow | Kette | Score | Begründung |
|---|---|---|---|
| **Public Funnel** | Landing → Pricing → Signup/Login → App | **85** | Landing/Pricing/Checkout-Routen E2E grün; Auth-Redirects vorhanden; App-Eintritt nur code-verifiziert (kein Test-Login). |
| **Audit Funnel** | Landing → Audit starten → Website → Scan → Ergebnis → Report → Upgrade | **80** | Routen `/audit`, `/audit/result/:id`, Report-PDF/E-Mail-Functions, Upgrade-CTA vorhanden. **CTA-Fix** (Demo-Call → Enterprise anfragen) auf Ergebnisseite umgesetzt. Live-Scan-Pfad nicht end-to-end getestet (braucht Scanner-Backend). |
| **Checkout Funnel** | Pricing → Plan → Stripe → Success → Entitlements | **78** | Routen + Consent-Gate + `stripe-checkout` code-verifiziert; Webhook→Entitlement stark (Idempotenz). Kein Live-Stripe-Test (Test-Mode-E2E empfohlen, P2). |
| **Governance Workflow** | Website + → Monitoring → Findings → Tasks → Evidence → Report | **75** | Vollständige Function-/View-Abdeckung (`websites`, `monitoring*`, `remediation`, `evidence*`, `compliance`). Reale Datenanbindung nur in App (auth) prüfbar. |
| **AI-Act Workflow** | KI-System registrieren → Klassifizieren → Risiko → DSFA/FRIA → Evidence | **70** | `ai-act-classify` + `ai-act-risk-inventory` + Registry-View vorhanden. **FRIA** als eigenständiger Schritt fehlt (nur DPIA/DSFA). → Missing-Report P3. |
| **Evidence Workflow** | Finding → Evidence → Hash → Export → Report | **78** | `evidence-export`, `evidence-vault-export`, `_shared/hash.ts`; Vault-UI vorhanden. Export auth-gegated. |
| **Enterprise Agent Workflow** | Enterprise Agent → Automatisierung → Ergebnis → Report/Evidence | **45** | `/os/*`-App ist **Mockdata** (keine echte Datenanbindung); `enterprise-ai-os-*`-Public-Functions existieren (Intake/Feedback/Founding-Access). Echter Agent-Run-Pfad nicht produktiv verdrahtet. → größte Lücke. |
| **Admin Workflow** | Login → Tenant → Mitglieder/Rollen → Billing → Settings | **72** | `tenant-members/-invite/-audit`, `RequireAal2` für Team/Billing, Admin-Views vorhanden. AAL2 **observe-only** (nicht erzwungen). Nur code-verifiziert. |

## Gesamt (gewichteter Mittelwert): **~72/100**

## Größte Lücken
1. **Enterprise Agent / `/os`** ohne echte Datenanbindung (Mockdata) — Score-Treiber nach unten.
2. **AAL2** durchgängig nur beobachtend → Sicherheits-Workflows formal unvollständig.
3. **FRIA** fehlt als eigener AI-Act-Schritt.
4. Fehlende Live-/Auth-E2E-Abdeckung (Checkout-Webhook, App-Funnels) — Scores konservativ gehalten.
