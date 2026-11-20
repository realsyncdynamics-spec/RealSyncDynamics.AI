/**
 * SF-003 real-Postgres integration tests for synthetic internal Factory jobs.
 * Destructively resets ONLY sf003_test schema in a separately created LOCAL test DB.
 * No production network, Supabase credentials, migration runner, or public endpoints.
 * This test suite MUST fail if a disposable, local database was not explicitly selected.
 */
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { approvedTestUrl } from './db-target.mjs';
import { verifyLocalDatabase } from './preflight-db.mjs';

let pool;
let schemaCreated = false;
const sha = (x) => createHash('sha256').update(x).digest('hex');
const digest = (x) => sha(JSON.stringify(x));
const localUrl = approvedTestUrl(process.env.SF003_TEST_DATABASE_URL);
const expectedDbName = new URL(localUrl).pathname.slice(1);

before(async () => {
  const { Pool } = await import('pg');
  pool = new Pool({ connectionString: localUrl, max: 8, connectionTimeoutMillis: 4000 });
  let c;
  try {
    c = await pool.connect();
    await c.query('BEGIN');
    // Preflight and schema creation share the same connection and transaction.
    await verifyLocalDatabase(c, expectedDbName);
    const ddl = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    await c.query(ddl);
    await c.query('COMMIT');
    schemaCreated = true;
  } catch (error) {
    if (c) { try { await c.query('ROLLBACK'); } catch {} }
    throw error;
  } finally {
    if (c) c.release();
  }
});

after(async () => {
  if (!pool) return;
  try {
    if (schemaCreated) {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        // If the identity check fails, retain test data rather than DROP anything.
        await verifyLocalDatabase(c, expectedDbName);
        await c.query('DROP SCHEMA IF EXISTS sf003_test CASCADE');
        await c.query('COMMIT');
      } catch (error) {
        try { await c.query('ROLLBACK'); } catch {}
        throw error;
      } finally { c.release(); }
    }
  } finally { await pool.end(); }
});

async function tx(callback) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const result = await callback(c);
    await c.query('COMMIT');
    return result;
  } catch (err) {
    try { await c.query('ROLLBACK'); } catch { /* connection lost: fail */ }
    throw err;
  } finally { c.release(); }
}

async function createJob(requestKey, fingerprint, budgetCents = 250) {
  return tx(async (c) => {
    const id = randomUUID();
    const inserted = await c.query(`
      INSERT INTO sf003_test.jobs (id,request_key,fingerprint,budget_cents)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT(request_key) DO NOTHING RETURNING *
    `, [id, requestKey, fingerprint, budgetCents]);
    const row = inserted.rows[0] ?? (
      await c.query('SELECT * FROM sf003_test.jobs WHERE request_key=$1', [requestKey])
    ).rows[0];
    if (!row || row.fingerprint !== fingerprint || Number(row.budget_cents) !== budgetCents) {
      throw new Error('idempotency_conflict');
    }
    return row;
  });
}

async function claim(jobId, workerId, ttlSeconds = 20) {
  return tx(async (c) => {
    const job = await c.query('SELECT id FROM sf003_test.jobs WHERE id=$1 FOR UPDATE', [jobId]);
    if (!job.rows.length) throw new Error('unknown_job');
    const current = (await c.query('SELECT * FROM sf003_test.leases WHERE job_id=$1 FOR UPDATE', [jobId])).rows[0];
    if (current) {
      const active = await c.query('SELECT ($1::timestamptz > clock_timestamp()) AS active', [current.expires_at]);
      if (active.rows[0].active) throw new Error('lease_busy');
      const updated = await c.query(`
        UPDATE sf003_test.leases SET worker_id=$2, epoch=epoch+1,
          expires_at=clock_timestamp()+($3::int * interval '1 second')
        WHERE job_id=$1 RETURNING epoch
      `, [jobId, workerId, ttlSeconds]);
      return Number(updated.rows[0].epoch);
    }
    const result = await c.query(`
      INSERT INTO sf003_test.leases(job_id,worker_id,epoch,expires_at)
      VALUES($1,$2,1,clock_timestamp()+($3::int * interval '1 second')) RETURNING epoch
    `, [jobId, workerId, ttlSeconds]);
    return Number(result.rows[0].epoch);
  });
}

async function renew(jobId, workerId, epoch, ttlSeconds = 20) {
  const r = await pool.query(`
    UPDATE sf003_test.leases SET expires_at=clock_timestamp()+($4::int * interval '1 second')
    WHERE job_id=$1 AND worker_id=$2 AND epoch=$3 AND expires_at>clock_timestamp()
    RETURNING epoch
  `, [jobId, workerId, epoch, ttlSeconds]);
  if (r.rowCount !== 1) throw new Error('stale_or_expired_lease');
}

