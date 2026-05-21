/**
 * RFC-004 Part A — Risk Scoring + real-time trigger (DB integration)
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

d('RFC-004 / compute_tenant_risk_score (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('returns 0 components for an empty tenant', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{
        consent_component: string;
        incident_component: string;
        tenant_risk_score: string;
        model_ref: string;
      }>(
        `SELECT * FROM public.compute_tenant_risk_score($1::uuid)`,
        [tenantId],
      );
    });
    expect(Number(r.rows[0]!.consent_component)).toBe(0);
    expect(Number(r.rows[0]!.incident_component)).toBe(0);
    expect(Number(r.rows[0]!.tenant_risk_score)).toBe(0);
    expect(r.rows[0]!.model_ref).toBe('tenant-risk-v1.0');
  });

  it('consent violations bump consent_component (5 + 0.5 per row, high/critical extra)', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    // 1 high-severity event: 5 * 1 + 0.5 * 1 = 5.5
    await insertEvent(ctx!, tenantId, {
      type: 'tracker.pre_consent_detected',
      severity: 'high',
    });
    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ consent_component: string; tenant_risk_score: string }>(
        `SELECT * FROM public.compute_tenant_risk_score($1::uuid)`,
        [tenantId],
      );
    });
    expect(Number(r.rows[0]!.consent_component)).toBeCloseTo(5.5, 2);
    // tenant_risk_score = 0.30 × 5.5 = 1.65
    expect(Number(r.rows[0]!.tenant_risk_score)).toBeCloseTo(1.65, 2);
  });

  it('incident.opened critical adds 25 to incident_component', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await insertEvent(ctx!, tenantId, {
      type: 'incident.opened',
      severity: 'critical',
    });
    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ incident_component: string; tenant_risk_score: string }>(
        `SELECT * FROM public.compute_tenant_risk_score($1::uuid)`,
        [tenantId],
      );
    });
    expect(Number(r.rows[0]!.incident_component)).toBe(25);
    // 0.30 × 25 = 7.5
    expect(Number(r.rows[0]!.tenant_risk_score)).toBeCloseTo(7.5, 2);
  });

  it('feature_hash is stable for identical inputs', async () => {
    const { tenantId, userId } = await createTenantWithMember(ctx!);
    await insertEvent(ctx!, tenantId, { type: 'incident.opened', severity: 'high' });

    const r = await ctx!.withClaims({ sub: userId }, async () => {
      return ctx!.client.query<{ h1: string; h2: string }>(
        `SELECT (a).feature_hash AS h1, (b).feature_hash AS h2
           FROM public.compute_tenant_risk_score($1::uuid) a,
                public.compute_tenant_risk_score($1::uuid) b`,
        [tenantId],
      );
    });
    expect(r.rows[0]!.h1).toBe(r.rows[0]!.h2);
    expect(r.rows[0]!.h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects non-members', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const { rows: u } = await ctx!.client.query<{ id: string }>(
      `INSERT INTO auth.users(email) VALUES ('risk-out@x.de') RETURNING id`,
    );
    await expect(
      ctx!.withClaims({ sub: u[0]!.id }, async () => {
        await ctx!.client.query(
          `SELECT * FROM public.compute_tenant_risk_score($1::uuid)`,
          [tenantId],
        );
      }),
    ).rejects.toThrow(/forbidden/);
  });
});

d('RFC-004 / real-time subject risk trigger (DB)', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('emits governance.risk_score_changed on first subject_ref event', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const ref = 'ref-trigger-' + Math.random().toString(36).slice(2);

    // pre_consent_detected (high severity) — subject score:
    //   consent = min(100, 1 * 12) = 12
    //   incident = NULL → 0
    //   velocity = 1 * 3 = 3
    //   risk = 0.4*12 + 0.4*0 + 0.2*3 = 5.4
    await insertEvent(ctx!, tenantId, {
      type: 'tracker.pre_consent_detected',
      severity: 'high',
      subject_ref: ref,
    });

    const r = await ctx!.client.query<{ risk_score: string; severity: string }>(
      `SELECT (payload->>'risk_score')::numeric AS risk_score,
              severity
         FROM public.runtime_events
        WHERE tenant_id = $1
          AND type = 'governance.risk_score_changed'
          AND subject_ref = $2`,
      [tenantId, ref],
    );
    expect(r.rows).toHaveLength(1);
    expect(Number(r.rows[0]!.risk_score)).toBeCloseTo(5.4, 1);
    expect(r.rows[0]!.severity).toBe('low'); // < 50
  });

  it('does not recurse (source=intelligence is filtered by WHEN clause)', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const ref = 'ref-no-recurse-' + Math.random().toString(36).slice(2);

    await insertEvent(ctx!, tenantId, {
      type: 'incident.opened',
      severity: 'critical',
      subject_ref: ref,
    });

    // Exactly ONE governance.risk_score_changed event — not a cascade
    const r = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM public.runtime_events
        WHERE tenant_id = $1
          AND type = 'governance.risk_score_changed'
          AND subject_ref = $2`,
      [tenantId, ref],
    );
    expect(r.rows[0]!.n).toBe(1);
  });

  it('does NOT emit on subsequent events when delta < 10', async () => {
    const { tenantId } = await createTenantWithMember(ctx!);
    const ref = 'ref-stable-' + Math.random().toString(36).slice(2);

    // First event → score 12 * 0.4 + ... = ~5.4
    await insertEvent(ctx!, tenantId, {
      type: 'tracker.pre_consent_detected',
      severity: 'high',
      subject_ref: ref,
    });
    // Second very-similar event — delta on subject score < 10
    await insertEvent(ctx!, tenantId, {
      type: 'tracker.pre_consent_detected',
      severity: 'high',
      subject_ref: ref,
    });

    const r = await ctx!.client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.runtime_events
        WHERE tenant_id=$1 AND type='governance.risk_score_changed'
          AND subject_ref=$2`,
      [tenantId, ref],
    );
    // Only the first crossing; the second falls below the 10-point delta
    expect(r.rows[0]!.n).toBe(1);
  });
});
