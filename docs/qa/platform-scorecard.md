# Platform-Scorecard — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Scores 0–100, evidenzbasiert. „Code-verifiziert" ≠ „live-verifiziert" — auth-/zahlungs-gegatete Pfade konnten ohne Test-Login/Stripe-Test nicht end-to-end durchlaufen werden; entsprechende Scores sind bewusst konservativ.

## Scores

| Bereich | Score | Kurzbegründung |
|---|---:|---|
| Frontend | 82 | Build grün, E2E 48/48 grün, **16 `tsc`-Fehler behoben** (PR #668); große Bundles bleiben |
| Routing | 82 | 318 Pfade, 404 sauber, 1 Duplicate-Route; **Live-Probe: Cloudflare-SPA-Deep-Links → HTTP 404** (R4) — Fallback nur via `404.html`-JS-Redirect, nicht via `_redirects`-200 |
| Buttons/CTAs | 80 | keine toten Buttons; 4 verbotene CTAs (1 Hauptpfad behoben, Rest dokumentiert/CI-Lücke) |
| Auth | 70 | Supabase-Auth + AAL2 vorhanden, aber AAL2 **observe-only**; kein SSO/SCIM |
| Tenant/RBAC | 80 | RLS durchgängig, owner/admin-Checks, Tenant-Functions; live nur code-verifiziert |
| Checkout | 82 | Routen + Consent-Gate + Self-Service sauber; kein Live-Test |
| Stripe | 80 | Webhook-Idempotenz/HMAC stark, Vault-Secrets; Rate-Limit fehlt |
| Backend | 82 | 87 Functions, Shared-Gateway, konsistentes Logging |
| Database | 80 | 160 Migrations, append-only-CI, RLS |
| Governance Engine | 78 | Risk-Score/Remediation/Monitoring real implementiert |
| AI Act | 72 | Klassifikation + Risk-Inventory; FRIA/Annex-IV fehlen |
| DSGVO | 82 | Export/Delete/DSR/Erasure-Sweeper + AVV |
| Monitoring | 70 | Cron-basiert (nicht real-time); UI vorhanden |
| Evidence | 80 | Export + Vault + Hash + Audit-Log |
| Enterprise Agent | 45 | `/os`-App = Mockdata, keine echte Datenanbindung |
| Infrastructure | 58 | GitHub Pages + Supabase solide; `_headers` auf GH-Pages wirkungslos (RISK); **Live-Probe: Custom-Domain `realsyncdynamicsai.de` → HTTP 500 (R5, P1)**, Cloudflare-SPA-Fallback greift nicht (R4); 3 parallele Vercel-Projekte erzeugen Deploy-Rauschen (`deployment-noise-register.md`) |
| Security | 62 | HSTS/RLS gut; CSP `unsafe-inline`, AAL2 nicht erzwungen, kein Pen-Test-Nachweis |
| Operations | 58 | tägl. VPS-Backup; kein PITR/Restore-Drill/On-Call/Playbook im Repo |
| Enterprise Readiness | 50 | kein SSO/SCIM/PO-Billing/White-Label-Beleg/Zertifikate |
| Government Readiness | 42 | FRIA/Annex-IV/KRITIS/NIS2-Funktionen fehlen |

## Gesamtscore: **70/100** (ungewichteter Mittelwert ≈ 70,3 nach Live-Probe-Korrekturen R4/R5)

## Top 10 funktionierende Bereiche
1. Routing (82) — 318 Pfade, 404 sauber (Cloudflare-Deep-Link-404 separat als R4 erfasst)
2. Unit-Tests (1602 grün) + neue E2E (48/48)
3. Stripe-Webhook-Idempotenz/HMAC
4. DSGVO-Lifecycle (Export/Delete/DSR)
5. Tenant/RLS-Isolation
6. Evidence/Audit-Logging (Prüfpfad)
7. Checkout-Consent-Gate (§312k/§356(5) BGB)
8. Governance-Risk-Score (deterministisch)
9. EU-Souveränität (Frankfurt + Ollama + Residency-Toggle)
10. Vault-first Secret-Handling

## Top 10 kaputte/schwache Bereiche
1. Enterprise Agent `/os` = Mockdata (45)
2. Government Readiness (42)
3. Operations/Restore-Drill (58)
4. Security: CSP `unsafe-inline` + AAL2 observe-only (62)
5. `tsc` 16 Fehler (Release-Hygiene)
6. `_headers` auf GitHub Pages wirkungslos (Infra-RISK)
7. CTA-Enforcement-CI-Scope-Lücke
8. Kein SSO/SCIM (Enterprise)
9. White-Label-Claim unbelegt
10. Große JS-Bundles (>1 MB) ohne Splitting

## Top 10 P0-Fixes
1. `tsc`-Fehler im Design-System beheben (16) — *P0-Hygiene*
2. ~~Telemetrie-404 härten~~ ✅ erledigt
3. CSP/Header-Durchsetzung am echten Production-Host verifizieren
4. AAL2 für Billing/Team/Evidence **erzwingen**
5. CTA-Enforcement-Scope auf `src/**` erweitern
6. Duplicate-Route `/app/agents` entfernen
7. `/os`-Prototyp `noindex`/Flag
8. Stripe-Checkout Rate-Limit
9. `body.pilot` server-seitig autorisieren
10. Restore-Drill dokumentieren/testen

## Top 10 P1-Fixes
1. Stripe-Test-Mode-E2E in CI
2. `/os` echte Datenanbindung oder klare Prototyp-Kennzeichnung
3. SSO/SAML
4. White-Label belegen/implementieren
5. PITR/DB-Backup-Strategie dokumentieren
6. „Auto-Fix"/„real-time"-Claims abschwächen
7. Bundle-Splitting (dynamic import three/pdf/charts)
8. Sentry-Aktivierung verifizieren
9. FRIA-Schritt im AI-Act-Workflow
10. On-Call/Incident-Playbook

## Weg zu 90/100
- **Security 62→85:** CSP ohne unsafe-inline, AAL2 erzwingen, Header am echten Host, Pen-Test.
- **Enterprise Agent 45→80:** `/os` an echte Functions/Daten anbinden.
- **Operations 58→85:** PITR + Restore-Drill + On-Call + Playbook.
- **Enterprise/Government 50/42→75:** SSO/SCIM, FRIA/Annex-IV, PO-Billing.
- **Frontend 78→90:** `tsc` grün, Bundle-Splitting.
- Erwarteter Gesamteffekt: **71 → ~88–90**.