/** Atomically validate, update, append evidence, and store an idempotent receipt. */
async function commitCommand(jobId, commandId, expectedVersion, fingerprint, opts = {}) {
  return tx(async (c) => {
    const existing = await c.query('SELECT * FROM sf003_test.jobs WHERE id=$1 FOR UPDATE', [jobId]);
    const job = existing.rows[0];
    if (!job) throw new Error('unknown_job');
    const replay = (await c.query(`
      SELECT fingerprint,result FROM sf003_test.receipts
      WHERE job_id=$1 AND command_id=$2
    `, [jobId, commandId])).rows[0];
    if (replay) {
      if (replay.fingerprint !== fingerprint) throw new Error('receipt_fingerprint_conflict');
      return replay.result;
    }
    if (Number(job.version) !== expectedVersion) throw new Error('stale_version');
    if (opts.workerId) {
      const lease = (await c.query(`
        SELECT worker_id,epoch,(expires_at>clock_timestamp()) AS active
        FROM sf003_test.leases WHERE job_id=$1
      `, [jobId])).rows[0];
      if (!lease || !lease.active || lease.worker_id !== opts.workerId ||
          Number(lease.epoch) !== opts.epoch) throw new Error('lease_fenced');
    }
    const additionalCents = opts.additionalCents ?? 0;
    if (!Number.isSafeInteger(additionalCents) || additionalCents < 0 ||
        Number(job.spent_cents) + additionalCents > Number(job.budget_cents)) {
      throw new Error('budget_exceeded');
    }
    const next = (await c.query(`
      UPDATE sf003_test.jobs SET version=version+1,status=$2,spent_cents=spent_cents+$3
      WHERE id=$1 AND version=$4 RETURNING version,status
    `, [jobId, opts.nextStatus ?? 'running', additionalCents, expectedVersion])).rows[0];
    if (!next) throw new Error('stale_version');
    if (opts.failAt === 'after_update') throw new Error('injected_crash_after_update');
    const evidence = sha(JSON.stringify({ jobId,commandId,fingerprint,version:String(next.version) }));
    await c.query(`
      INSERT INTO sf003_test.events(job_id,command_id,job_version,event_type,evidence_sha256)
      VALUES($1,$2,$3,$4,$5)
    `, [jobId,commandId,next.version,opts.nextStatus ?? 'running',evidence]);
    if (opts.failAt === 'after_event') throw new Error('injected_crash_after_event');
    const result = { jobId, commandId, version:Number(next.version), evidence };
    await c.query(`
      INSERT INTO sf003_test.receipts(job_id,command_id,fingerprint,result)
      VALUES($1,$2,$3,$4::jsonb)
    `, [jobId,commandId,fingerprint,JSON.stringify(result)]);
    return result;
  });
}

const newJob = async () => createJob(randomUUID(), digest(randomUUID()));

// Deliberately not parallelized at module level; each case creates fresh jobs.
test('creation idempotency: same key+input -> one durable job', async () => {
  const key = randomUUID(), fp = digest('same');
  const [a,b] = await Promise.all([createJob(key,fp),createJob(key,fp)]);
  assert.equal(a.id,b.id);
  const n = await pool.query('SELECT count(*)::int AS count FROM sf003_test.jobs WHERE request_key=$1',[key]);
  assert.equal(n.rows[0].count,1);
});

test('same request key with different payload fails closed', async () => {
  const key=randomUUID(); await createJob(key,digest('a'));
  await assert.rejects(createJob(key,digest('b')),/idempotency_conflict/);
});

test('concurrent compare-and-swap updates commit exactly once', async () => {
  const j=await newJob();
  const settled=await Promise.allSettled([
    commitCommand(j.id,'A',0,digest('A')),
    commitCommand(j.id,'B',0,digest('B')),
  ]);
  assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(settled.filter(x=>x.status==='rejected').length,1);
  const r=await pool.query('SELECT version FROM sf003_test.jobs WHERE id=$1',[j.id]);
  assert.equal(Number(r.rows[0].version),1);
});

test('idempotent command replay returns identical receipt and one event', async () => {
  const j=await newJob(),fp=digest('replay');
  const a=await commitCommand(j.id,'replay-command',0,fp);
  const b=await commitCommand(j.id,'replay-command',0,fp);
  assert.deepEqual(a,b);
  await assert.rejects(commitCommand(j.id,'replay-command',0,digest('tamper')),/receipt_fingerprint_conflict/);
  const x=await pool.query('SELECT count(*)::int AS n FROM sf003_test.events WHERE job_id=$1',[j.id]);
  assert.equal(x.rows[0].n,1);
});

