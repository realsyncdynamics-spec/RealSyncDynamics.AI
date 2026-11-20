import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvedTestUrl } from './db-target.mjs';
import { verifyLocalDatabase } from './preflight-db.mjs';
const okay = 'postgresql://postgres:local-only@127.0.0.1:55432/sf003_test_factory';
const env = { SF003_DISPOSABLE_DB:'YES', SF003_SCHEMA_RESET:'YES' };
const accepted = (raw, e = env) => approvedTestUrl(raw,e);
const denied = (raw, e = env) => assert.throws(() => accepted(raw,e));

test('requires two deliberate destructive-operation approvals',()=>{
  denied(okay,{}); denied(okay,{SF003_DISPOSABLE_DB:'YES'});
  assert.equal(accepted(okay),okay);
});
test('requires a named, explicitly nonstandard TCP port',()=>{
  denied(okay.replace('55432','5432')); denied(okay.replace(':55432',''));
});
test('forbids remote and ambiguous hostnames',()=>{
  for(const host of ['db.example.com','localhost','127.0.0.2','0.0.0.0','169.254.169.254'])
    denied(okay.replace('127.0.0.1',host));
});
test('forbids unapproved database names',()=>{
  for(const name of ['postgres','sf003_test_','sf003_test_old-data','realsync_live','sf003_test_%2fprivate'])
    denied(okay.replace('sf003_test_factory',name));
});
test('forbids URI query overrides and SSL redirection flags',()=>{
  for(const suffix of ['?host=evil.example','?sslmode=require','?port=5432','?options=-c%20search_path%3Dpublic','#secret'])
    denied(okay+suffix);
});
test('rejects non-postgres schemes',()=>denied(okay.replace('postgresql:','http:')));
test('rejects missing user or password',()=>{
  denied(okay.replace('postgres','')); denied(okay.replace('local-only',''));
});
test('rejects overlong or malformed targets',()=>{
  denied(''); denied('not a URL'); denied(okay+'x'.repeat(1025));
});
test('accepts strict IPv6 loopback target',()=>{
  assert.equal(accepted(okay.replace('127.0.0.1','[::1]')).includes('[::1]'),true);
});
test('real server preflight requires matching name and loopback endpoint', async()=>{
  let queryCount=0;
  const fakePool={query:async()=>{
    ++queryCount;
    return {rows:[{db_name:'sf003_test_factory',address:'192.168.1.1',port:55432,superuser:'on',recovery:false}]};
  }};
  await assert.rejects(verifyLocalDatabase(fakePool,'sf003_test_factory'),/identity/);
  assert.equal(queryCount,1);
});
test('server preflight rejects a populated DB with no schema write', async()=>{
  let queryCount=0;
  const fakePool={query:async()=> {
    ++queryCount;
    return queryCount===1 ? {rows:[{db_name:'sf003_test_factory',address:'127.0.0.1',port:55432,superuser:'on',recovery:false}]} : {rows:[{nspname:'real_data'}]};
  }};
  await assert.rejects(verifyLocalDatabase(fakePool,'sf003_test_factory'),/non-test objects/);
  assert.equal(queryCount,2);
});
test('server preflight can complete only on a verified empty mock DB', async()=>{
  let queryCount=0;
  const fakePool={query:async()=> {
    ++queryCount;
    return queryCount===1 ? {rows:[{db_name:'sf003_test_factory',address:'127.0.0.1',port:55432,superuser:'on',recovery:false}]} : {rows:[]};
  }};
  await verifyLocalDatabase(fakePool,'sf003_test_factory');
  assert.equal(queryCount,2);
});
