# Missing-Features-Report — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Priorisiert nach Auswirkung. P0 = blockiert Nutzerfluss · P1 = blockiert Zahlung/Conversion · P2 = blockiert Enterprise-Verkauf · P3 = Government/GovTech · P4 = Nice-to-have.

## P0 — blockiert Nutzerfluss
| # | Lücke | Beleg | Status |
|---|---|---|---|
| P0-1 | **`tsc`/Lint rot (16 Fehler)** im neuen Design-System (PR #663). Build grün (esbuild typecheckt nicht), aber CI-`ci.yml` (`tsc`) war rot und blockierte saubere Releases. | `npm run lint` → 16 `error TS`, alle in `src/components/{ui,forms,data,layout,navigation}` | ✅ **behoben** in diesem Audit (nicht-existente DOM-Typen `HTML{Nav,Aside}Element`→`HTMLElement`, `Ul/FieldSetHTMLAttributes`→korrekt, `size`-Prop-Kollision via `Omit`, doppelter `FormError`-Export aliasiert, `useRef`-Initialwert, `TimelineItemProps`-Export). `tsc` jetzt 0 Fehler. |
| P0-2 | ~~Telemetrie-404 auf jeder Seite (env-lose Builds)~~ | `src/lib/track.ts` | ✅ **behoben** in diesem Audit |

> Hinweis: Es wurden **keine** harten Routing-/Render-Blocker auf öffentlichen Seiten gefunden (E2E 48/48 grün). P0-1 ist „Release-Hygiene"-blockierend, kein Nutzer-Render-Blocker.

## P1 — blockiert Zahlung/Conversion
| # | Lücke | Empfehlung |
|---|---|---|
| P1-1 | **Stripe-Test-Mode-E2E** fehlt (Session→Webhook→Entitlement nicht automatisiert verifiziert) | Test-Mode-Flow in CI |
| P1-2 | **CTA-Enforcement-CI-Scope-Lücke** (`src/features`/`src/marketing`/`src/enterprise-os` ungescannt) | Scope auf `src/**` erweitern |
| P1-3 | **Rate-Limit** auf `stripe-checkout`/`stripe-portal` fehlt | Per-User/IP-Limit |

## P2 — blockiert Enterprise-Verkauf
| # | Lücke | Status |
|---|---|---|
| P2-1 | **SSO/SAML** | nicht gefunden |
| P2-2 | **SCIM** (User-Provisioning) | nicht gefunden |
| P2-3 | **MFA** | teilweise (`mfa-admin-reset`, `mfa-recovery-redeem` vorhanden; AAL2 observe-only, nicht erzwungen) |
| P2-4 | **Trust Center / öffentliche Security-Seite mit Subprocessor-Liste** | `/trust`, `/security`, `/legal/sub-processors` vorhanden — Pen-Test/Zertifikate fehlen |
| P2-5 | **Pen-Test / ISO 27001 / SOC2 / BSI C5 Roadmap** | nicht im Repo belegt |
| P2-6 | **White-Label-Konfiguration** | Claim vorhanden, Backend nicht verifiziert |
| P2-7 | **Enterprise Agent echte Datenanbindung** (`/os` = Mockdata) | Prototyp |
| P2-8 | **DB-Backup/PITR + dokumentierter Restore-Drill** | nur VPS-tar.gz (7 Tage); Postgres-PITR nicht im Repo |
| P2-9 | **CSP ohne `unsafe-inline`** + Header-Durchsetzung am echten Host (GitHub-Pages ignoriert `_headers`) | RISK |
| P2-10 | **On-Call/SLA + Incident-Playbook** | nicht im Repo belegt |
| P2-11 | **PO-/Invoice-Billing** (manuelle Rechnung statt Stripe-Card) | nicht gefunden |
| P2-12 | **AAL2 erzwingen** (statt observe-only) für Billing/Team/Evidence | offen |

## P3 — blockiert Government/GovTech
| # | Lücke | Status |
|---|---|---|
| P3-1 | **FRIA** (Fundamental Rights Impact Assessment) als eigener Schritt | fehlt (nur DPIA/DSFA) |
| P3-2 | **Annex-IV-Dokumentation** (AI-Act techn. Doku) | nicht explizit |
| P3-3 | **KRITIS / NIS2**-Module | nur Legal-RAG/SEO-Content, keine Funktion |
| P3-4 | `/os/*`-Prototyp nicht `noindex`/Flag | offen |

## P4 — Nice-to-have
| # | Lücke | Status |
|---|---|---|
| P4-1 | **Product Tour / App-Onboarding-Walkthrough** | `/app/onboarding`-View vorhanden; geführte Tour unklar |
| P4-2 | **Analytics/Telemetry** | `track-pageview` vorhanden (jetzt gehärtet) |
| P4-3 | **Error Monitoring** | Sentry (`@sentry/react`) als Dependency vorhanden — Aktivierung am Host prüfen |
| P4-4 | **Bundle-Splitting** | Build warnt: mehrere Chunks > 600 kB (`index` 1.5 MB, `vendor-pdf` 1 MB, `vendor-three` 0.9 MB) → dynamic import |
| P4-5 | **Duplicate-Route `/app/agents`** entfernen | offen |
