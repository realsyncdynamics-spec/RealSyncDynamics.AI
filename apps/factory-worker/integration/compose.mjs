/**
 * SF-004: offline composition of SF-003 handoff and SF-005 loop contracts.
 * No model, network, shell, filesystem, GitHub, database, approval or deploy.
 * Operations are fixed imports in index.mjs, never supplied by task JSON.
 */
const SHA40 = /^[0-9a-f]{40}$/;
const REQUIRED = ['job','goalId','goalText','limits','runId','atMs','commitSha',
  'rawReaJson','provider','proposal','sourceSnapshots'];
const REQUIRED_OPERATIONS = ['createGoalLoop','recordReaOutput','createCodingHandoff',
  'prepareReview','submitLoopEvidence','createNextStepsDocument'];
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
function plain(o) {
  return o !== null && typeof o === 'object' && !Array.isArray(o) &&
    (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
}
function exact(o,keys) {
  return plain(o) && Object.keys(o).sort().join('|') === [...keys].sort().join('|');
}
export function composeOfflineIntegration(input, operations) {
  if (!exact(input, REQUIRED)) throw new Error('sf004_input_schema_denied');
  if (!plain(operations) || !REQUIRED_OPERATIONS.every(k => own(operations,k) && typeof operations[k] === 'function')) {
    throw new Error('sf004_adapter_contract_invalid');
  }
  if (!plain(input.job) || input.job.status !== 'queued' ||
      !SHA40.test(input.commitSha) || input.job.baseRef !== input.commitSha) {
    throw new Error('sf004_unpinned_job_denied');
  }
  if (!plain(input.sourceSnapshots)) throw new Error('sf004_snapshots_invalid');
  const goal = {
    schemaVersion: 1, goalId: input.goalId, jobId: input.job.id,
    repository: input.job.repository, statement: input.goalText,
    requireHumanReview: true,
    criteria: [
      { id:'patch_review', description:'Review diff against a separately attested checkout' },
      { id:'isolated_tests', description:'Run isolated negative, security and functional tests' },
    ],
  };
  const started = operations.createGoalLoop(input.job,goal,input.limits,input.runId,input.atMs);
  const reaReceipt = operations.recordReaOutput({
    jobId:input.job.id, repository:input.job.repository,
    commitSha:input.commitSha, rawJson:input.rawReaJson,
  });
  const handoff = operations.createCodingHandoff({
    jobId:input.job.id, repository:input.job.repository,
    commitSha:input.commitSha, goal:input.goalText,
    evidence:reaReceipt, provider:input.provider,
  });
  const review = operations.prepareReview(handoff,input.proposal,input.sourceSnapshots);
  if (review?.status !== 'review_required' || review?.jobId !== input.job.id ||
      review?.baseCommitSha !== input.commitSha ||
      review?.testsRun !== false || review?.filesWritten !== false ||
      review?.pullRequestCreated !== false || review?.deploymentPerformed !== false ||
      typeof review?.patchSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(review.patchSha256)) {
    throw new Error('sf004_review_contract_denied');
  }
  // A proposed checksum is not proof of correctness or execution. No verifier is called.
  const awaiting = operations.submitLoopEvidence(started,{
    authorId:'offline_fixture', costCents:0,
    evidence:[{criterionId:'patch_review',evidenceRef:'sha256:' + review.patchSha256}],
  },input.atMs);
  if (awaiting?.status !== 'awaiting_verification') throw new Error('sf004_verification_must_remain_pending');
  const checkpoint = operations.createNextStepsDocument(awaiting);
  if (checkpoint?.humanReviewRequired !== true || checkpoint?.canReleaseOrDeploy !== false ||
      checkpoint?.status !== 'awaiting_verification' || checkpoint?.jobId !== input.job.id) {
    throw new Error('sf004_checkpoint_denied');
  }
  return Object.freeze({
    schemaVersion:1, mode:'offline-fixture-only', status:'awaiting_verification',
    jobId:input.job.id,baseCommitSha:input.commitSha,review,reaReceipt,checkpoint,
    unverifiedRequirements:Object.freeze([
      'independent_checkout_attestation','real_isolated_test_execution',
      'server_authenticated_authorization','durable_evidence_and_budget',
      'human_review_and_separate_release_gate',
    ]),
    testsRun:false,changesApplied:false,pullRequestCreated:false,productionModified:false,
  });
}
