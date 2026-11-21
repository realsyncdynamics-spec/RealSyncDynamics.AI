/**
 * M0.1 Chief-of-Staff — Postgres RLS negative tests.
 *
 * This suite requires the fully migrated throwaway CI database, with real
 * authenticated/anon PostgreSQL roles and auth.uid() reading JWT claims.
 * No mocked RLS; writes are fixtures inside a transaction rolled back
 * in afterEach(). MUST NOT run against production credentials.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb, createTenantWithMember, openDb, requireDbOrFail, type DbCtx,
} from './db-helpers';

const dbAvailable = requireDbOrFail('chief-of-staff RLS (two-tenant negative checks)');
const d = dbAvailable ? describe : describe.skip;

const RELEVANT_TABLES = ['agent_tasks', 'agent_decisions', 'agent_observations'] as const;
type EntityTable = typeof RELEVANT_TABLES[number];

d('M0.1 Chief-of-Staff — actual Postgres RLS isolation', () => {
  let ctx: DbCtx;
  let tenantA: { tenantId: string; userId: string };
  let tenantB: { tenantId: string; userId: string };
  let outsideUserId: string;
  const recordIds = new Map<EntityTable, { a: string; b: string }>();

  beforeEach(async () => {
    ctx = await openDb();
    tenantA = await createTenantWithMember(ctx, { tenantName: 'cos-a' });
    tenantB = await createTenantWithMember(ctx, { tenantName: 'cos-b' });

    const user = await ctx.client.query<{ id: string }>(
      'INSERT INTO auth.users(email) VALUES ($1) RETURNING id',
      [`cos-outsider-${Math.random().toString(36).slice(2)}@example.com`],
    );
    outsideUserId = user.rows[0]!.id;

    // Build one real row per tenant per table as transaction-local superuser,
    // then perform all assertions as SET LOCAL ROLE authenticated.
    const aTask = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.agent_tasks(tenant_id, agent, task, priority, status)
       VALUES ($1,'dev','private A task','critical','blocked') RETURNING id`,
      [tenantA.tenantId],
    );
    const bTask = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.agent_tasks(tenant_id, agent, task, priority, status)
       VALUES ($1,'dev','private B task','high','failed') RETURNING id`,
      [tenantB.tenantId],
    );
    recordIds.set('agent_tasks', { a: aTask.rows[0]!.id, b: bTask.rows[0]!.id });

    const aDecision = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.agent_decisions
       (tenant_id, decision_title, problem, recommendation, reason, risk_level, proposed_by)
       VALUES ($1,'private A decision','approve release','reject','needs review','critical','release')
       RETURNING id`,
      [tenantA.tenantId],
    );
    const bDecision = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.agent_decisions
       (tenant_id, decision_title, problem, recommendation, reason, risk_level, proposed_by)
       VALUES ($1,'private B decision','approve release','reject','needs review','high','release')
       RETURNING id`,
      [tenantB.tenantId],
    );
    recordIds.set('agent_decisions', { a: aDecision.rows[0]!.id, b: bDecision.rows[0]!.id });

    const aAlert = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.agent_observations
       (tenant_id, agent, category, severity, title)
       VALUES ($1,'monitor','security','critical','private A alert') RETURNING id`,
      [tenantA.tenantId],
    );
    const bAlert = await ctx.client.query<{ id: string }>(
      `INSERT INTO public.agent_observations
       (tenant_id, agent, category, severity, title)
       VALUES ($1,'monitor','security','high','private B alert') RETURNING id`,
      [tenantB.tenantId],
    );
    recordIds.set('agent_observations', { a: aAlert.rows[0]!.id, b: bAlert.rows[0]!.id });
  });

  afterEach(async () => {
    await closeDb(ctx);
    recordIds.clear();
  });

  it('test actually executes as authenticated with RLS active on all three tables', async () => {
    await ctx.withClaims({ sub: tenantA.userId }, async () => {
      const actor = await ctx.client.query<{ role: string }>(
        'SELECT current_user::text AS role',
      );
      expect(actor.rows[0]!.role).toBe('authenticated');

      for (const table of RELEVANT_TABLES) {
        // Static allowlist; these identifiers never originate from inputs.
        const result = await ctx.client.query<{ enabled: boolean; active: boolean }>(
          `SELECT c.relrowsecurity AS enabled,
                  row_security_active($1::regclass) AS active
           FROM pg_class c WHERE c.oid = $1::regclass`,
          [`public.${table}`],
        );
        expect(result.rows[0]).toMatchObject({ enabled: true, active: true });
      }
    });
  });

  it('tenant A sees its rows but never tenant B rows across all inbox sources', async () => {
    await ctx.withClaims({ sub: tenantA.userId }, async () => {
      for (const table of RELEVANT_TABLES) {
        const result = await ctx.client.query<{ id: string; tenant_id: string }>(
          `SELECT id,tenant_id FROM public.${table} WHERE id = ANY($1::uuid[])`,
          [[recordIds.get(table)!.a, recordIds.get(table)!.b]],
        );
        expect(result.rows).toEqual([{ id: recordIds.get(table)!.a, tenant_id: tenantA.tenantId }]);
      }
    });
  });

  it('tenant B cannot access tenant A even by supplying a known foreign row id', async () => {
    await ctx.withClaims({ sub: tenantB.userId }, async () => {
      for (const table of RELEVANT_TABLES) {
        const foreign = await ctx.client.query(
          `SELECT id FROM public.${table} WHERE tenant_id = $1 AND id = $2`,
          [tenantA.tenantId, recordIds.get(table)!.a],
        );
        expect(foreign.rows).toEqual([]);
        const own = await ctx.client.query(
          `SELECT id FROM public.${table} WHERE tenant_id = $1 AND id = $2`,
          [tenantB.tenantId, recordIds.get(table)!.b],
        );
        expect(own.rows).toHaveLength(1);
      }
    });
  });

  it('authenticated outsider without membership cannot see either tenant', async () => {
    await ctx.withClaims({ sub: outsideUserId }, async () => {
      for (const table of RELEVANT_TABLES) {
        const result = await ctx.client.query(
          `SELECT id FROM public.${table} WHERE tenant_id IN ($1,$2)`,
          [tenantA.tenantId, tenantB.tenantId],
        );
        expect(result.rows).toEqual([]);
      }
    });
  });

  it('missing user identity sees no records even under authenticated database role', async () => {
    await ctx.withClaims({}, async () => {
      for (const table of RELEVANT_TABLES) {
        const result = await ctx.client.query(
          `SELECT id FROM public.${table} WHERE tenant_id IN ($1,$2)`,
          [tenantA.tenantId, tenantB.tenantId],
        );
        expect(result.rows).toEqual([]);
      }
    });
  });
});
