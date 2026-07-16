import { describe, it, expect } from 'vitest';

// ── Stripe Webhook — plan_key Extraktion ──────────────────────────────────
// Spiegelt die Logik aus supabase/functions/stripe-webhook/index.ts:
//   const planKey = item?.price?.metadata?.plan_key ?? 'free';
// Diese Tests schützen gegen Regressions beim plan_key-Lookup.

describe('syncSubscription — plan_key aus price.metadata', () => {
  function extractPlanKey(sub: {
    items: { data: Array<{ price?: { metadata?: Record<string, string> } }> };
  }): string {
    const item = sub.items.data[0];
    return item?.price?.metadata?.plan_key ?? 'free';
  }

  it('liest plan_key korrekt aus price.metadata', () => {
    const sub = { items: { data: [{ price: { metadata: { plan_key: 'growth' } } }] } };
    expect(extractPlanKey(sub)).toBe('growth');
  });

  it('fällt auf "free" zurück wenn metadata fehlt', () => {
    const sub = { items: { data: [{ price: { metadata: {} } }] } };
    expect(extractPlanKey(sub)).toBe('free');
  });

  it('fällt auf "free" zurück wenn price fehlt', () => {
    const sub = { items: { data: [{}] } };
    expect(extractPlanKey(sub)).toBe('free');
  });

  it('fällt auf "free" zurück wenn items leer', () => {
    const sub = { items: { data: [] } };
    expect(extractPlanKey(sub)).toBe('free');
  });

  it('unterstützt alle kanonischen Plan-Keys', () => {
    const plans = ['free', 'starter', 'growth', 'agency', 'scale', 'enterprise'];
    for (const plan of plans) {
      const sub = { items: { data: [{ price: { metadata: { plan_key: plan } } }] } };
      expect(extractPlanKey(sub)).toBe(plan);
    }
  });
});

// ── Stripe Webhook — plan_key Fallback via public.products ────────────────
// Spiegelt resolvePlanKey() aus supabase/functions/stripe-webhook/index.ts:
//   1. price.metadata.plan_key (von Stripe gesetzt) hat Vorrang
//   2. sonst Lookup in public.products via stripe_price_id
//   3. sonst 'free'
// Schützt zahlende Kunden vor stillem Downgrade auf 'free', falls jemand
// vergisst, metadata.plan_key am Stripe-Preis zu setzen.
describe('resolvePlanKey — Fallback via products', () => {
  async function resolvePlanKey(
    item: { price?: { id?: string; metadata?: Record<string, string> } } | undefined,
    lookup: (priceId: string) => Promise<string | null>,
  ): Promise<string> {
    const fromMeta = item?.price?.metadata?.plan_key;
    if (fromMeta) return fromMeta;
    const priceId = item?.price?.id;
    if (priceId) {
      const planKey = await lookup(priceId);
      if (planKey) return planKey;
    }
    return 'free';
  }

  const productsLookup =
    (map: Record<string, string>) =>
    async (priceId: string): Promise<string | null> =>
      map[priceId] ?? null;

  it('bevorzugt price.metadata.plan_key vor dem DB-Lookup', async () => {
    const r = await resolvePlanKey(
      { price: { id: 'price_x', metadata: { plan_key: 'growth' } } },
      productsLookup({ price_x: 'starter' }),
    );
    expect(r).toBe('growth');
  });

  it('fällt auf products.default_for_plan_key zurück wenn metadata fehlt', async () => {
    const r = await resolvePlanKey(
      { price: { id: 'price_1TfsV8REjTWueUcGCdOO6bT2', metadata: {} } },
      productsLookup({ price_1TfsV8REjTWueUcGCdOO6bT2: 'starter' }),
    );
    expect(r).toBe('starter');
  });

  it('fällt auf "free" wenn weder metadata noch products-Treffer', async () => {
    const r = await resolvePlanKey(
      { price: { id: 'price_unknown', metadata: {} } },
      productsLookup({}),
    );
    expect(r).toBe('free');
  });

  it('fällt auf "free" wenn price/item fehlt', async () => {
    const r = await resolvePlanKey({}, productsLookup({ price_x: 'starter' }));
    expect(r).toBe('free');
  });
});

// ── Idempotenz-Logik ──────────────────────────────────────────────────────
// duplicate key = already processed → kein Fehler
describe('Webhook Idempotenz', () => {
  it('duplicate key Fehler wird als Success behandelt', () => {
    const isDuplicate = (errMsg: string) =>
      errMsg === null || /duplicate key/i.test(errMsg);

    expect(isDuplicate('duplicate key value violates unique constraint')).toBe(true);
    expect(isDuplicate('null')).toBe(false);
    expect(isDuplicate('foreign key constraint')).toBe(false);
  });

  it('Nicht-Duplikat-Fehler wird weitergegeben', () => {
    const shouldThrow = (errMsg: string | null) =>
      errMsg !== null && !/duplicate key/i.test(errMsg);

    expect(shouldThrow(null)).toBe(false);
    expect(shouldThrow('duplicate key value')).toBe(false);
    expect(shouldThrow('connection timeout')).toBe(true);
    expect(shouldThrow('permission denied')).toBe(true);
  });
});

// ── Trial-Event-Guard ─────────────────────────────────────────────────────
// recordTrialEventIfApplicable soll nur bei echten Trial-Subscriptions schreiben
describe('Trial-Event Guard', () => {
  function shouldRecordTrialEvent(
    kind: 'trial_started' | 'trial_will_end' | 'converted' | 'canceled',
    trialStart: number | null,
    trialEnd: number | null,
  ): boolean {
    if (kind !== 'canceled' && !trialStart && !trialEnd) return false;
    return true;
  }

  it('trial_started ohne trial_start/end → kein Event', () => {
    expect(shouldRecordTrialEvent('trial_started', null, null)).toBe(false);
  });

  it('trial_started mit trial_start → Event wird geschrieben', () => {
    expect(shouldRecordTrialEvent('trial_started', 1_700_000_000, null)).toBe(true);
  });

  it('canceled immer → Event wird geschrieben', () => {
    expect(shouldRecordTrialEvent('canceled', null, null)).toBe(true);
  });

  it('trial_will_end ohne trial_end → kein Event', () => {
    expect(shouldRecordTrialEvent('trial_will_end', null, null)).toBe(false);
  });
});

// ── checkout.session.completed — Managed Website Detection ───────────────
describe('triggerWebsiteRebuildIfApplicable — metadata guard', () => {
  function shouldTriggerRebuild(meta: Record<string, string>): boolean {
    return meta.product_type === 'managed_website';
  }

  it('product_type=managed_website → Rebuild starten', () => {
    expect(shouldTriggerRebuild({ product_type: 'managed_website' })).toBe(true);
  });

  it('kein product_type → kein Rebuild', () => {
    expect(shouldTriggerRebuild({})).toBe(false);
  });

  it('anderer product_type → kein Rebuild', () => {
    expect(shouldTriggerRebuild({ product_type: 'audit_pro' })).toBe(false);
  });
});
