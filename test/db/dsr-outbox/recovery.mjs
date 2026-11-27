import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const dir = await mkdtemp(join(tmpdir(),'dsr-intake-'));
let db = new PGlite(dir);
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table memberships(tenant_id uuid,user_id uuid,role text);
    create table dsr_requests(id uuid primary key default gen_random_uuid(),tenant_id uuid,request_type text,
    status text,requester_email text,requester_name text,subject_description text,assigned_to text,
    affected_assets text[],metadata jsonb,completed_at timestamptz,response_notes text);`);
  await db.exec(await readFile(new URL('./intake.sql',import.meta.url),'utf8'));
  const tenant = randomUUID(), actor = randomUUID(), operation = randomUUID();
  await db.query("insert into memberships values ($1,$2,'editor')",[tenant,actor]);
  const intake = (user = actor) => db.query("select dsr_intake($1,$2,$3,'access','test@example.invalid') as id",[tenant,user,operation]);
  await assert.rejects(intake(randomUUID()),/writer required/);
  await db.exec('alter table dsr_outbox add constraint inject_failure check(false)');
  await assert.rejects(intake(),/inject_failure/);
  assert.equal((await db.query('select count(*)::int as n from dsr_requests')).rows[0].n,0);
  await db.exec('alter table dsr_outbox drop constraint inject_failure');
  await db.exec('set role authenticated');
  await assert.rejects(intake(),/permission denied/);
  await db.exec('reset role; set role service_role');
  const first = (await intake()).rows[0].id;
  await db.close();
  db = new PGlite(dir);
  await db.exec('set role service_role');
  assert.equal((await intake()).rows[0].id,first);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select dsr_id,evidence_status from dsr_outbox')).rows,
    [{dsr_id:first,evidence_status:'pending'}]);
  assert.equal((await db.query('select count(*)::int as n from dsr_requests')).rows[0].n,1);
  console.log('PASS: role restrictions, atomic rollback, durable pending task and replay after restart');
  await db.exec(await readFile(new URL('./mutations.sql',import.meta.url),'utf8'));
  const mutate = async (action, revision, patch, key = randomUUID()) => {
    const result = await db.query('select dsr_mutate($1,$2,$3,$4,$5,$6,$7)::int as revision',
      [tenant,actor,key,first,revision,action,JSON.stringify(patch)]);
    return result.rows[0].revision;
  };
  const assignment = randomUUID();
  await db.exec('set role service_role');
  assert.equal(await mutate('assign',1,{assigned_to:'team-a'},assignment),2);
  assert.equal(await mutate('assign',1,{assigned_to:'team-a'},assignment),2);
  await assert.rejects(mutate('assign',1,{assigned_to:'team-b'},assignment),/operation conflict/);
  await assert.rejects(mutate('close',1,{}),/revision conflict/);
  assert.equal((await intake()).rows[0].id,first);
  assert.equal(await mutate('update',2,{status:'in_progress',affected_assets:['asset']}),3);
  await assert.rejects(mutate('update',3,{tenant_id:randomUUID()}),/invalid patch/);
  await db.exec("reset role; alter table dsr_outbox add constraint inject_close check(event_type <> 'dsr.closed')");
  await assert.rejects(mutate('close',3,{}),/inject_close/);
  assert.deepEqual((await db.query('select status,completed_at from dsr_requests')).rows,
    [{status:'in_progress',completed_at:null}]);
  await db.exec('alter table dsr_outbox drop constraint inject_close; set role service_role');
  assert.equal(await mutate('close',3,{}),4);
  await db.exec('reset role');
  assert.deepEqual((await db.query('select event_type from dsr_outbox order by revision')).rows.map(row=>row.event_type),
    ['dsr.created','dsr.assigned','dsr.updated','dsr.closed']);
  assert.deepEqual((await db.query('select status,completed_at is not null as finished from dsr_requests')).rows,
    [{status:'completed',finished:true}]);
  console.log('PASS: assignment, update, closure, revision conflicts, replay and atomic rollback');
} finally {
  await db.close();
  await rm(dir,{recursive:true,force:true});
}
