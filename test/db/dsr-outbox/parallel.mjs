// In an isolated directory: npm install --no-save embedded-postgres@18.7.0-beta.19
// Place intake.sql next to this file, then run node parallel.mjs as a non-root user.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import EmbeddedPostgres from 'embedded-postgres';

const directory = await mkdtemp(join(tmpdir(), 'dsr-parallel-'));
const database = new EmbeddedPostgres({
  databaseDir: join(directory, 'data'), port: 55436, password: randomUUID(),
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', 'unix_socket_directories='],
  autoRehydrateSymlinks: true, onLog() {},
});
const clients = [];
async function connect() {
  const client = database.getPgClient();
  await client.connect();
  clients.push(client);
  return client;
}
let started = false;
try {
  await database.initialise();
  await database.start();
  started = true;
  const observer = await connect();
  await observer.query(`create role anon; create role authenticated; create role service_role;
    create table memberships(tenant_id uuid,user_id uuid,role text);
    create table dsr_requests(id uuid primary key default gen_random_uuid(),tenant_id uuid,request_type text,
      status text,requester_email text,requester_name text,subject_description text,assigned_to text,
      affected_assets jsonb,metadata jsonb);`);
  await observer.query(await readFile(new URL('./intake.sql', import.meta.url), 'utf8'));
  const tenant = randomUUID(), actor = randomUUID();
  await observer.query("insert into memberships values ($1,$2,'editor')", [tenant,actor]);
  const writers = [];
  for (let index = 0; index < 20; index++) {
    const client = await connect();
    await client.query("set role service_role; set statement_timeout='20s'");
    writers.push(client);
  }
  const [leader, ...followers] = writers;
  const pids = followers.map(client => client.processID);
  assert.equal(new Set(writers.map(client => client.processID)).size, 20);

  for (const end of ['commit', 'rollback']) {
    const operation = randomUUID();
    const create = async client => (await client.query(
      "select dsr_intake($1,$2,$3,'access','test@example.invalid') as id",
      [tenant,actor,operation])).rows[0].id;
    await leader.query('begin');
    const first = await create(leader);
    const results = Promise.allSettled(followers.map(create));
    try {
      const deadline = Date.now() + 10000;
      for (;;) {
        const { rows } = await observer.query(
          "select count(*)::int as n from pg_stat_activity where pid=any($1::int[]) and wait_event='advisory'", [pids]);
        if (rows[0].n === followers.length) break;
        assert.ok(Date.now() < deadline, 'all 19 followers must contend for the operation');
        await delay(20);
      }
      await leader.query(end);
    } finally {
      await leader.query('rollback');
    }
    const ids = (await results).map(result => {
      if (result.status === 'rejected') throw result.reason;
      return result.value;
    });
    assert.equal(new Set(ids).size, 1);
    assert.equal(first === ids[0], end === 'commit');
    const receipts = await observer.query(
      'select dsr_id,evidence_status from dsr_outbox where operation_id=$1', [operation]);
    assert.deepEqual(receipts.rows, [{dsr_id:ids[0], evidence_status:'pending'}]);
    console.log('PASS', end, 'with 19 confirmed waiters');
  }
  const totals = await observer.query('select (select count(*) from dsr_requests)::int as requests, (select count(*) from dsr_outbox)::int as tasks');
  assert.deepEqual(totals.rows, [{requests:2, tasks:2}]);
} finally {
  await Promise.allSettled(clients.map(client => client.end()));
  if (started) await database.stop();
  await rm(directory, {recursive:true, force:true});
}
