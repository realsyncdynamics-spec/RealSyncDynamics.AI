/**
 * DB-Integration test helpers.
 *
 * Tests run against a real Postgres (provisioned via scripts/test-db/up.sh).
 * Each test runs inside a single transaction that is ROLLBACK'd at the end —
 * no test data ever persists, isolation is guaranteed by Postgres itself.
 *
 * If TEST_DB_URL is not set, getDb() returns null and the test files
 * gracefully skip their describe blocks. CI without a DB still passes.
 */
import { Client, type ClientConfig } from 'pg';

export interface DbCtx {
  /** Connected pg client, inside an open transaction. */
  client: Client;
  /**
   * Run a callback with the given JWT claims set for the transaction.
   * Mirrors Supabase's auth.uid() / auth.role() resolution.
   */
  withClaims<T>(
    claims: { sub?: string; role?: string },
    fn: () => Promise<T>,
  ): Promise<T>;
}

export function getDbUrl(): string | null {
  return process.env.TEST_DB_URL ?? null;
}

/**
 * Open a transactional context for a single test. Throws if TEST_DB_URL
 * is missing — callers should check getDbUrl() first and skip if absent.
 */
export async function openDb(): Promise<DbCtx> {
  const url = getDbUrl();
  if (!url) {
    throw new Error('TEST_DB_URL not set');
  }
  const config: ClientConfig = { connectionString: url };
  const client = new Client(config);
  await client.connect();
  await client.query('BEGIN');

  async function withClaims<T>(
    claims: { sub?: string; role?: string },
    fn: () => Promise<T>,
  ): Promise<T> {
    const payload = JSON.stringify({
      sub: claims.sub ?? null,
      role: claims.role ?? 'authenticated',
    });
    // SAVEPOINT lets us recover the transaction if fn() raises (e.g. RLS
    // forbidden). Without it, a single error from a SECURITY DEFINER raise
    // aborts the outer test transaction.
    const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
    await client.query(`SAVEPOINT ${sp}`);
    // SET LOCAL doesn't accept bind parameters — use set_config()
    await client.query(`SELECT set_config('request.jwt.claims', $1, true)`, [payload]);
    if (claims.role === 'service_role') {
      await client.query(`SET LOCAL ROLE service_role`);
    } else {
      await client.query(`SET LOCAL ROLE authenticated`);
    }
    try {
      const out = await fn();
      await client.query(`RELEASE SAVEPOINT ${sp}`);
      await client.query(`RESET ROLE`);
      return out;
    } catch (err) {
      await client.query(`ROLLBACK TO SAVEPOINT ${sp}`);
      await client.query(`RESET ROLE`);
      throw err;
    }
  }

  return { client, withClaims };
}

/** Rollback + disconnect. Idempotent; safe to call in afterEach. */
export async function closeDb(ctx: DbCtx | null): Promise<void> {
  if (!ctx) return;
  try {
    await ctx.client.query('ROLLBACK');
  } catch {
    /* already rolled back */
  }
  await ctx.client.end();
}

/**
 * Convenience: create a tenant + a user + membership. Returns IDs.
 * Runs as superuser (the test client) — bypasses RLS so fixture setup is
 * not constrained by the policies under test.
 */
export async function createTenantWithMember(
  ctx: DbCtx,
  opts: { tenantName?: string; userEmail?: string } = {},
): Promise<{ tenantId: string; userId: string }> {
  const { tenantName = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, userEmail = 'test@example.com' } = opts;

  const { rows: tRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO public.tenants(name) VALUES ($1) RETURNING id`,
    [tenantName],
  );
  const tenantId = tRows[0]!.id;

  const { rows: uRows } = await ctx.client.query<{ id: string }>(
    `INSERT INTO auth.users(email) VALUES ($1) RETURNING id`,
    [userEmail],
  );
  const userId = uRows[0]!.id;

  await ctx.client.query(
    `INSERT INTO public.memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner')`,
    [tenantId, userId],
  );
  await ctx.client.query(
    `INSERT INTO public.tenant_memberships(tenant_id, user_id, role) VALUES ($1,$2,'owner')`,
    [tenantId, userId],
  );

  return { tenantId, userId };
}

/** Insert a runtime event with minimal envelope. Returns the new row. */
export async function insertEvent(
  ctx: DbCtx,
  tenantId: string,
  overrides: Partial<{
    type: string;
    severity: string;
    source: string;
    review_status: string;
    subject_ref: string | null;
    payload: unknown;
    trace_id: string | null;
    causation_id: string | null;
  }> = {},
): Promise<{
  id: string;
  global_seq: string;
  tenant_seq: string;
  event_hash: Buffer;
  prev_hash: Buffer | null;
}> {
  const params = {
    type: overrides.type ?? 'test.event',
    severity: overrides.severity ?? 'info',
    source: overrides.source ?? 'integration-test',
    review_status: overrides.review_status ?? 'auto',
    subject_ref: overrides.subject_ref ?? null,
    payload: JSON.stringify(overrides.payload ?? {}),
    trace_id: overrides.trace_id ?? null,
    causation_id: overrides.causation_id ?? null,
  };

  const { rows } = await ctx.client.query<{
    id: string;
    global_seq: string;
    tenant_seq: string;
    event_hash: Buffer;
    prev_hash: Buffer | null;
  }>(
    `INSERT INTO public.runtime_events
       (tenant_id, type, severity, source, review_status, subject_ref,
        payload, trace_id, causation_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
     RETURNING id, global_seq, tenant_seq, event_hash, prev_hash`,
    [
      tenantId,
      params.type,
      params.severity,
      params.source,
      params.review_status,
      params.subject_ref,
      params.payload,
      params.trace_id,
      params.causation_id,
    ],
  );
  return rows[0]!;
}