for (const point of ['after_update','after_event']) {
  test(`crash injection ${point} rolls back state/event/receipt`, async () => {
    const j=await newJob();
    await assert.rejects(commitCommand(j.id,point,0,digest(point),{failAt:point}),/injected_crash/);
    const x=await pool.query(`SELECT (SELECT version FROM sf003_test.jobs WHERE id=$1) AS version,
      (SELECT count(*)::int FROM sf003_test.events WHERE job_id=$1) AS events,
      (SELECT count(*)::int FROM sf003_test.receipts WHERE job_id=$1) AS receipts`,[j.id]);
    assert.equal(Number(x.rows[0].version),0);
    assert.equal(x.rows[0].events,0);
    assert.equal(x.rows[0].receipts,0);
  });
}

test('lease claim race: one winner; expired lease yields larger fencing epoch', async () => {
  const j=await newJob();
  const attempt=await Promise.allSettled([claim(j.id,'wA'),claim(j.id,'wB')]);
  assert.equal(attempt.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(attempt.filter(x=>x.status==='rejected').length,1);
  assert.equal(attempt.find(x=>x.status==='fulfilled').value,1);
  await pool.query(`UPDATE sf003_test.leases SET expires_at=clock_timestamp()-interval '1 second' WHERE job_id=$1`,[j.id]);
  const epoch2=await claim(j.id,'wC');
  assert.equal(epoch2,2);
  await assert.rejects(commitCommand(j.id,'old-worker',0,digest('old'),{workerId:'wA',epoch:1}),/lease_fenced/);
  const ok=await commitCommand(j.id,'new-worker',0,digest('new'),{workerId:'wC',epoch:2});
  assert.equal(ok.version,1);
});

test('expired lease cannot be renewed; current lease can be renewed', async () => {
  const j=await newJob(); const epoch=await claim(j.id,'w1');
  await renew(j.id,'w1',epoch);
  await pool.query(`UPDATE sf003_test.leases SET expires_at=clock_timestamp()-interval '1 second' WHERE job_id=$1`,[j.id]);
  await assert.rejects(renew(j.id,'w1',epoch),/stale_or_expired_lease/);
});

test('budget fails closed with no partial effects', async () => {
  const j=await newJob();
  await assert.rejects(commitCommand(j.id,'expensive',0,digest('overspend'),{additionalCents:251}),/budget_exceeded/);
  const x=await pool.query('SELECT version,spent_cents FROM sf003_test.jobs WHERE id=$1',[j.id]);
  assert.equal(Number(x.rows[0].version),0);
  assert.equal(Number(x.rows[0].spent_cents),0);
});

test('append-only evidence rejects UPDATE, DELETE and TRUNCATE', async () => {
  const j=await newJob(); await commitCommand(j.id,'immutable',0,digest('immutable'));
  await assert.rejects(pool.query(`UPDATE sf003_test.events SET event_type='tampered' WHERE job_id=$1`,[j.id]),/sf003_immutable_event/);
  await assert.rejects(pool.query(`DELETE FROM sf003_test.events WHERE job_id=$1`,[j.id]),/sf003_immutable_event/);
  await assert.rejects(pool.query('TRUNCATE sf003_test.events'),/sf003_immutable_event/);
});

test('RLS denies untrusted role despite SELECT grant; operator can read', async () => {
  await newJob();
  const c=await pool.connect();
  try {
    await c.query('SET ROLE sf003_untrusted_test');
    const deny=await c.query('SELECT id FROM sf003_test.jobs');
    assert.equal(deny.rowCount,0);
    await assert.rejects(c.query(`UPDATE sf003_test.jobs SET status='running'`),/permission denied/);
    await c.query('RESET ROLE');
    await c.query('SET ROLE sf003_operator_test');
    const allow=await c.query('SELECT id FROM sf003_test.jobs');
    assert.ok(allow.rowCount>0);
  } finally { try { await c.query('RESET ROLE'); } finally { c.release(); } }
});

test('new DB session retains committed state and receipt', async () => {
  const j=await newJob(); const saved=await commitCommand(j.id,'persist',0,digest('persist'));
  const {Client}=await import('pg');
  const c=new Client({connectionString:localUrl});
  try {
    await c.connect();
    const x=await c.query('SELECT result FROM sf003_test.receipts WHERE job_id=$1 AND command_id=$2',[j.id,'persist']);
    assert.deepEqual(x.rows[0].result,saved);
  } finally { await c.end(); }
});
