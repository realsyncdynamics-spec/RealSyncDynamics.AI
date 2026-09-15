# 🎯 STRIPE PAKET LIVE-DEPLOY — OPERATIVE RULES

**Start**: 2026-07-19  
**Branch**: `claude/stripe-paket-live-deploy-cq1gpu`  
**Ziel**: Erstes funktionsfähiges Stripe-Paket Production-ready machen

---

## 1️⃣ OBERSTE PRIORITÄT (No New Features)

### ✅ FOKUS: Stripe-Integration fertig machen
- **Stripe Checkout** → Full functional path (Product → Price → Session → Webhook)
- **Subscription Sync** → Idempotent webhook receiver + RLS-tenant isolation
- **Billing Tables** → subscription_plans, feature_usage, stripe_invoices live
- **Email Drips** → Invoice emails, trial reminders, payment failures
- **Metering** → Stripe token meter sync (live accurate pricing)

### ❌ VERBOTEN: Neue Features
- **Keine** neuen Pages, Components, oder Routes
- **Keine** neuen Edge Functions außer Stripe-related
- **Keine** Schema-Addons (nur bugfixes zu Stripe-Integration)
- **Keine** UI-Refactorings (nur Stripe checkout flow touch-ups)

---

## 2️⃣ GIT WORKFLOW

### Branch-Strategie
```
ON: claude/stripe-paket-live-deploy-cq1gpu (DO NOT CHANGE BRANCH)
├─ Alle Commits hier
├─ PR: Draft → main (nach jedem Push)
└─ Kein Merge bis grünes Signal
```

### Commit-Konvention
```
<type>: <beschreibung>

type = stripe:fix | stripe:test | stripe:deploy | stripe:docs
```

Beispiele:
```
stripe:fix: stripe-webhook idempotency edge case for duplicate subscription.created
stripe:test: add vitest for stripe-checkout plan resolution fallback
stripe:deploy: production stripe secret key rotation + vault migration
```

---

## 3️⃣ STRIPE STATUS → LIVE CHECKLIST

### A. Edge Functions (8 total)
- [ ] `stripe-webhook` — Subscription + Invoice + Payment events sync ✅ **95%** (ready)
- [ ] `stripe-checkout` — Create session, price resolution, fallback ✅ **90%** (1 fix needed)
- [ ] `stripe-portal` — Customer self-serve billing portal link ✅ **80%** 
- [ ] `stripe-meter-sync` — Token metering → Stripe usage records ✅ **70%**
- [ ] `stripe-token-meter-sync` — Async meter batch-sync ✅ **60%**
- [ ] `stripe-oauth-callback` — Stripe Connect onboarding (partner tier) ✅ **50%**
- [ ] `sync-stripe-metrics` — Analytics sync to Stripe dashboard ⚠️ **40%**
- [ ] `checkout-website-rebuild` — Managed website tier product trigger ✅ **75%**

### B. Database Schema (RLS + Multi-Tenant)
- [ ] `subscription_plans` — Tier definitions (free, starter, growth, agency, scale, enterprise) ✅ **100%**
- [ ] `subscriptions` — Active subscriptions per tenant ✅ **100%**
- [ ] `stripe_invoices` — Invoice audit trail ✅ **100%**
- [ ] `stripe_payment_events` — Payment success/failure tracking ✅ **100%**
- [ ] `stripe_trial_events` — Trial lifecycle (start, end, converted, canceled) ✅ **100%**
- [ ] `feature_usage` — Quota enforcement (bots, API calls, evidence vault) ✅ **90%**
- [ ] `webhook_events` — Idempotency store ✅ **100%**
- [ ] `customer_onboarding` — Post-purchase setup state ✅ **85%**
- [ ] `website_rebuilds` — Managed website queue ✅ **80%**

### C. Migrations (SQL)
- [x] 20260704000000_billing_subscriptions.sql — Plans + usage schema ✅
- [x] 20260704000100_seed_subscription_plans.sql — 6 tiers seeded ✅
- [x] 20260705000000_invoice_email_tracking.sql — Email audit ✅
- [x] 20260705100000_enable_ai_token_metering.sql — Usage metering ✅
- [x] 20260705200000_webhook_delivery_system.sql — Idempotency ✅
- [ ] **MISSING**: stripe_live_price_ids mapping (test→live env rotation) ⚠️

