# Backend-/Edge-Function-Report — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Generiert via `scripts/qa/backend-function-inventory.mjs` + Code-Review (Stripe/GDPR/AI-Act/Governance/Evidence).
> Vollständige Tabelle: `docs/qa/backend-function-inventory.generated.md` (88 Functions).

## Kategorien-Verteilung (heuristisch, Scanner)

| Kategorie | Anzahl |
|---|---|
| JWT_REQUIRED | 33 |
| GOVERNANCE | 13 |
| PUBLIC | ~17 |
| CRON_ONLY | 8 |
| STRIPE_WEBHOOK/RECEIVER | 7 |
| STRIPE | 4 |
| GDPR | 3 |
| MONITORING | 3 |
| AI_ACT | 2 |
| AI_GATEWAY | 2 |
| EVIDENCE | 2 |

(Summe ≈ 88; Kategorisierung heuristisch aus Namen + `verify_jwt` aus `supabase/config.toml`.)

## Shared-Gateway (`supabase/functions/_shared/`)

| Helper | Zweck |
|---|---|
| `gateway.ts` | CORS, `jsonResponse`/`jsonError`/`handleOptions`, einheitliches Fehlerformat `{ ok:false, error:{code,message} }` |
| `health.ts` | DB-Ping (`health_ping()`), Env-Validierung, Status `ok/degraded/down` |
| `requireAal2.ts` | `observeAal2()` — AAL2-Beobachtung (P0d Phase 1: observe-only, **noch nicht blockierend**) |
| `ai.ts` | AI-Tool-Invocation + Logging in `ai_tool_runs` |
| `entitlements.ts` | Feature-Gating / Quota |
| `auditLog.ts` | Schreibt `governance_admin_audit_log` |
| `aiGateway/rateLimit.ts` | Per-IP-Rate-Limit für öffentliche AI-Endpunkte |

## Auth-Patterns (verifiziert)

- **`verify_jwt=false`** (bewusst öffentlich, `config.toml`): Webhooks/Receiver (`stripe-webhook`, `shopify-webhooks`, `governance-ingest`, `governance-webhooks`, `*-callback`, `newsletter-confirm`, `checkout-website-rebuild`), Gratis-Tools (`gdpr-audit`, `cookie-scan*`, `ai-gateway`, `ai-act-classify`, `audit-report-*`, `sales-lead`, `newsletter-subscribe`, `track-pageview`, `marketing-event`, `health`), Enterprise-AI-OS-Public-Surfaces.
- **`verify_jwt=true` (Default)**: alle übrigen; zusätzlich Tenant-/Rollen-Checks im Code (z. B. `stripe-checkout`/`stripe-portal` owner/admin, `governance-dsr`/`governance-vendors` eigener Tenant-Check).
- **Service-Role**: Webhooks + Cron nutzen korrekt Service-Role statt User-JWT.

## Stärken
1. **Idempotenz** im Stripe-Webhook (event-dedup + Rollback).
2. **Vault-first Secrets** (Stripe-Key/Webhook-Secret) — Rotation ohne Redeploy.
3. **Service-Role-Isolation** sauber getrennt von User-JWT.
4. **Konsistentes Logging** (`ai_tool_runs`, `workflow_runs`, `governance_admin_audit_log`) — Prüfpfad-Grundlage.
5. **GDPR-Lifecycle** vollständig: `gdpr-export` (Art. 15, keine Redaktion — bewusst), `gdpr-delete` (Art. 17, mehrstufige Bestätigung), `governance-dsr`, `governance-erasure-sweeper`.

## Risiken / Lücken

| # | Function(s) | Risiko | Prio |
|---|---|---|---|
| B1 | `stripe-checkout`, `stripe-portal` | kein Rate-Limit | P2 |
| B2 | `stripe-checkout` | `body.pilot` client-vertrauend | P2 |
| B3 | `stripe-portal`, `gdpr-export`, `gdpr-delete`, `evidence-export` | AAL2 nur observe-only (nicht erzwungen) | P2 |
| B4 | `governance-ingest`, `governance-webhooks` | API-Key-Auth — Rotation/Revoke testen | P3 |
| B5 | `stripe-webhook` | Tenant-Fallback-Logging fehlt | P3 |

## FE-Anbindung (Scanner-Heuristik)
Der Scanner flaggt ~29 Functions als „möglicherweise nicht im Frontend verdrahtet". **Achtung Fehlalarme:** Cron/Webhook/Mailer (`*-cron`, `stripe-webhook`, `welcome-email`) sind absichtlich ohne FE-Aufruf; einige (z. B. `stripe-portal`) werden über Konstanten/Helper aufgerufen und nur heuristisch verfehlt. Liste in `backend-function-inventory.generated.md` als Startpunkt für manuelle Prüfung — **kein** automatisches Löschen.

## Reproduktion
```
node scripts/qa/backend-function-inventory.mjs        # Markdown-Tabelle
node scripts/qa/backend-function-inventory.mjs --json  # maschinenlesbar
node scripts/qa/backend-smoke-test.mjs                 # Drift-Check (static) → ALLE CHECKS OK
node scripts/qa/backend-smoke-test.mjs --live          # optional, mit SUPABASE_URL/ANON_KEY
```
Static-Smoke-Test-Ergebnis: **ALLE CHECKS OK** (jede `config.toml`-Function hat Ordner + Entrypoint; Webhooks korrekt `verify_jwt=false`).
