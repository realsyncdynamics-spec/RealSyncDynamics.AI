/**
 * SF-000: read-only status vocabulary adapter for three unmerged Factory lines.
 * Input is untrusted metadata; output is a display hint, NEVER authorization.
 * No network, database, filesystem, provider calls or state transitions.
 */
const SF006 = Object.freeze({
  queued: 'intake',
  analyzing: 'analysis',
  planning: 'planning',
  implementing: 'implementation',
  validating: 'qa',
  blocked: 'blocked',
  draft_pr_ready: 'human_review',
  failed: 'failed',
  cancelled: 'cancelled',
});
const PR2346 = Object.freeze({
  draft: 'intake',
  specified: 'intake',
  queued: 'intake',
  paused: 'blocked',
  running: 'implementation',
  validating: 'qa',
  pr_ready: 'human_review',
  failed: 'failed',
  canceled: 'cancelled',
});
const MOCK_SF003 = Object.freeze({
  draft: 'intake',
  specified: 'intake',
  approved_for_sandbox: 'preparation',
  running: 'implementation',
  testing: 'qa',
  review_required: 'human_review',
  completed: 'terminal_unverified',
  blocked: 'blocked',
  failed: 'failed',
  cancelled: 'cancelled',
});

export const FACTORY_STATUS_VOCABULARIES = Object.freeze({
  'sf006-offline': SF006,
  'pr2346-contracts': PR2346,
  'sf003-mock': MOCK_SF003,
});

function ownDataField(value, key) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('factory_snapshot_object_required');
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw new Error('factory_snapshot_' + key + '_missing_or_accessor');
  }
  return descriptor.value;
}

/**
 * Only translates published status names. The status is NOT proof that a job,
 * approval, test, PR or provider action exists. In particular, the completed
 * state in the mock is NOT equivalent to an approved or deployed release.
 */
export function inspectFactoryStatus(lineage, snapshot) {
  const vocabulary = Object.getOwnPropertyDescriptor(FACTORY_STATUS_VOCABULARIES, lineage)?.value;
  if (!vocabulary) throw new Error('factory_lineage_unknown');
  const id = ownDataField(snapshot, 'id');
  if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(id)) {
    throw new Error('factory_job_id_invalid');
  }
  const statusField = lineage === 'sf003-mock' ? 'state' : 'status';
  const rawStatus = ownDataField(snapshot, statusField);
  if (typeof rawStatus !== 'string' || !Object.hasOwn(vocabulary, rawStatus)) {
    throw new Error('factory_status_unknown');
  }
  if (lineage !== 'sf003-mock') {
    const repo = ownDataField(snapshot, 'repository');
    if (repo !== 'realsyncdynamics-spec/RealSyncDynamics.AI') {
      throw new Error('factory_repository_unexpected');
    }
  }
  return Object.freeze({
    schemaVersion: 1,
    lineage,
    jobId: id,
    originalStatus: rawStatus,
    displayPhase: vocabulary[rawStatus],
    displayOnly: true,
    statusAuthenticated: false,
    evidenceVerified: false,
    repositoryBindingVerified: false,
    humanReviewStillRequired: true,
    canStartWorker: false,
    canCreatePullRequest: false,
    canMerge: false,
    canDeploy: false,
  });
}
