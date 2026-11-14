/**
 * A3 / Real DB concurrency regression for the legacy cost ledger.
 *
 * Must use TWO independent PostgreSQL sessions and committed fixtures.
 * Sequential reserve calls do not exercise the original race condition.
 * CI with REQUIRE_DB_TESTS=1 must fail if the DB is unavailable.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import { getDbUrl, requireDbOrFail } from './db-helpers';

const MIGRATION = join(__dirname, '../../../supabase/migrations/20261030001500_cost_ledger_atomic_reserve.sql');
const sql = readFileSync(MIGRATION, 'utf8');

describe('A3 / SQL contract (static)', () => {
  it('takes a per-tenant transaction lock before reading caps or usage', () => {
    const lock = sql.indexOf('PERFORM pg_advisory_xact_lock(');
    const caps = sql.indexOf('SELECT * INTO v_caps');
    const usage = sql.indexOf('SELECT COALESCE(SUM(amount_usd)');
    const insert = sql.indexOf('INSERT INTO public.tenant_cost_ledger');
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(caps);
    expect(caps).toBeLessThan(usage);
    expect(usage).toBeLessThan(insert);
    expect(sql).toContain("'tenant_cost_ledger:llm:' || p_tenant_id::text");
  });

  it('keeps the service-role grant and refuses non-LLM cost kinds', () => {
    expect(sql).toContain("p_cost_kind NOT IN ('llm_input', 'llm_output')");
    expect(sql).toContain('TO service_role;');
    expect(sql).not.toContain('DROP TABLE');
  });
});

const d = requireDbOrFail('cost-ledger-atomic-reserve') ? describe : describe.skip;

d('A3 / concurrent reservations (real PostgreSQL)', () => {
  it('blocks a second reservation and throttles after the first commits', async () => {
    const url = getDbUrl()!;
    const admin = new Client({ connectionString: url });
    const first = new Client({ connectionString: url });
    const second = new Client({ connectionString: url });
    let tenantId: string | null = null;
    let firstTx = false;
    let secondTx = false;
    let secondQuery: Promise<unknown> | null = null;

    await Promise.all([admin.connect(), first.connect(), second.connect()]);
    try {
      const tenant = await admin.query<{ id: string }>(
        'INSERT INTO public.tenants (name) VALUES ($1) RETURNING id',
        ['test_cost_atomic_' + Math.random().toString(36).slice(2)],
      );
      tenantId = tenant.rows[0]!.id;
      await admin.query(
        'INSERT INTO public.tenant_cost_caps (tenant_id, llm_usd_monthly) VALUES ($1, 1)',
        [tenantId],
      );

      const firstPid = (await first.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const secondPid = (await second.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      const claims = JSON.stringify({ role: 'service_role', sub: null });
      for (const client of [first, second]) {
        await client.query("SET statement_timeout = '5s'");
        await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        if (client === first) firstTx = true;
        else secondTx = true;
        await client.query("SELECT set_config('request.jwt.claims', $1, true)", [claims]);
        await client.query('SET LOCAL ROLE service_role');
      }

      const reserve = `SELECT decision, reservation_id FROM public.cost_check_and_reserve(
        $1::uuid, 'llm_input', 1, 0.6,
        jsonb_build_object('agent_ref', 'a3-concurrent-test'))`;
      const r1 = await first.query<{ decision: string; reservation_id: string | null }>(reserve, [tenantId]);
      expect(r1.rows[0]!.decision).toBe('allow');
      expect(r1.rows[0]!.reservation_id).not.toBeNull();

      // Leave first's transaction uncommitted. The second call must be
      // *observably* blocked by the first backend, not merely throttled by
      // an already committed row (which a sequential test would also do).
      const runningSecond = second.query<{ decision: string; reservation_id: string | null }>(reserve, [tenantId]);
      secondQuery = runningSecond;
      let observedBlock = false;
      for (let i = 0; i < 40; i++) {
        const r = await admin.query<{ blocked: boolean }>(
          'SELECT $1::int = ANY(pg_blocking_pids($2::int)) AS blocked',
          [firstPid, secondPid],
        );
        if (r.rows[0]!.blocked) { observedBlock = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(observedBlock).toBe(true);

      await first.query('COMMIT');
      firstTx = false;
      const r2 = await runningSecond;
      secondQuery = null;
      expect(r2.rows[0]!.decision).toBe('throttle');
      expect(r2.rows[0]!.reservation_id).toBeNull();

      // Roll back the throttle event, so only the first reservation persists
      // briefly, then clean up the committed fixture below.
      await second.query('ROLLBACK');
      secondTx = false;
      const ledger = await admin.query<{ n: number; amount: string }>(
        `SELECT count(*)::int AS n, sum(amount_usd)::text AS amount
           FROM public.tenant_cost_ledger
          WHERE tenant_id = $1 AND cost_kind = 'reservation'`,
        [tenantId],
      );
      expect(ledger.rows[0]!.n).toBe(1);
      expect(Number(ledger.rows[0]!.amount)).toBeCloseTo(0.6, 6);
    } finally {
      // Release any held lock before attempting to drain the second query.
      if (firstTx) await first.query('ROLLBACK').catch(() => {});
      if (secondQuery) await secondQuery.catch(() => {});
      if (secondTx) await second.query('ROLLBACK').catch(() => {});
      await Promise.all([first.end(), second.end()]);
      if (tenantId) {
        // Settled ledger rows are immutable; the one committed by this test
        // is still an OPEN reservation and can be deleted under A2's trigger.
        await admin.query(
          "DELETE FROM public.tenant_cost_ledger WHERE tenant_id = $1 AND settled = false",
          [tenantId],
        );
        await admin.query('DELETE FROM public.tenants WHERE id = $1', [tenantId]);
      }
      await admin.end();
    }
  });

  it('rejects non-LLM dimensions instead of classifying them as LLM estimates', async () => {
    const url = getDbUrl()!;
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      await client.query('BEGIN');
      const tenant = (await client.query<{ id: string }>(
        "INSERT INTO public.tenants (name) VALUES ('test_cost_invalid_kind') RETURNING id",
      )).rows[0]!.id;
      await client.query(
        'SELECT set_config($1, $2, true)',
        ['request.jwt.claims', JSON.stringify({ role: 'service_role' })],
      );
      await client.query('SET LOCAL ROLE service_role');
      await expect(client.query(
        `SELECT * FROM public.cost_check_and_reserve(
          $1::uuid, 'edge_invocation', 1, 0.01,
          jsonb_build_object('agent_ref', 'a3-invalid-test'))`,
        [tenant],
      )).rejects.toThrow(/unsupported tenant or cost kind/);
    } finally {
      await client.query('ROLLBACK').catch(() => {});
      await client.end();
    }
  });
});
