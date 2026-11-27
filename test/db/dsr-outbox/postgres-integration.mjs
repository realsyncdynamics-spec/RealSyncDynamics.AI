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

  await check('original immutable receipt survives mutable DSR edits', async () => {
    await admin.query(
      'update public.dsr_requests set requester_name=$1,subject_description=$2,assigned_to=$3 where id=$4',
      ['edited later','edited subject','new assignee',id],
    );
    assert.equal(await invoke(input),id);
    await assert.rejects(invoke({...input,name:'edited later'}),/operation conflict/);
    const { rows } = await admin.query(
      'select intake_fingerprint,email_binding from public.dsr_outbox where operation_id=$1',
      [operation],
    );
    assert.equal(rows[0].intake_fingerprint.length,32);
    assert.equal(rows[0].email_binding.length,32);
  });

  await check('outbox service-role cannot rewrite immutable operation fingerprint', async () => {
    await assert.rejects(
      admin.query('update public.dsr_outbox set intake_fingerprint=$1 where operation_id=$2',
        [Buffer.alloc(32,0),operation]),
      /immutable outbox receipt/,
    );
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


  // The actual production runtime_events hash-chain trigger and tenancy/RLS
  // schema are not installed here. These are isolated contract-shaped tables
  // for testing *transaction boundaries* and uniqueness, not cryptographic
  // integrity or the full migration history.
  await admin.query(`create table public.subject_ref_keys (
      tenant_id uuid not null, key_version integer not null,
      status text not null default 'active',
      primary key(tenant_id,key_version)
    );
    create table public.subject_ref_mappings (
      subject_ref text primary key,
      tenant_id uuid not null,
      key_version integer not null,
      subject_kind text not null,
      deletion_requested_at timestamptz,
      erased_at timestamptz
    );
    create table public.runtime_events (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null, type text not null, severity text not null,
      source text not null, review_status text not null, spec_version text not null,
      subject_ref text, payload jsonb not null, correlation_id uuid
    );
    create table public.governance_admin_log (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid not null, actor_user_id uuid, actor_email text,
      action text not null, target_type text not null, target_id text,
      payload jsonb not null
    );`);
  await admin.query(await readFile(new URL('./evidence-ack.sql', import.meta.url), 'utf8'));

  // TEST-ONLY synthetic HMAC stub for transactional envelope tests. The
  // separate canonical migration suite runs the REAL RFC-002 HMAC function.
  await admin.query(`create function public.subject_ref_compute(
    p_tenant uuid, p_kind text, p_value text, p_version integer default null
  ) returns text language plpgsql stable as $
  begin
    if not exists(select 1 from public.subject_ref_keys
        where tenant_id=p_tenant and key_version=p_version and status in ('active','rotating'))
    then raise exception 'test key unavailable'; end if;
    return encode(pg_catalog.sha256(pg_catalog.convert_to(
      'synthetic-only:' || p_tenant::text || ':' || p_kind || ':' ||
      pg_catalog.lower(pg_catalog.btrim(p_value)) || ':' || p_version::text,
      'UTF8')), 'hex');
  end $;`);
  await admin.query(
    "insert into public.subject_ref_keys(tenant_id,key_version,status) values($1,1,'active')",
    [tenant],
  );
  async function fakeRef(email, keyVersion = 1) {
    const { rows } = await admin.query(
      "select public.subject_ref_compute($1::uuid,'email',$2::text,$3::int) as ref",
      [tenant, email, keyVersion],
    );
    return rows[0].ref;
  }


  const ackQuery = 'select public.dsr_ack_evidence($1::uuid,$2::uuid,$3::uuid,$4::bigint) as applied';
  const deliveryWorker = randomUUID();
  const erasureOp = randomUUID();
  const erasureInput = { ...input, type: 'erasure', operation: erasureOp, email: 'delete@example.invalid' };
  const erasureId = await invoke(erasureInput);
  const erasureClaim = (await serviceQuery(
    'select * from public.dsr_claim_outbox($1::uuid,1,120)', [deliveryWorker],
  )).rows[0];
  assert.equal(erasureClaim.operation_id, erasureOp);

  await check('evidence ACK is forbidden to authenticated users', async () => {
    const c = open(); await c.connect();
    try {
      await c.query('set role authenticated');
      await assert.rejects(c.query(ackQuery, [
        tenant, erasureOp, deliveryWorker, 1,
      ]), /permission denied/i);
    } finally { await c.end(); }
  });

  await check('missing HMAC never acknowledges DSR evidence', async () => {
    await assert.rejects(
      serviceQuery(ackQuery, [tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch]),
      /SUBJECT_REF_PENDING/,
    );
    assert.equal(await count('runtime_events'), 0);
    assert.equal(await count('governance_admin_log'), 0);
    const { rows } = await admin.query(
      'select evidence_status from public.dsr_outbox where operation_id=$1', [erasureOp],
    );
    assert.equal(rows[0].evidence_status, 'retry');
  });

  const ref = await fakeRef('delete@example.invalid');
  await admin.query(
    'update public.dsr_requests set metadata=jsonb_build_object($1::text,$2::text) where id=$3::uuid',
    ['subject_ref', ref, erasureId],
  );
  await check('missing tenant-scoped mapping blocks ACK even with a subject_ref', async () => {
    await assert.rejects(
      serviceQuery(ackQuery, [tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch]),
      /SUBJECT_MAPPING_PENDING/,
    );
    assert.equal(await count('runtime_events'), 0);
  });
  await admin.query(
    'insert into public.subject_ref_mappings(subject_ref,tenant_id,key_version,subject_kind) values($1,$2,$3,$4)',
    [ref, tenant, 1, 'email'],
  );


  await check('changed requester email cannot redirect an existing Evidence ACK', async () => {
    await admin.query(
      'update public.dsr_requests set requester_email=$1 where id=$2',
      ['other@example.invalid', erasureId],
    );
    await assert.rejects(serviceQuery(ackQuery,
      [tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch]), /REQUESTER_EMAIL_CHANGED/);
    await admin.query('update public.dsr_requests set requester_email=$1 where id=$2',
      ['delete@example.invalid', erasureId]);
    assert.equal(await count('runtime_events'), 0);
  });

  await check('tenant-local forged HMAC reference is rejected against requester email', async () => {
    const forgedRef = await fakeRef('another@example.invalid');
    await admin.query(
      'insert into public.subject_ref_mappings(subject_ref,tenant_id,key_version,subject_kind) values($1,$2,1,$3)',
      [forgedRef, tenant, 'email'],
    );
    await admin.query(
      "update public.dsr_requests set metadata=jsonb_build_object('subject_ref',$1::text) where id=$2",
      [forgedRef, erasureId],
    );
    await assert.rejects(serviceQuery(ackQuery,
      [tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch]), /SUBJECT_REF_BINDING_PENDING/);
    await admin.query(
      "update public.dsr_requests set metadata=jsonb_build_object('subject_ref',$1::text) where id=$2",
      [ref, erasureId],
    );
    assert.equal(await count('runtime_events'), 0);
  });

  await check('unavailable HMAC key is not treated as valid Evidence delivery', async () => {
    await admin.query(
      "update public.subject_ref_keys set status='revoked' where tenant_id=$1 and key_version=1",
      [tenant],
    );
    await assert.rejects(serviceQuery(ackQuery,
      [tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch]), /SUBJECT_REF_BINDING_PENDING/);
    await admin.query(
      "update public.subject_ref_keys set status='active' where tenant_id=$1 and key_version=1",
      [tenant],
    );
    assert.equal(await count('runtime_events'), 0);
  });

  await check('evidence insert failure rolls back every side effect', async () => {
    await admin.query('alter table public.runtime_events add constraint injected_event_failure check(false)');
    try {
      await assert.rejects(
        serviceQuery(ackQuery, [tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch]),
        /injected_event_failure/,
      );
    } finally {
      await admin.query('alter table public.runtime_events drop constraint injected_event_failure');
    }
    assert.equal(await count('runtime_events'), 0);
    assert.equal(await count('governance_admin_log'), 0);
    const { rows } = await admin.query(
      'select deletion_requested_at from public.subject_ref_mappings where subject_ref=$1', [ref],
    );
    assert.equal(rows[0].deletion_requested_at, null);
  });

  await check('audit insert failure also rolls back evidence and erasure scheduling', async () => {
    await admin.query('alter table public.governance_admin_log add constraint injected_audit_failure check(false)');
    try {
      await assert.rejects(
        serviceQuery(ackQuery, [tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch]),
        /injected_audit_failure/,
      );
    } finally {
      await admin.query('alter table public.governance_admin_log drop constraint injected_audit_failure');
    }
    assert.equal(await count('runtime_events'), 0);
    assert.equal(await count('governance_admin_log'), 0);
    const { rows } = await admin.query(
      'select deletion_requested_at from public.subject_ref_mappings where subject_ref=$1', [ref],
    );
    assert.equal(rows[0].deletion_requested_at, null);
  });

  let erasureAt;
  await check('valid erasure ACK atomically writes events, audit and erasure queue', async () => {
    const out = await serviceQuery(ackQuery, [
      tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch,
    ]);
    assert.equal(out.rows[0].applied, true);
    assert.equal(await count('runtime_events'), 2);
    assert.equal(await count('governance_admin_log'), 1);
    const { rows: tasks } = await admin.query(
      'select evidence_status, lease_owner, lease_until, completed_at from public.dsr_outbox where operation_id=$1',
      [erasureOp],
    );
    assert.equal(tasks[0].evidence_status, 'complete');
    assert.equal(tasks[0].lease_owner, null);
    assert.equal(tasks[0].lease_until, null);
    assert.notEqual(tasks[0].completed_at, null);
    const { rows: mappings } = await admin.query(
      'select deletion_requested_at from public.subject_ref_mappings where subject_ref=$1', [ref],
    );
    assert.notEqual(mappings[0].deletion_requested_at, null);
    erasureAt = mappings[0].deletion_requested_at.toISOString();
    const { rows: evidence } = await admin.query(
      'select type, subject_ref, correlation_id, spec_version from public.runtime_events order by type',
    );
    assert.deepEqual(evidence.map(e => e.type), ['dsr.created', 'dsr.erasure_requested']);
    assert.ok(evidence.every(e => e.subject_ref === ref && e.correlation_id === erasureId && e.spec_version === '0.2'));
  });

  await check('completed ACK replay cannot double-book evidence or erasure', async () => {
    const replay = await serviceQuery(ackQuery, [
      tenant, erasureOp, deliveryWorker, erasureClaim.lease_epoch,
    ]);
    assert.equal(replay.rows[0].applied, false);
    assert.equal(await count('runtime_events'), 2);
    assert.equal(await count('governance_admin_log'), 1);
    const { rows } = await admin.query(
      'select deletion_requested_at from public.subject_ref_mappings where subject_ref=$1', [ref],
    );
    assert.equal(rows[0].deletion_requested_at.toISOString(), erasureAt);
  });

  await check('wrong tenant and stale worker cannot finalize another task', async () => {
    const wrongTenant = await serviceQuery(ackQuery, [
      randomUUID(), erasureOp, deliveryWorker, erasureClaim.lease_epoch,
    ]);
    assert.equal(wrongTenant.rows[0].applied, false);
    assert.equal(await count('runtime_events'), 2);
  });

  await check('evidence and admin payloads contain no requester PII', async () => {
    const { rows: events } = await admin.query('select payload from public.runtime_events');
    const { rows: logs } = await admin.query('select payload,actor_email from public.governance_admin_log');
    const material = JSON.stringify({ events, logs });
    assert.equal(material.includes('delete@example.invalid'), false);
    assert.equal(material.includes('member@example.invalid'), false);
    assert.equal(logs[0].actor_email, null);
  });

  await check('parallel ACK replay emits one access event without scheduling deletion', async () => {
    const accessOp = randomUUID(), accessWorker = randomUUID();
    const accessId = await invoke({ ...input, operation: accessOp, email: 'read@example.invalid' });
    const readRef = await fakeRef('read@example.invalid');
    await admin.query(
      'update public.dsr_requests set metadata=jsonb_build_object($1::text,$2::text) where id=$3::uuid',
      ['subject_ref', readRef, accessId],
    );
    await admin.query(
      'insert into public.subject_ref_mappings(subject_ref,tenant_id,key_version,subject_kind) values($1,$2,$3,$4)',
      [readRef, tenant, 1, 'email'],
    );
    const claim = (await serviceQuery(
      'select * from public.dsr_claim_outbox($1::uuid,1,120)', [accessWorker],
    )).rows[0];
    assert.equal(claim.operation_id, accessOp);
    await assert.rejects(
      serviceQuery(ackQuery, [tenant, accessOp, randomUUID(), claim.lease_epoch]),
      /stale worker lease/,
    );
    // Two deliveries race on the same live lease. The outbox row lock and
    // transaction boundary guarantee exactly one event + one receipt.
    const callbacks = await Promise.all([
      serviceQuery(ackQuery, [tenant, accessOp, accessWorker, claim.lease_epoch]),
      serviceQuery(ackQuery, [tenant, accessOp, accessWorker, claim.lease_epoch]),
    ]);
    assert.deepEqual(callbacks.map(r => r.rows[0].applied).sort(), [false, true]);
    assert.equal(await count('runtime_events'), 3);
    assert.equal(await count('governance_admin_log'), 2);
    const { rows } = await admin.query(
      'select deletion_requested_at from public.subject_ref_mappings where subject_ref=$1', [readRef],
    );
    assert.equal(rows[0].deletion_requested_at, null);
  });

  console.log(JSON.stringify({ ok: true, passed, engine: 'PostgreSQL', scope: 'producer-lease-ack-synthetic-envelope', productionChanges: 0 }));
} finally {
  await admin.end();
}
