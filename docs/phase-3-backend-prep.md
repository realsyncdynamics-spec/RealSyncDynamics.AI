# Phase 3 Backend Consistency — Preparation Summary

**Status:** Phase 2 Frontend ✅ Complete | Phase 3 Backend 🔄 In Preparation

---

## Current State Assessment

### ✅ Already In Place
1. **Database Schema**
   - `plan_catalog` table (20260802001000_canonical_plan_catalog.sql)
   - `plan_addons` table  
   - RLS policies: public read (active=true), service-role write only
   - Indexes on plan_id, active status

2. **Stripe Webhook Handler** (stripe-webhook/index.ts)
   - ✅ Signature verification via Stripe SDK
   - ✅ Idempotency tracking (webhook_events table)
   - ✅ Subscription sync handlers (create, update, delete, trial events)
   - ✅ Invoice event handling (paid, failed, finalized, created)
   - ✅ Checkout session completion handling
   - ✅ Payment event recording
   - ✅ Tenant linkage via metadata.tenant_id

3. **Pricing Sync Infrastructure**
   - ✅ pricing.generated.ts (Deno twin of shared/pricing.ts)
   - ✅ Auto-generation via `npm run sync:pricing`
   - ✅ Drift detection test (pricing-ssot.test.ts)
   - ✅ normalizePlanKey() for legacy plan name mapping (scale → partner)

### 🔄 In Progress / Pending
1. **Edge Functions to Create**
   - [ ] `sync-stripe-pricing` — Sync Stripe Price IDs with plan_catalog
   - [ ] `sync-plan-catalog` — Sync plan_catalog from shared/pricing.ts

2. **Verification & Testing**
   - [ ] `npm run check:stripe-sync` — Verify Deno ↔ Stripe ↔ DB consistency
   - [ ] E2E checkout flow tests (Free Audit → Recommendation → Checkout)
   - [ ] Staging: All plans purchasable, subscriptions functional

---

## Phase 3 Task Breakdown

### Task 1: Edge Function — `sync-stripe-pricing`

**Purpose:** Keep Stripe Price IDs in sync with plan_catalog

**Pseudocode:**
```typescript
// 1. Load current Stripe Price objects for each plan
// 2. For each plan in plan_catalog:
//    a. Check if price exists in Stripe
//    b. If missing: create new price in Stripe
//    c. Update plan_catalog.stripe_price_id_monthly/yearly
// 3. Log all changes to audit_log
// 4. Return summary: created N, skipped M, errors P
```

**Key Considerations:**
- Stripe API client already in use (stripe-webhook function)
- Use `plan_catalog.plan_key` as unique identifier
- Store `stripe_price_id_*` columns (or handle via Stripe metadata)
- Plan Price format: product={plan_key}, nickname={plan.name}

### Task 2: Edge Function — `sync-plan-catalog`

**Purpose:** Keep database plan_catalog in sync with shared/pricing.ts

**Pseudocode:**
```typescript
// 1. Import pricing.generated.ts (Deno version)
// 2. For each plan in PLANS:
//    a. Upsert into plan_catalog using plan_key
//    b. Migrate limits/modules/permissions to JSONB
//    c. Handle add-ons separately (plan_addons table)
// 3. Set updated_at timestamps
// 4. Mark plans as inactive if removed from source
// 5. Log changes to audit_log
// 6. Return: synced N, removed M, unchanged P
```

**Key Considerations:**
- Schedule via cron or call on deploy
- Atomic transaction: all or nothing
- Preserve existing stripe_price_id if present
- Audit trail: who changed what and when

### Task 3: Verification — `npm run check:stripe-sync`

**Purpose:** Validate end-to-end pricing consistency

**Checks:**
```bash
# 1. Frontend ↔ Deno Drift
npm run sync:pricing && npm run test:pricing-ssot

# 2. Deno ↔ plan_catalog Consistency
supabase functions serve check-plan-catalog-sync

# 3. plan_catalog ↔ Stripe Drift
supabase functions serve check-stripe-sync

# 4. Checkout Path
npm run e2e -- pricing-flow
```

---

## Stripe Integration Details

### Current Products & Prices Setup

