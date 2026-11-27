/**
 * #2360 canonical-migration integration (isolated localhost PostgreSQL).
 * Applies real DSR tracker, audit log, partitioned hash-chain, HMAC lifecycle,
 * and erasure finalizer migrations from the repository. No production schema.
 * This is a relevant migration SUBSET, not the complete historical replay.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const env = process.env.DSR_TEST_DATABASE_URL;
if (!env) throw new Error('DSR_TEST_DATABASE_URL is required');
const root = new URL(env);
if (!['127.0.0.1','localhost'].includes(root.hostname) ||
    root.pathname !== '/dsr_outbox_contract' ||
    !['postgres:', 'postgresql:'].includes(root.protocol)) {
  throw new Error('Refusing database URL outside disposable localhost contract DB');
}
const appFile = path => readFile(new URL('../../../' + path, import.meta.url), 'utf8');
const candidate = path => readFile(new URL('./' + path, import.meta.url), 'utf8');
const makeClient = url => new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:10000});
const supervisor = makeClient(root);
await supervisor.connect();
const dbName='dsr_outbox_real_runtime';
const runtime=new URL(root);
runtime.pathname='/' + dbName;
let db=null, checks=0;
async function check(name,callback) {
  await callback();
  checks++;
  console.log('PASS canonical-'+checks+': '+name);
}
async function rpc(sql,args=[],role='service_role') {
  const c=makeClient(runtime);
  await c.connect();
  try {
    await c.query('set role '+role);
    return await c.query(sql,args);
  } finally {await c.end();}
}
const intake='select public.dsr_intake($1::uuid,$2::uuid,$3::uuid,$4::text,$5::text,NULL::text,NULL::text,NULL::text,ARRAY[]::text[]) as id';
const claim='select * from public.dsr_claim_outbox($1::uuid,1,120)';
const ack='select public.dsr_ack_evidence($1::uuid,$2::uuid,$3::uuid,$4::bigint) as applied';
async function migrate(name) {
  await db.query(await appFile('supabase/migrations/'+name));
  console.log('APPLIED '+name);
}
async function verify(t,actor,wanted) {
  const c=makeClient(runtime); await c.connect();
  try {
    await c.query('begin');
    await c.query('set role authenticated');
    await c.query("select set_config('request.jwt.claims',$1,true)",[
      JSON.stringify({sub:actor,role:'authenticated'})
    ]);
    const result=await c.query('select * from public.runtime_events_verify_chain($1::uuid,1,null)',[t]);
    assert.equal(result.rows.length,wanted);
    assert.ok(result.rows.every(row=>row.valid===true&&row.chain_ok===true),
      'Canonical hash-chain verification failed');
    await c.query('rollback');
  } catch(e) {await c.query('rollback');throw e;}
  finally {await c.end();}
}
try {
  await supervisor.query('create database '+dbName);
  db=makeClient(runtime);await db.connect();

  const boot=(await appFile('scripts/test-db/bootstrap.sql'))
    .replace(/^\\set ON_ERROR_STOP on\s*$/gm,'');
  await db.query(boot);

  const setUpdatedSource=await appFile('supabase/migrations/20260509020000_monitoring_tables.sql');
  const fn=setUpdatedSource.match(/CREATE OR REPLACE FUNCTION public\.set_updated_at\(\)[\s\S]*?\$\$;/);
  if(!fn)throw new Error('Canonical set_updated_at() body missing');
  await db.query(fn[0]);

  await migrate('20260514100000_governance_admin_log.sql');
  await migrate('20260515200000_dsr_tracker.sql');
  await migrate('20260602100000_runtime_events_backbone.sql');
  await migrate('20260603000000_subject_ref_lifecycle.sql');
  await migrate('20260604100000_runtime_events_spec_version_v02.sql');
  await migrate('20260626000000_dsr_erasure_automation.sql');
  for(const name of ['intake.sql','worker.sql','evidence-ack.sql']) {
    await db.query(await candidate(name));
  }

  const tenant=randomUUID(),actor=randomUUID(),operation=randomUUID(),worker=randomUUID();
  await db.query('insert into public.tenants(id,name) values($1,$2)',[tenant,'real-runtime-dsr']);
  await db.query('insert into auth.users(id,email) values($1,$2)',[actor,'actor@example.invalid']);
  await db.query("insert into public.memberships(tenant_id,user_id,role) values($1,$2,'owner')",[tenant,actor]);
  await db.query("insert into public.tenant_memberships(tenant_id,user_id,role) values($1,$2,'owner')",[tenant,actor]);
  const secretName='dsr_test_'+tenant;
  await db.query("insert into public.subject_ref_keys(tenant_id,key_version,vault_secret_name,status) values($1,1,$2,'active')",[tenant,secretName]);
  await db.query('insert into public.app_secrets(name,value) values($1,$2)',[secretName,'synthetic-local-HMAC-secret']);

  const dsr=(await rpc(intake,[tenant,actor,operation,'erasure','subject@example.invalid'])).rows[0].id;
  const lease=(await rpc(claim,[worker])).rows[0];
  assert.equal(lease.operation_id,operation);

  await check('missing HMAC fails closed without an evidence event',async()=>{
    await assert.rejects(rpc(ack,[tenant,operation,worker,lease.lease_epoch]),/SUBJECT_REF_PENDING/);
    const {rows}=await db.query('select evidence_status from public.dsr_outbox where operation_id=$1',[operation]);
    assert.equal(rows[0].evidence_status,'retry');
    assert.equal((await db.query('select count(*)::int as n from public.runtime_events')).rows[0].n,0);
  });

  // Simulate the still-unimplemented worker HMAC/mapping recovery through
  // the existing canonical HMAC function and schema, never an invented digest.
  const ref=(await db.query("select public.subject_ref_compute($1::uuid,'email',$2) as ref",
    [tenant,'subject@example.invalid'])).rows[0].ref;
  assert.match(ref,/^[0-9a-f]{64}$/);
  await db.query(
    'insert into public.subject_ref_mappings(subject_ref,tenant_id,key_version,subject_kind) values($1,$2,1,$3)',
    [ref,tenant,'email'],
  );
  await db.query(
    "update public.dsr_requests set metadata=jsonb_build_object('subject_ref',$1::text) where id=$2::uuid",
    [ref,dsr],
  );
  await check('canonical HMAC reproduces stable subject reference',async()=>{
    const again=(await db.query("select public.subject_ref_compute($1::uuid,'email',$2) as ref",
      [tenant,' SUBJECT@EXAMPLE.INVALID '])).rows[0].ref;
    assert.equal(again,ref);
  });

  await check('real hash-chain insert failure atomically rolls back erasure and audit',async()=>{
    await db.query("alter table public.runtime_events add constraint inject_block_erasure check(type <> 'dsr.erasure_requested')");
    try {
      await assert.rejects(rpc(ack,[tenant,operation,worker,lease.lease_epoch]),/inject_block_erasure/);
    } finally {await db.query('alter table public.runtime_events drop constraint inject_block_erasure');}
    assert.equal((await db.query('select count(*)::int as n from public.runtime_events')).rows[0].n,0);
    assert.equal((await db.query('select count(*)::int as n from public.governance_admin_log')).rows[0].n,0);
    assert.equal((await db.query('select deletion_requested_at from public.subject_ref_mappings where subject_ref=$1',[ref])).rows[0].deletion_requested_at,null);
  });
  await check('canonical evidence chain, audit and erasure scheduling commit together',async()=>{
    assert.equal((await rpc(ack,[tenant,operation,worker,lease.lease_epoch])).rows[0].applied,true);
    await verify(tenant,actor,2);
    const {rows}=await db.query('select tenant_seq,event_hash,prev_hash,type,spec_version from public.runtime_events where tenant_id=$1 order by tenant_seq',[tenant]);
    assert.deepEqual(rows.map(z=>z.type),['dsr.created','dsr.erasure_requested']);
    assert.ok(rows.every(z=>z.event_hash.length===32&&z.spec_version==='0.2'));
    assert.equal(rows[0].prev_hash,null);
    assert.ok(rows[1].prev_hash.equals(rows[0].event_hash));
    assert.equal((await db.query('select count(*)::int as n from public.governance_admin_log')).rows[0].n,1);
    assert.ok((await db.query('select deletion_requested_at from public.subject_ref_mappings where subject_ref=$1',[ref])).rows[0].deletion_requested_at);
  });
  await check('replaying an already completed ACK leaves the real chain untouched',async()=>{
    assert.equal((await rpc(ack,[tenant,operation,worker,lease.lease_epoch])).rows[0].applied,false);
    await verify(tenant,actor,2);
  });
  await check('real append-only trigger blocks updates on runtime_events',async()=>{
    await assert.rejects(db.query(
      "update public.runtime_events set payload='{}'::jsonb where tenant_id=$1",
      [tenant]),/append-only/i);
    await verify(tenant,actor,2);
  });
  await check('RLS verifier denies unaffiliated authenticated user',async()=>{
    const outsider=randomUUID();
    await db.query('insert into auth.users(id,email) values($1,$2)',[outsider,'outsider@example.invalid']);
    await assert.rejects(verify(tenant,outsider,2),/forbidden/i);
  });
  await check('canonical runtime_events table is RLS-protected and partitioned',async()=>{
    const {rows}=await db.query(
      "select relrowsecurity from pg_class where oid='public.runtime_events'::regclass");
    assert.equal(rows[0].relrowsecurity,true);
    assert.ok(Number((await db.query(
      "select count(*) as n from pg_inherits where inhparent='public.runtime_events'::regclass")).rows[0].n)>=1);
  });

  console.log(JSON.stringify({ok:true,checks,proof:'selected-original-migrations-sha256-hash-chain',allHistoricalMigrations:false,productionChanges:0}));
} finally {
  if(db)await db.end();
  await supervisor.end();
}
