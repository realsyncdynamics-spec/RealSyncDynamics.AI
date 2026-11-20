// PostgreSQL 16+ synthetic acceptance. Safe only for a throwaway local test DB.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';

const uri=process.env.TEST_DB_URL;
if (!uri) throw Error('TEST_DB_URL required for isolated local database');
const host=new URL(uri).hostname;
if (!['localhost','127.0.0.1','[::1]'].includes(host))
  throw Error('Refusing non-local TEST_DB_URL');
const pool=new pg.Pool({connectionString:uri,max:8,connectionTimeoutMillis:3000});
const q=(sql,params=[])=>pool.query(sql,params);
const tenant=randomUUID(), actor=randomUUID();
const count=async table=>Number((await q('select count(*)::int as n from '+table)).rows[0].n);
async function service(sql,params=[]) {
  const db=await pool.connect();
  try { await db.query('set role service_role'); return await db.query(sql,params); }
  finally { await db.query('reset role'); db.release(); }
}
async function expectSqlstate(fn,code) {
  await assert.rejects(fn,e=>{assert.equal(e.code,code,e.message);return true;});
}
async function createDsr(type='access') {
  const operation=randomUUID();
  const {rows}=await service("select dsr_intake($1,$2,$3,$4,'test@example.invalid') as id",[tenant,actor,operation,type]);
  return {operation,id:rows[0].id};
}
const claim=async()=> (await service('select * from dsr_outbox_claim(1,120)')).rows[0]??null;
const complete=(op,token)=>service('select dsr_outbox_complete($1,$2,$3) as id',[tenant,op,token]);
async function linkSubject(id,ref) {
  await q("update dsr_requests set metadata=jsonb_build_object('subject_ref',$2::text) where id=$1",[id,ref]);
  await q('insert into subject_ref_mappings(subject_ref,tenant_id) values($1,$2)',[ref,tenant]);
}
try {
  // This runner rejects remote databases, then resets ONLY the disposable test DB.
  await q('drop schema if exists public cascade; create schema public;');
  await q('create role service_role bypassrls; create role anon; create role authenticated;');
  await q('grant usage on schema public to service_role, anon, authenticated');
  await q('create table public.memberships(tenant_id uuid,user_id uuid,role text);');
  await q("create table public.dsr_requests(id uuid primary key default gen_random_uuid(), tenant_id uuid, request_type text, status text, requester_email text, requester_name text, subject_description text, assigned_to text, affected_assets jsonb, metadata jsonb default '{}'::jsonb);");
  await q('create table public.subject_ref_mappings(subject_ref text primary key, tenant_id uuid, deletion_requested_at timestamptz, erased_at timestamptz);');
  await q('create table public.governance_admin_log(id uuid primary key default gen_random_uuid(),tenant_id uuid,actor_user_id uuid,actor_email text,action text,target_type text,target_id text,payload jsonb);');
  await q('create table public.runtime_events(id uuid primary key default gen_random_uuid(),tenant_id uuid,type text,severity text,source text,spec_version text,review_status text,subject_ref text,payload jsonb,correlation_id uuid);');
  await q(await readFile(new URL('./intake.sql',import.meta.url),'utf8'));
  await q(await readFile(new URL('./consumer.sql',import.meta.url),'utf8'));
  await q("insert into memberships values($1,$2,'editor')",[tenant,actor]);
  await expectSqlstate(()=>service('select * from dsr_outbox_claim(0,120)'),'22023');

  // Database grants deny an ordinary user from claiming or viewing the queue.
  const unauthorized=await pool.connect();
  try {
    await unauthorized.query('set role authenticated');
    await expectSqlstate(()=>unauthorized.query('select * from dsr_outbox_claim(1,120)'),'42501');
    await expectSqlstate(()=>unauthorized.query('select * from dsr_outbox'),'42501');
  } finally {await unauthorized.query('reset role');unauthorized.release();}

  // Exclusive claim and a failed subject-ref resolution.
  const a=await createDsr();
  const [one,two]=await Promise.all([claim(),claim()]);
  const claims=[one,two].filter(Boolean);
  assert.equal(claims.length,1,'only one concurrent claim');
  const oldLease=claims[0];
  await expectSqlstate(()=>complete(a.operation,oldLease.lease_token),'22023');
  assert.equal(await count('runtime_events'),0);
  assert.equal(await count('governance_admin_log'),0);
  const failed=(await service('select dsr_outbox_fail($1,$2,$3,$4) as state',
    [tenant,a.operation,oldLease.lease_token,'SUBJECT_REF_PENDING'])).rows[0];
  assert.equal(failed.state,'retry');
  await linkSubject(a.id,'subject-ref-first');
  await q("update dsr_outbox set next_attempt_at=now()-interval '1 second' where operation_id=$1",[a.operation]);
  const renewed=await claim();
  assert.notEqual(renewed.lease_token,oldLease.lease_token);
  await expectSqlstate(()=>complete(a.operation,oldLease.lease_token),'40001');
  assert.ok((await complete(a.operation,renewed.lease_token)).rows[0].id);
  await expectSqlstate(()=>complete(a.operation,renewed.lease_token),'40001');
  assert.equal(await count('runtime_events'),1);
  assert.equal(await count('governance_admin_log'),1);

  // Forced Evidence failure rolls back audit, erasure request and ACK.
  const b=await createDsr('erasure');
  await linkSubject(b.id,'subject-ref-erasure');
  const leaseB=await claim();
  assert.equal(leaseB.dsr_id,b.id);
  await q('alter table runtime_events add constraint injected_fail check (false) not valid');
  await expectSqlstate(()=>complete(b.operation,leaseB.lease_token),'23514');
  assert.equal(await count('governance_admin_log'),1);
  assert.equal((await q("select deletion_requested_at is null as untouched from subject_ref_mappings where subject_ref='subject-ref-erasure'")).rows[0].untouched,true);
  await q('alter table runtime_events drop constraint injected_fail');
  await complete(b.operation,leaseB.lease_token);
  assert.equal(await count('runtime_events'),2);
  assert.equal(await count('governance_admin_log'),2);
  assert.equal((await q("select deletion_requested_at is not null as queued from subject_ref_mappings where subject_ref='subject-ref-erasure'")).rows[0].queued,true);

  // Crash/expired lease and fenced old worker.
  const c=await createDsr();
  await linkSubject(c.id,'subject-ref-third');
  const leaseC=await claim();
  await q("update dsr_outbox set lease_until=now()-interval '1 second' where operation_id=$1",[c.operation]);
  const replacement=await claim();
  assert.notEqual(replacement.lease_token,leaseC.lease_token);
  await expectSqlstate(()=>complete(c.operation,leaseC.lease_token),'40001');
  await complete(c.operation,replacement.lease_token);
  assert.equal(await count('runtime_events'),3);

  // Exhausted abandoned jobs become explicit dead letters.
  const d=await createDsr();
  await q("update dsr_outbox set attempt_count=8, lease_until=now()-interval '1 second' where operation_id=$1",[d.operation]);
  assert.equal(await claim(),null);
  assert.equal((await q('select evidence_status from dsr_outbox where operation_id=$1',[d.operation])).rows[0].evidence_status,'failed');
  console.log('PASS: claims, retry, fenced leases, atomic Evidence/ACK, erasure + dead-letter');
  console.log('LIMIT: synthetic schema — real hash-chain, JWT/RLS, and Edge integration untested');
} finally {await pool.end();}