**Stripe Product Hierarchy:**
```
Product: {plan_id}
├─ Price: {plan_key}_month  (monthly recurring)
└─ Price: {plan_key}_year   (yearly recurring)
```

**Metadata Strategy:**
```json
{
  "product": {
    "plan_key": "growth",
    "plan_id": "growth",
    "name": "Growth",
    "plan_type": "recurring"
  },
  "price": {
    "interval": "month",
    "currency": "eur",
    "plan_key": "growth"
  }
}
```

### Webhook Event Flow

**Current Handling:**
1. `customer.subscription.created` → syncSubscription()
2. `customer.subscription.updated` → syncSubscription()
3. `customer.subscription.deleted` → syncSubscription() + audit
4. `invoice.paid` → recordPaymentEvent() + sendInvoiceEmail()
5. `checkout.session.completed` → sendOnboardingWelcome() + triggerRebuild()

**To Verify:**
- [ ] Price ID resolution via subscription.items[0].price.id
- [ ] Plan key extraction from price metadata
- [ ] Tenant linkage propagation (customer.metadata → subscription.metadata)

---

## Database Schema Additions (if needed)

### plan_catalog Extensions
```sql
ALTER TABLE plan_catalog ADD COLUMN IF NOT EXISTS
  stripe_price_id_monthly TEXT,
  stripe_price_id_yearly  TEXT,
  stripe_product_id       TEXT,
  last_synced_at          TIMESTAMPTZ DEFAULT now();
```

### Audit Trail
```sql
CREATE TABLE IF NOT EXISTS plan_sync_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL, -- 'plan_catalog', 'stripe_pricing'
  plan_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by TEXT DEFAULT 'system',
  synced_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Validation Checklist

**Before Edge Function Deployment:**

- [ ] Stripe test mode: all prices created successfully
- [ ] plan_catalog: all plans + add-ons synced
- [ ] No orphaned prices in Stripe (cleanup old test prices)
- [ ] Metadata consistency check: all prices have plan_key
- [ ] Webhook signature verification working

**Before Staging Rollout:**

- [ ] E2E: Free Audit → Risk Score → Recommendation → Checkout
- [ ] Purchase each plan (Starter, Growth, Agency, Partner)
- [ ] Verify subscription in dashboard → Settings → Billing
- [ ] Cancel subscription, verify status update
- [ ] Upgrade/downgrade flow (PlanUpgradeModal)
- [ ] Invoice emails delivered correctly

**Before Production:**

- [ ] `npm run check:pricing` green
- [ ] `npm run check:stripe-sync` green
- [ ] `npm run qa:smoke` green
- [ ] Monitoring: Sentry, Analytics, API latency baseline
- [ ] Rollback plan documented (git revert hash procedure)

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Stripe price sync creates duplicates | Idempotency via product_id + interval lookup |
| Plan removal causes orphaned subscriptions | Mark inactive, don't delete; migrate to free tier |
| Webhook retry storm | Dedupe via webhook_events table + 24h retention |
| Tenant linkage missing | Strict validation on sub.metadata.tenant_id before sync |
| Concurrent sync writes | Use database transaction isolation (SERIALIZABLE for catalog) |

---

## Timeline & Dependencies

| Phase | Task | Dependencies | Estimate |
|---|---|---|---|
| 3a | Create sync-stripe-pricing | Stripe API docs, test credentials | 4h |
| 3a | Create sync-plan-catalog | pricing.generated.ts loaded | 3h |
| 3a | Integration tests | Both functions above | 3h |
| 3b | Staging verification | All Phase 3a complete | 4h |
| 3c | Production deployment | Staging green, monitoring active | 2h |

**Total Phase 3 Estimate:** 16 hours (2 full days)

---

## Next Steps

1. **Immediate:** Confirm Stripe credentials and test mode access
2. **Week 1:** Implement sync-stripe-pricing + tests
3. **Week 2:** Implement sync-plan-catalog + E2E checkout flow
4. **Week 3:** Staging verification and load testing
5. **Week 4:** Production rollout with monitoring

PR #982 (Phase 2 Frontend) remains in draft until CI completes.
Phase 3 work can proceed in parallel on separate branch.