### D. Frontend (React SPA)
- [ ] Checkout flow (`/checkout?plan=...`) — UI ready ⚠️ **50%**
- [ ] Billing dashboard (`/app/billing`) — Subscriptions + invoices view ⚠️ **40%**
- [ ] Trial banner — "X days left" countdown ⚠️ **0%**
- [ ] Upgrade CTA — Plan comparison + upgrade button ✅ **85%**
- [ ] Webhook callback handler (`/success`, `/cancel`) ⚠️ **60%**

### E. Tests (Vitest + Playwright)
- [ ] stripe-webhook idempotency test (duplicate event handling) ⚠️
- [ ] stripe-checkout price resolution with fallback ⚠️
- [ ] E2E: Full checkout → subscription sync → invoice flow ⚠️
- [ ] Metering: Token usage → Stripe usage record ⚠️
- [ ] RLS: Multi-tenant subscription isolation ⚠️

### F. Deployment
- [ ] Stripe test mode secrets in vault (`select public.set_app_secret(...)`)
- [ ] Stripe live mode keys (HSM-backed, ops-only)
- [ ] Webhook signing secret configured
- [ ] Edge Function environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ✅
- [ ] Resend email API key (invoice drips)
- [ ] n8n workflow trigger (on trial-will-end event)

---

## 4️⃣ QUALITY GATES (No Merge Without)

Before **any** commit:
```bash
# 1. Type check
npm run lint

# 2. Unit tests (Stripe integration)
npm test -- stripe

# 3. Build check
npm run build

# 4. Migrations apply locally
supabase db reset  # Resets to latest migration
```

Before **merge to main**:
- [ ] All Stripe functions deployed (`supabase functions deploy`)
- [ ] Migrations applied (`supabase db push`)
- [ ] E2E checkout flow passes (`npm run e2e`)
- [ ] Prod smoke test green (`npm run qa:smoke`)
- [ ] PR reviewed (≥1 approval)

---

## 5️⃣ CRITICAL RULES (HARD STOP)

### 🚫 NEVER
1. Commit Stripe live API keys or webhook secrets (use Vault RPC)
2. Change `stripe-webhook` signature verification (idempotency breaks)
3. Delete `webhook_events` rows (audit trail required for disputes)
4. Modify `subscriptions.plan_id` FK without migration
5. Push to **main** without PR (GitHub branch protection)
6. Deploy Edge Functions without `supabase functions deploy`
7. Run `db reset` in production (test env only)

### ⚠️ CAUTION
- RLS policies on all billing tables — test locally first
- Timezone conversions Unix timestamp ↔ ISO 8601 (Stripe uses Unix)
- Idempotency: Always check `webhook_events` before inserting
- Multi-tenant isolation: Every query filters by `tenant_id`
- Currency: Default EUR, but Stripe supports multi-currency

---

## 6️⃣ DAILY STANDUP CHECKLIST

Each session, update this:

```
[ ] Stripe functions deployed & green logs
[ ] Migrations applied (no rollbacks)
[ ] E2E tests passing (checkout, subscription, invoice)
[ ] No uncommitted changes on branch
[ ] PR open & up-to-date with main
[ ] Prod vault secrets rotated (if needed)
```

---

## 7️⃣ KNOWN ISSUES & WORKAROUNDS

| Issue | Status | Workaround |
|-------|--------|-----------|
| Stripe test mode → live mode price ID mapping | ⚠️ TODO | Create migration `20260719_stripe_live_price_ids_env.sql` |
| `stripe-meter-sync` lag (5min batches) | ✅ OK | Acceptable for MVP; optimize in Phase 3 |
| Trial email drips (n8n webhook) | ⚠️ PENDING | Wire `stripe_trial_events` → n8n webhook |
| Website rebuild queue backlog | ⚠️ MONITOR | Add async retry + DLQ pattern if >100 queued |

---

## 8️⃣ SUCCESS CRITERIA (Go-Live)

✅ **Minimum**: 
- Stripe checkout session creates subscription
- Webhook syncs subscription to DB (RLS-safe)
- Invoice emails send on payment success
- Metering tracks token usage

✅ **Target** (Phase 2 complete):
- Trial + free tier workflow
- Upgrade CTA on dashboard
- Billing history visible to tenant members
- Payment failure handling + recovery email

✅ **Nice-to-have** (Phase 3):
- Stripe Connect partner tier
- Usage-based metering (variable pricing)
- Dunning flow (payment retry automation)

---

**Ziel-Go-Live**: 2026-08-01  
**Current Phase**: 2 (Stripe Integration)  
**Owner**: Claude Code (this session)

