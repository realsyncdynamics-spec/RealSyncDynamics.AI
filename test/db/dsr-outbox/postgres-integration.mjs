/**
 * Isolated REAL PostgreSQL integration test for P0 #2360 producer and lease contracts.
 *
 * DB is an ephemeral GitHub Actions Postgres service. Never use a Supabase or
 * production URL. Tests exercise the candidate SQL, not a deployed migration.
 *
 * Coverage: service-only invocation, tenant roles, transaction rollback,
 * multi-connection contention, idempotent replay, lease fencing and retries.
 * Does NOT certify an evidence-delivering consumer, hash-chain ACK,
 * erasure pipeline, or full historical migration compatibility.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const DSN = process.env.DSR_TEST_DATABASE_URL;
if (!DSN) throw new Error('DSR_TEST_DATABASE_URL required; no skipped DB checks');
const dbUrl = new URL(DSN);
if (!['127.0.0.1', 'localhost'].includes(dbUrl.hostname)) {
  throw new Error('DSR tests require an isolated localhost Postgres service');
}
if (dbUrl.pathname !== '/dsr_outbox_contract') {
  throw new Error('DSR tests require the dedicated dsr_outbox_contract database');
}
if (!['postgres:', 'postgresql:'].includes(dbUrl.protocol)) {
  throw new Error('Invalid PostgreSQL test protocol');
}

const sql = await readFile(new URL('./intake.sql', import.meta.url), 'utf8');
let passed = 0;
async function check(title, fn) {
  await fn();
  passed += 1;
  console.log('PASS ' + passed + ': ' + title);
}
function open() { return new pg.Client({ connectionString: DSN, connectionTimeoutMillis: 7000 }); }
const admin = open();
await admin.connect();
async function count(table) {
  const { rows } = await admin.query('select count(*)::integer as n from public.' + table);
  return rows[0].n;
}
function params({ tenant, actor, operation, type = 'access', email = 'member@example.invalid',
  name = null, description = null, assignee = null, assets = [] }) {
  return [tenant, actor, operation, type, email, name, description, assignee, assets];
}
const statement = `select public.dsr_intake(
  $1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,$6::text,$7::text,$8::text,$9::text[]
) as id`;
async function serviceQuery(query, params = []) {
  const c = open();
  await c.connect();
  try {
    await c.query('set role service_role');
    return await c.query(query, params);
  } finally { await c.end(); }
}

async function invoke(p, role = 'service_role') {
  const client = open();
  await client.connect();
  try {
    await client.query('set role ' + role);
    const r = await client.query(statement, params(p));
    return r.rows[0].id;
  } finally {
    await client.end();
  }
}

try {
  // Match the real dsr_tracker field types and checks, not PGlite's JSONB
  // simplification. Use no remote secrets or project resources.
  await admin.query(`create role anon;
    create role authenticated;
    create role service_role;
    create table public.memberships (tenant_id uuid not null, user_id uuid not null, role text not null);
    create table public.dsr_requests (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid,
      request_type text not null check (request_type in ('access','erasure','portability','rectification','restriction','objection')),
      status text not null default 'received' check (status in ('received','in_progress','pending_verification','completed','rejected','overdue')),
      requester_name text, requester_email text not null, subject_description text,
      affected_assets text[] default '{}', received_at timestamptz default now(),
      deadline_at timestamptz default (now() + interval '30 days'),
      completed_at timestamptz, response_notes text, assigned_to text,
      metadata jsonb default '{}', created_at timestamptz default now(), updated_at timestamptz default now()
    );`);
  await admin.query(sql);
  const workerSql = await readFile(new URL('./worker.sql', import.meta.url), 'utf8');
  await admin.query(workerSql);

  const tenant = randomUUID(), actor = randomUUID(), stranger = randomUUID(), viewer = randomUUID();
  const operation = randomUUID();
  await admin.query(`insert into public.memberships(tenant_id,user_id,role)
    values ($1,$2,'editor'),($1,$3,'viewer_auditor')`, [tenant, actor, viewer]);
  const input = { tenant, actor, operation, name: 'member', assets: ['first','second'] };

  await check('unauthenticated caller cannot execute intake RPC', async () => {
    await assert.rejects(invoke(input, 'anon'), /permission denied/i);
  });
  await check('authenticated caller cannot execute privileged intake RPC', async () => {
    await assert.rejects(invoke(input, 'authenticated'), /permission denied/i);
  });
  await check('anonymous access cannot read the outbox', async () => {
    const c = open(); await c.connect();
    try { await c.query('set role anon'); await assert.rejects(c.query('select * from public.dsr_outbox'), /permission denied/i); }
    finally { await c.end(); }
  });
  await check('missing membership and viewer role are rejected', async () => {
    await assert.rejects(invoke({ ...input, actor: stranger }), /writer required/i);
    await assert.rejects(invoke({ ...input, actor: viewer }), /writer required/i);
    assert.equal(await count('dsr_requests'), 0);
  });
  await check('outbox failure rolls back DSR intake atomically', async () => {
    await admin.query('alter table public.dsr_outbox add constraint injected_insert_failure check(false)');
    try { await assert.rejects(invoke(input), /injected_insert_failure/i); }
    finally { await admin.query('alter table public.dsr_outbox drop constraint injected_insert_failure'); }
    assert.equal(await count('dsr_requests'), 0);
    assert.equal(await count('dsr_outbox'), 0);
  });
  let id;
  await check('successful intake creates exactly one pending task', async () => {
    id = await invoke(input);
    assert.match(id, /^[0-9a-f-]{36}$/i);
    assert.equal(await count('dsr_requests'), 1);
    assert.equal(await count('dsr_outbox'), 1);
    const { rows } = await admin.query('select dsr_id, evidence_status, attempts, lease_epoch from public.dsr_outbox');
    assert.deepEqual(rows[0], { dsr_id: id, evidence_status: 'pending', attempts: 0, lease_epoch: '0' });
    const { rows: dsrs } = await admin.query('select affected_assets from public.dsr_requests');
    assert.deepEqual(dsrs[0].affected_assets, ['first', 'second']);
  });
  await check('replay with identical payload returns original ID', async () => {
    assert.equal(await invoke(input), id);
    assert.equal(await count('dsr_requests'), 1);
  });
  await check('same operation ID with changed payload is rejected', async () => {
    await assert.rejects(invoke({ ...input, email: 'other@example.invalid' }), /operation conflict/i);
    await assert.rejects(invoke({ ...input, assets: ['changed'] }), /operation conflict/i);
    assert.equal(await count('dsr_requests'), 1);
  });
  await check('same operation ID cannot be reused by a different valid actor', async () => {
    const otherActor = randomUUID();
    await admin.query('insert into public.memberships values ($1,$2,$3)', [tenant, otherActor, 'owner']);
    await assert.rejects(invoke({ ...input, actor: otherActor }), /operation conflict/i);
    assert.equal(await count('dsr_outbox'), 1);
  });
  await check('20 concurrent identical requests are serialized and create one receipt', async () => {
    const parallelInput = { ...input, operation: randomUUID(), email: 'parallel@example.invalid' };
    const ids = await Promise.all(Array.from({ length: 20 }, () => invoke(parallelInput)));
    assert.equal(new Set(ids).size, 1);
    assert.equal(await count('dsr_requests'), 2);
    assert.equal(await count('dsr_outbox'), 2);
  });
  await check('receipts persist after reconnect', async () => {
    const again = open(); await again.connect();
    try {
      const { rows } = await again.query('select dsr_id, evidence_status from public.dsr_outbox where operation_id = $1', [operation]);
      assert.deepEqual(rows, [{ dsr_id: id, evidence_status: 'pending' }]);
    } finally { await again.end(); }
  });

  await check('worker lease RPC cannot be invoked by authenticated users', async () => {
    const c = open(); await c.connect();
    try {
      await c.query('set role authenticated');
      await assert.rejects(
        c.query('select * from public.dsr_claim_outbox($1::uuid,1,120)', [randomUUID()]),
        /permission denied/i,
      );
    } finally { await c.end(); }
  });

  const workerA = randomUUID(), workerB = randomUUID();
  let leases;
  await check('SKIP LOCKED gives two concurrent workers distinct tasks', async () => {
    const results = await Promise.all([
      serviceQuery('select * from public.dsr_claim_outbox($1::uuid,1,120)', [workerA]),
      serviceQuery('select * from public.dsr_claim_outbox($1::uuid,1,120)', [workerB]),
    ]);
    assert.equal(results[0].rows.length, 1);
    assert.equal(results[1].rows.length, 1);
    leases = [results[0].rows[0], results[1].rows[0]];
    assert.notEqual(leases[0].operation_id, leases[1].operation_id);
    assert.equal(leases[0].lease_epoch, '1');
    assert.equal(leases[1].lease_epoch, '1');
  });

  await check('fencing rejects another worker or outdated epoch', async () => {
    const first = leases[0];
    const retry = 'select public.dsr_retry_outbox($1::uuid,$2::uuid,$3::uuid,$4::bigint,$5::text) as applied';
    await assert.rejects(
      serviceQuery(retry, [first.tenant_id, first.operation_id, workerB, 1, 'VAULT_DOWN']),
      /stale worker lease/i,
    );
    await assert.rejects(
      serviceQuery(retry, [first.tenant_id, first.operation_id, workerA, 0, 'VAULT_DOWN']),
      /stale worker lease/i,
    );
    const accepted = await serviceQuery(retry, [first.tenant_id, first.operation_id, workerA, 1, 'VAULT_DOWN']);
    assert.equal(accepted.rows[0].applied, true);
    const { rows } = await admin.query(
      'select evidence_status, lease_owner, attempts, next_attempt_at > now() as delayed from public.dsr_outbox where operation_id = $1',
      [first.operation_id],
    );
    assert.deepEqual(rows[0], { evidence_status: 'retry', lease_owner: null, attempts: 1, delayed: true });
    const tooEarly = await serviceQuery('select * from public.dsr_claim_outbox($1::uuid,1,120)', [workerA]);
    assert.equal(tooEarly.rows.length, 0);
  });

  await check('retry can be re-leased after the backoff with increased fence epoch', async () => {
    const first = leases[0];
    await admin.query('update public.dsr_outbox set next_attempt_at = now() - interval \'1 second\' where operation_id = $1', [first.operation_id]);
    const second = await serviceQuery('select * from public.dsr_claim_outbox($1::uuid,1,120)', [workerB]);
    assert.equal(second.rows.length, 1);
    assert.equal(second.rows[0].operation_id, first.operation_id);
    assert.equal(second.rows[0].lease_epoch, '2');
    const { rows } = await admin.query('select attempts from public.dsr_outbox where operation_id = $1', [first.operation_id]);
    assert.equal(rows[0].attempts, 2);
  });

  await check('exhausted worker lease is marked failed instead of becoming invisible', async () => {
    const first = leases[0];
    await admin.query(
      `update public.dsr_outbox
          set attempts=8, lease_until = now() - interval '1 second',
              next_attempt_at = now() - interval '1 second'
        where operation_id = $1`,
      [first.operation_id],
    );
    const notClaimable = await serviceQuery('select * from public.dsr_claim_outbox($1::uuid,1,120)', [workerA]);
    assert.equal(notClaimable.rows.length, 0);
    const { rows } = await admin.query(
      'select evidence_status, last_error_code, lease_owner from public.dsr_outbox where operation_id = $1',
      [first.operation_id],
    );
    assert.deepEqual(rows[0], { evidence_status: 'failed', last_error_code: 'RETRIES_EXHAUSTED', lease_owner: null });
  });

  console.log(JSON.stringify({ ok: true, passed, engine: 'PostgreSQL', scope: 'producer-and-lease-only', productionChanges: 0 }));
} finally {
  await admin.end();
}
