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
    affected_assets text[],metadata jsonb);`);
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
} finally {
  await db.close();
  await rm(dir,{recursive:true,force:true});
}
