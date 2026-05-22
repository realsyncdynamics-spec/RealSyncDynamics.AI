/**
 * RFC-004 §4 — Anomaly Detectors (DB integration)
 *
 * Token explosion, consent regression, cost-per-outcome explosion.
 * Memory decay anomaly is deferred (depends on RFC-003 agent_memory).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  getDbUrl,
  insertEvent,
  openDb,
  type DbCtx,
} from './db-helpers';

const skip = !getDbUrl();
const d = skip ? describe.skip : describe;

d('RFC-004 / detect_token_explosion (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('returns empty when there is no baseline data', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query(
        `SELECT * FROM public.detect_token_explosion($1::uuid)`,
        [tenantId],
      );
    });
    expect(r.rows).toEqual([]);
  });

  it('rejects non-members', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const { rows: u } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ('tok-out@x.de') RETURNING id`,
    );
    await expect(
      ctx!.withClaims({ sub: u[0]!.id }, async () => {
        await ctx!.client.query(
          `SELECT * FROM public.detect_token_explosion($1::uuid)`,
          [tenantId],
        );
      }),
    ).rejects.toThrow(/forbidden/);
  });
});

d('RFC-004 / detect_consent_regression (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('detects consent.granted followed by tracker.pre_consent_detected within 1h', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const ref = 'consent-ref-' + Math.random().toString(36).slice(2);

    // Grant 30 minutes ago (just outside 1h window — needs to be inside)
    await ctx!.client.query(
      `INSERT INTO public.runtime_events
         (tenant_id, type, severity, source, review_status, subject_ref, ts, payload)
       VALUES ($1, 'consent.granted', 'info', 'test', 'auto', $2,
               now() - INTERVAL '30 minutes', '{}'::jsonb)`,
      [tenantId, ref],
    );
    // Pre-consent breach 10 minutes ago — 20 min after grant, < 1h ⇒ detected
    await ctx!.client.query(
      `INSERT INTO public.runtime_events
         (tenant_id, type, severity, source, review_status, subject_ref, ts, payload)
       VALUES ($1, 'tracker.pre_consent_detected', 'high', 'test', 'auto', $2,
               now() - INTERVAL '10 minutes', '{}'::jsonb)`,
      [tenantId, ref],
    );

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ subject_ref: string; regression_lag: string }>(
        `SELECT subject_ref, regression_lag::text AS regression_lag
           FROM public.detect_consent_regression($1::uuid)`,
        [tenantId],
      );
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.subject_ref).toBe(ref);
    expect(r.rows[0]!.regression_lag).toMatch(/00:20:/);
  });

  it('does NOT flag when lag exceeds 1 hour', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const ref = 'long-lag-' + Math.random().toString(36).slice(2);

    await ctx!.client.query(
      `INSERT INTO public.runtime_events
         (tenant_id, type, severity, source, review_status, subject_ref, ts, payload)
       VALUES ($1, 'consent.granted', 'info', 'test', 'auto', $2,
               now() - INTERVAL '5 hours', '{}'::jsonb)`,
      [tenantId, ref],
    );
    await ctx!.client.query(
      `INSERT INTO public.runtime_events
         (tenant_id, type, severity, source, review_status, subject_ref, ts, payload)
       VALUES ($1, 'tracker.pre_consent_detected', 'high', 'test', 'auto', $2,
               now() - INTERVAL '1 hour', '{}'::jsonb)`,
      [tenantId, ref],
    );

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query(
        `SELECT * FROM public.detect_consent_regression($1::uuid)`,
        [tenantId],
      );
    });
    expect(r.rows).toEqual([]);
  });
});

d('RFC-004 / detect_cost_per_outcome_explosion (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('flags flow whose today cost-per-outcome is ≥ 5× rolling 30d', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);

    // Rolling 30d baseline: 100 USD over 100 completions → 1.00 USD per outcome.
    // Insert as occurred 15 days ago, with outcomes at the same time.
    await ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, flow_ref, occurred_at)
       VALUES ($1, 'llm_input', 100, 1.0, 'spike-flow', now() - INTERVAL '15 days')`,
      [tenantId],
    );
    for (let i = 0; i < 100; i++) {
      await ctx!.client.query(
        `INSERT INTO public.runtime_events
           (tenant_id, type, severity, source, review_status, ts, payload)
         VALUES ($1, 'outcome.completed', 'info', 'test', 'auto',
                 now() - INTERVAL '15 days',
                 jsonb_build_object('flow_ref','spike-flow'))`,
        [tenantId],
      );
    }

    // Today: 100 USD over only 10 completions → 10.00 USD per outcome ⇒ 10× baseline
    await ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, flow_ref)
       VALUES ($1, 'llm_input', 100, 1.0, 'spike-flow')`,
      [tenantId],
    );
    for (let i = 0; i < 10; i++) {
      await insertEvent(ctx!, tenantId, {
        type: 'outcome.completed',
        payload: { flow_ref: 'spike-flow' },
      });
    }

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        flow_ref: string;
        cost_per_outcome: string;
        rolling_30d: string;
        multiplier: string;
      }>(
        `SELECT * FROM public.detect_cost_per_outcome_explosion($1::uuid)`,
        [tenantId],
      );
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.flow_ref).toBe('spike-flow');
    expect(Number(r.rows[0]!.cost_per_outcome)).toBeCloseTo(10, 2);
    expect(Number(r.rows[0]!.multiplier)).toBeGreaterThanOrEqual(5);
  });

  it('does NOT flag flows under 5× threshold', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    // Baseline 1 USD per outcome, today 2 USD per outcome — under 5×
    await ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, flow_ref, occurred_at)
       VALUES ($1, 'llm_input', 100, 1.0, 'normal-flow', now() - INTERVAL '15 days')`,
      [tenantId],
    );
    for (let i = 0; i < 100; i++) {
      await ctx!.client.query(
        `INSERT INTO public.runtime_events
           (tenant_id, type, severity, source, review_status, ts, payload)
         VALUES ($1, 'outcome.completed', 'info', 'test', 'auto',
                 now() - INTERVAL '15 days',
                 jsonb_build_object('flow_ref','normal-flow'))`,
        [tenantId],
      );
    }
    await ctx!.client.query(
      `INSERT INTO public.tenant_cost_ledger
         (tenant_id, cost_kind, units, unit_price_usd, flow_ref)
       VALUES ($1, 'llm_input', 20, 1.0, 'normal-flow')`,
      [tenantId],
    );
    for (let i = 0; i < 10; i++) {
      await insertEvent(ctx!, tenantId, {
        type: 'outcome.completed',
        payload: { flow_ref: 'normal-flow' },
      });
    }

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query(
        `SELECT * FROM public.detect_cost_per_outcome_explosion($1::uuid)`,
        [tenantId],
      );
    });
    expect(r.rows).toEqual([]);
  });
});
