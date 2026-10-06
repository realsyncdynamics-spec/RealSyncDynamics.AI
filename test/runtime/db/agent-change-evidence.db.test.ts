/**
 * Agent Change Evidence — RLS + migration invariants (DB).
 *
 * Spiegel von security_signals / audit_evidence:
 *   - RLS an, SELECT nur für is_tenant_member
 *   - INSERT nur service_role
 *   - delivery_id unique (Idempotenz)
 *   - kein tenant_id-IS-NULL-Fallback in Policies
 *   - View security_invoker
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDb,
  createTenantWithMember,
  openDb,
  requireDbOrFail,
  type DbCtx,
} from './db-helpers';

const d = requireDbOrFail('agent-change-evidence') ? describe : describe.skip;

async function als<T>(
  ctx: DbCtx,
  rolle: 'anon' | 'authenticated' | 'service_role',
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await ctx.client.query(`SAVEPOINT ${sp}`);
  await ctx.client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
    JSON.stringify({ sub, role: rolle }),
  ]);
  await ctx.client.query(`SET LOCAL ROLE ${rolle}`);
  try {
    const out = await fn();
    await ctx.client.query(`RESET ROLE`);
    await ctx.client.query(`RELEASE SAVEPOINT ${sp}`);
    return out;
  } catch (err) {
    await ctx.client.query(`RESET ROLE`);
    await ctx.client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    throw err;
  }
}

d('agent_change_evidence / schema + RLS', () => {
  let ctx: DbCtx | null = null;
  beforeEach(async () => { ctx = await openDb(); });
  afterEach(async () => { await closeDb(ctx); ctx = null; });

  it('RLS is enabled on evidence + bindings', async () => {
    const { rows } = await ctx!.client.query<{ relname: string; rls: boolean }>(
      `SELECT c.relname, c.relrowsecurity AS rls
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN ('agent_change_evidence', 'github_repo_tenant_bindings')
       ORDER BY 1`,
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((r: { rls: boolean }) => r.rls)).toBe(true);
  });

  it('policies never use tenant_id IS NULL fallback', async () => {
    const { rows } = await ctx!.client.query<{ polname: string; qual: string | null; with_check: string | null }>(
      `SELECT p.polname,
              pg_get_expr(p.polqual, p.polrelid) AS qual,
              pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
       FROM pg_policy p
       JOIN pg_class c ON c.oid = p.polrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN ('agent_change_evidence', 'github_repo_tenant_bindings')`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      const blob = `${row.qual ?? ''} ${row.with_check ?? ''}`;
      expect(blob).not.toMatch(/tenant_id\s+IS\s+NULL/i);
    }
  });

  it('view uses security_invoker', async () => {
    const { rows } = await ctx!.client.query<{ ok: boolean }>(
      `SELECT coalesce(c.reloptions && ARRAY['security_invoker=on', 'security_invoker=true'], false) AS ok
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'v_agent_change_evidence'`,
    );
    expect(rows[0]?.ok).toBe(true);
  });

  it('member reads own rows; foreign member and anon see nothing', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ace-A' });
    const B = await createTenantWithMember(ctx!, { tenantName: 'ace-B' });

    await ctx!.client.query(
      `INSERT INTO public.agent_change_evidence
         (tenant_id, source, event, repo, diff_hash, risk_level, decision, payload_ref, delivery_id)
       VALUES ($1, 'github', 'push', 'acme/a', 'hash-a', 'info', 'recorded', '{}'::jsonb, 'del-a')`,
      [A.tenantId],
    );

    const own = await als(ctx!, 'authenticated', A.userId, async () => {
      const { rows } = await ctx!.client.query<{ delivery_id: string }>(
        `SELECT delivery_id FROM public.agent_change_evidence`,
      );
      return rows;
    });
    expect(own.map((r: { delivery_id: string }) => r.delivery_id)).toEqual(['del-a']);

    const foreign = await als(ctx!, 'authenticated', B.userId, async () => {
      const { rows } = await ctx!.client.query<{ delivery_id: string }>(
        `SELECT delivery_id FROM public.agent_change_evidence`,
      );
      return rows;
    });
    expect(foreign).toEqual([]);

    await expect(
      als(ctx!, 'anon', null, async () => {
        await ctx!.client.query(`SELECT delivery_id FROM public.agent_change_evidence`);
      }),
    ).rejects.toBeTruthy();
  });

  it('authenticated cannot insert; service_role can; delivery_id is idempotent', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ace-ins' });

    await expect(
      als(ctx!, 'authenticated', A.userId, async () => {
        await ctx!.client.query(
          `INSERT INTO public.agent_change_evidence
             (tenant_id, event, repo, diff_hash, delivery_id)
           VALUES ($1, 'push', 'acme/x', 'h', 'del-auth')`,
          [A.tenantId],
        );
      }),
    ).rejects.toBeTruthy();

    await als(ctx!, 'service_role', null, async () => {
      await ctx!.client.query(
        `INSERT INTO public.agent_change_evidence
           (tenant_id, event, repo, diff_hash, delivery_id)
         VALUES ($1, 'push', 'acme/x', 'h1', 'del-svc')`,
        [A.tenantId],
      );
    });

    await expect(
      als(ctx!, 'service_role', null, async () => {
        await ctx!.client.query(
          `INSERT INTO public.agent_change_evidence
             (tenant_id, event, repo, diff_hash, delivery_id)
           VALUES ($1, 'push', 'acme/x', 'h2', 'del-svc')`,
          [A.tenantId],
        );
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('repo binding is readable by member; write is service_role only', async () => {
    const A = await createTenantWithMember(ctx!, { tenantName: 'ace-bind' });

    await als(ctx!, 'service_role', null, async () => {
      await ctx!.client.query(
        `INSERT INTO public.github_repo_tenant_bindings (tenant_id, repo_full_name)
         VALUES ($1, 'acme/bound')`,
        [A.tenantId],
      );
    });

    const rows = await als(ctx!, 'authenticated', A.userId, async () => {
      const { rows: r } = await ctx!.client.query<{ repo_full_name: string }>(
        `SELECT repo_full_name FROM public.github_repo_tenant_bindings`,
      );
      return r;
    });
    expect(rows.map((r: { repo_full_name: string }) => r.repo_full_name)).toEqual(['acme/bound']);

    await expect(
      als(ctx!, 'authenticated', A.userId, async () => {
        await ctx!.client.query(
          `INSERT INTO public.github_repo_tenant_bindings (tenant_id, repo_full_name)
           VALUES ($1, 'acme/evil')`,
          [A.tenantId],
        );
      }),
    ).rejects.toBeTruthy();
  });
});
