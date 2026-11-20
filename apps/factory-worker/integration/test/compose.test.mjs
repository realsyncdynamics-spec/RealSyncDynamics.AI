import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeOfflineIntegration } from '../compose.mjs';

const sha = 'a'.repeat(40), patchHash = 'b'.repeat(64);
const job = { id:'fixture_004',repository:'realsyncdynamics-spec/RealSyncDynamics.AI',
  baseRef:sha,status:'queued',limits:{maxCostCents:100,maxImplementationAttempts:2} };
const fixture = () => ({
  job, goalId:'goal_004',goalText:'Review demo source only',
  limits:{maxIterations:2,maxCostCents:100,maxDurationMs:20000},
  runId:'run_004',atMs:1000,commitSha:sha,rawReaJson:'{}',provider:'codex',
  proposal:{schemaVersion:1,jobId:job.id,handoffSha256:'f'.repeat(64),changes:[]},
  sourceSnapshots:{'examples/factory-demo/hello.js':'before'},
});
function adapters(events) {
  return {
    createGoalLoop(j,g,limits,id,ms) {
      events.push('loop'); assert.equal(j.baseRef,sha);
      assert.equal(g.requireHumanReview,true);
      assert.deepEqual(g.criteria.map(c=>c.id),['patch_review','isolated_tests']);
      assert.equal(limits.maxIterations,2); return {status:'ready',jobId:j.id};
    },
    recordReaOutput(v) { events.push('rea');assert.equal(v.commitSha,sha);return {sha256:'c'.repeat(64)}; },
    createCodingHandoff(v) {events.push('handoff');assert.equal(v.provider,'codex');return {jobId:v.jobId};},
    prepareReview(v,p,sources) {
      events.push('review');assert.equal(v.jobId,p.jobId);
      assert.equal(Object.keys(sources).length,1);
      return {status:'review_required',jobId:job.id,baseCommitSha:sha,patchSha256:patchHash,
        testsRun:false,filesWritten:false,pullRequestCreated:false,deploymentPerformed:false};
    },
    submitLoopEvidence(s,r,ms) {
      events.push('submit');assert.equal(s.status,'ready');assert.equal(r.costCents,0);
      assert.equal(r.evidence.length,1);
      assert.equal(r.evidence[0].evidenceRef,'sha256:' + patchHash);
      assert.equal(ms,1000);return {status:'awaiting_verification'};
    },
    createNextStepsDocument(s) {
      events.push('checkpoint');assert.equal(s.status,'awaiting_verification');
      return {status:'awaiting_verification',jobId:job.id,humanReviewRequired:true,canReleaseOrDeploy:false};
    },
  };
}
test('composes untrusted handoff into pending verification, never approval',()=>{
  const events=[], result=composeOfflineIntegration(fixture(),adapters(events));
  assert.deepEqual(events,['loop','rea','handoff','review','submit','checkpoint']);
  assert.equal(result.status,'awaiting_verification');assert.equal(result.testsRun,false);
  assert.equal(result.changesApplied,false);assert.equal(result.pullRequestCreated,false);
  assert.equal(result.productionModified,false);assert.equal(result.unverifiedRequirements.length,5);
});
test('unexpected deploy and command fields denied before adapter call',()=>{
  for (const x of [{...fixture(),command:'npm publish'},{...fixture(),deploy:true}]) {
    const events=[];assert.throws(()=>composeOfflineIntegration(x,adapters(events)),/input_schema_denied/);
    assert.deepEqual(events,[]);
  }
});
test('unpinned commit, wrong job status, and mismatched base denied',()=>{
  for (const x of [{...fixture(),commitSha:'main'},
    {...fixture(),job:{...job,baseRef:'main'}},
    {...fixture(),job:{...job,status:'draft_pr_ready'}}]) {
    assert.throws(()=>composeOfflineIntegration(x,adapters([])),/unpinned_job_denied/);
  }
});
test('missing or adversarial adapters denied',()=>{
  assert.throws(()=>composeOfflineIntegration(fixture(),{}),/adapter_contract_invalid/);
  assert.throws(()=>composeOfflineIntegration(fixture(),{...adapters([]),prepareReview:null}),/adapter_contract_invalid/);
});
test('false test, write, PR and deploy claims are rejected',()=>{
  for (const key of ['testsRun','filesWritten','pullRequestCreated','deploymentPerformed']) {
    const op=adapters([]),base=op.prepareReview;
    op.prepareReview=(...args)=>({...base(...args),[key]:true});
    assert.throws(()=>composeOfflineIntegration(fixture(),op),/review_contract_denied/);
  }
});
test('wrong job, commit or patch hash denied',()=>{
  for (const override of [{jobId:'other'},{baseCommitSha:'d'.repeat(40)},{patchSha256:'../secret'}]) {
    const op=adapters([]),base=op.prepareReview;
    op.prepareReview=(...args)=>({...base(...args),...override});
    assert.throws(()=>composeOfflineIntegration(fixture(),op),/review_contract_denied/);
  }
});
test('forged completed-review stage cannot advance job',()=>{
  const op=adapters([]);op.submitLoopEvidence=()=>({status:'review_required'});
  assert.throws(()=>composeOfflineIntegration(fixture(),op),/verification_must_remain_pending/);
});
test('release-capable checkpoint denied',()=>{
  const op=adapters([]);
  op.createNextStepsDocument=()=>({jobId:job.id,status:'awaiting_verification',humanReviewRequired:true,canReleaseOrDeploy:true});
  assert.throws(()=>composeOfflineIntegration(fixture(),op),/checkpoint_denied/);
});
test('nonplain snapshots denied',()=>{
  assert.throws(()=>composeOfflineIntegration({...fixture(),sourceSnapshots:new Map()},adapters([])),/snapshots_invalid/);
});
