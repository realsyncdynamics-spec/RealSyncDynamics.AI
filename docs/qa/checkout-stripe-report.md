# Checkout-/Stripe-Report — RealSyncDynamics.AI

> QA-Audit 2026-06-22 · Quellen: `src/config/pricing.ts`, `src/features/billing/*`, `supabase/functions/stripe-*`, `e2e/checkout.spec.ts`.

## Pricing-Modell (`src/config/pricing.ts` — Single Source of Truth)

| Tier | Preis | plan_key | CTA | Ziel | Recurring |
|---|---|---|---|---|---|
| Free Audit | 0 € (kein Account) | `free_audit` | „Kostenlos starten" | `/audit?source=pricing-free` | nein |
| Starter | 79 €/M | `starter` | „Jetzt upgraden" | `/checkout/starter` | ja |
| Growth | 249 €/M (Highlight) | `growth` | „Jetzt upgraden" | `/checkout/growth` | ja |
| Agency | 699 €/M | `agency` | „14 Tage Agency testen" | `/checkout/agency` | ja |
| Scale | 1.999 €/M | `scale` | „Scale anfragen" | `/contact-sales?tier=scale` | ja (manuelles Onboarding) |
| Enterprise | individuell | `enterprise` | „Enterprise anfragen" | `/contact-sales?tier=enterprise` | custom |

`VALID_PLAN_KEYS` für Self-Service-Checkout: **`starter`, `growth`, `agency`**. Free → `/audit`, Enterprise/Scale → `/contact-sales`.

## Checkout-Flow (`CheckoutPage.tsx`)

```
Pricing-CTA → /checkout/:planKey
  ├─ Auth-Check (Supabase): kein User → OAuth/Magic-Link (redirectAfterAuthTo)
  ├─ kein Tenant → Tenant-Anlage → /welcome?next=/checkout/:plan
  └─ ready → Consent-Gate (§312k + §356(5) BGB: 2 Pflicht-Checkboxen)
        → createCheckoutSession(tenantId, planKey, pilot?)
        → POST /functions/v1/stripe-checkout  { tenant_id, plan_key, return_url, pilot }
        → window.location.href = result.url   (Stripe-Hosted-Checkout)
        → /checkout/success | /checkout/cancelled
```

E2E (`e2e/checkout.spec.ts`, 8 Tests, **alle grün** gegen Production-Build):
- Pricing zeigt Self-Serve-CTAs (`/checkout/starter`, `/audit`, `/contact-sales`).
- `/checkout/{starter,growth,agency}` rendern (Auth-/Consent-Gate), kein 404.
- `/checkout/free` → leitet Richtung `/audit`; `/checkout/enterprise` → `/contact-sales`.
- `/checkout/success` + `/checkout/cancelled` rendern.

> **Nicht getestet (kein Stripe-Live, kein Login):** echte Session-Erzeugung, Webhook-Verarbeitung, Portal, Meter-Sync. Diese sind code-seitig geprüft (s. u.), aber für eine End-to-End-Zahlungsverifikation braucht es eine Test-Stripe-Umgebung + Test-Login.

## Edge-Functions (Code-Review)

### `stripe-checkout` — JWT, Owner/Admin
- Verifiziert Bearer-JWT (`auth.getUser()`), prüft Tenant-Mitgliedschaft (nur owner/admin), lehnt Free-Plan ab.
- Liest `products`, `subscriptions`; legt Stripe-Customer + Session an (kein DB-Write).
- Secret `STRIPE_SECRET_KEY` (Vault-first). Fehlerpfade sauber mit CORS-JSON.
- **Risiko:** kein Rate-Limit auf Checkout-Erzeugung; `body.pilot` client-seitig ungeprüft.

### `stripe-webhook` — `verify_jwt=false`, HMAC
- HMAC-SHA256-Signaturprüfung (`constructEventAsync`); Tenant aus Metadata (Fallback: `subscriptions`-Lookup).
- **Idempotenz exzellent:** `webhook_events` mit `ON CONFLICT DO NOTHING`, Rollback der Idempotenz-Zeile bei Handler-Fehler → Stripe-Retry.
- Schreibt `subscriptions`, `stripe_invoices`, `stripe_payment_events`, `stripe_trial_events`, `customer_onboarding`.
- Secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (Vault-first). Triggert `rebuild-website` via `waitUntil` (fire-and-forget).
- **Risiko:** Tenant-Fallback könnte bei Customer-Reuse kollidieren (Logging empfohlen); Ad-Platform-Fanout schluckt Fehler (bewusst).

### `stripe-portal` — JWT, Owner/Admin
- Membership-/Rollen-Check, AAL2-Observe; liest `subscriptions.stripe_customer_id`; 404 wenn kein Customer. Sauber.

### `stripe-meter-sync` — Cron, Shared-Secret
- `Authorization: Bearer <STRIPE_METER_SHARED_SECRET>` (kein User-JWT). Pro metered Subscription Usage-Set, idempotent (überspringt bereits synchronisierte Mengen), persistiert Fehler in `usage_meter_sync`. Sauber.

## Entitlements / Invoices
- Feature-Gating über `_shared/entitlements.ts` (Quota-Checks). Tabellen `entitlements`/`product_entitlements`, `webhook_events`, `stripe_invoices`, `usage_*` vorhanden und vom Webhook/Meter-Sync bedient.

## Status-Bewertung

| Bereich | Status |
|---|---|
| Free-Flow | VERIFIED (Redirect auf Audit) |
| Starter/Growth/Agency Checkout-Routen | VERIFIED (rendern, Consent-Gate) |
| Scale/Enterprise | VERIFIED (sauberer Self-Service-Status: `/contact-sales`, keine kaputte Route) |
| Stripe Session Creation | CODE-VERIFIED (kein Live-Test) |
| Stripe Webhook (Idempotenz/HMAC) | CODE-VERIFIED (stark) |
| Stripe Portal | CODE-VERIFIED |
| Stripe Meter-Sync | CODE-VERIFIED |
| Success/Cancel-Seiten | VERIFIED (rendern) |

## Empfehlungen
1. **P2** — Rate-Limit auf `stripe-checkout`/`stripe-portal` (z. B. 5/h pro User/IP).
2. **P2** — `body.pilot` server-seitig autorisieren (nicht aus Client übernehmen).
3. **P3** — Logging bei Tenant-Fallback im Webhook.
4. **P2** — Stripe-Test-Mode-E2E (Session → Webhook → Entitlement) in CI ergänzen.
