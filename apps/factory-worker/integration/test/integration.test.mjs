/** SF-004 real module integration tests with entirely synthetic data. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPOSITORY,recordReaOutput,createCodingHandoff,handoffDigest,sha256 } from '../../handoff/bridge.mjs';
import { prepareOfflineIntegration } from '../index.mjs';

const commitSha='a'.repeat(40),jobId='sf004_integration_fixture';
const rawReaJson='{"analysis":"synthetic only"}';
const goalText='Improve synthetic demo greeting without writing files';
const path='examples/factory-demo/hello.js';
const before='export const greeting = "Hallo";\n';
const after='export const greeting = "Hallo Welt";\n';
function sample() {
  const input={
    job:{id:jobId,repository:REPOSITORY,baseRef:commitSha,status:'queued',
      limits:{maxCostCents:100,maxImplementationAttempts:2}},
    goalId:'goal_sf004',goalText,
    limits:{maxIterations:2,maxCostCents:100,maxDurationMs:20000},
    runId:'run_sf004',atMs:1000,commitSha,rawReaJson,provider:'codex',
    proposal:null,sourceSnapshots:{[path]:before},
  };
  const receipt=recordReaOutput({jobId,repository:REPOSITORY,commitSha,rawJson:rawReaJson});
  const handoff=createCodingHandoff({jobId,repository:REPOSITORY,commitSha,
    goal:goalText,evidence:receipt,provider:'codex'});
  input.proposal={schemaVersion:1,jobId,handoffSha256:handoffDigest(handoff),
    changes:[{path,baseSha256:sha256(before),newContent:after}]};
  return input;
}
test('real SF-003 + SF-005 imports remain pending, without execution',()=>{
  const out=prepareOfflineIntegration(sample());
  assert.equal(out.status,'awaiting_verification');
  assert.equal(out.checkpoint.status,'awaiting_verification');
  assert.equal(out.checkpoint.humanReviewRequired,true);
  assert.equal(out.checkpoint.canReleaseOrDeploy,false);
  assert.equal(out.review.fileChanges.length,1);
  assert.equal(out.review.testsRun,false);
  assert.equal(out.testsRun,false);assert.equal(out.changesApplied,false);
  assert.equal(out.pullRequestCreated,false);assert.equal(out.productionModified,false);
  assert.equal(out.checkpoint.iteration,1);
  assert.equal(out.checkpoint.spentCents,0);
  assert.match(out.review.patch,/Hallo Welt/);
});
test('protected file path rejected via real handoff review',()=>{
  const input=sample();
  input.proposal.changes[0].path='.github/workflows/prod.yml';
  input.sourceSnapshots={'.github/workflows/prod.yml':before};
  assert.throws(()=>prepareOfflineIntegration(input),/factory_change_path_invalid/);
});
test('stale source snapshot rejected via real handoff review',()=>{
  const input=sample();input.sourceSnapshots[path]='changed outside pipeline';
  assert.throws(()=>prepareOfflineIntegration(input),/factory_stale_snapshot/);
});
test('goal iterations cannot exceed factory-level budget',()=>{
  const input=sample();input.limits.maxIterations=3;
  assert.throws(()=>prepareOfflineIntegration(input),/factory_limits_exceeded/);
});
