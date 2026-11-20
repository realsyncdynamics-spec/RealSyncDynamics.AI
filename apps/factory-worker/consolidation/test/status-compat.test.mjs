import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FACTORY_STATUS_VOCABULARIES, inspectFactoryStatus } from '../status-compat.mjs';

const REPOSITORY = 'realsyncdynamics-spec/RealSyncDynamics.AI';
const fixture = (lineage, status) => lineage === 'sf003-mock'
  ? { id: 'SF000_test', state: status, scopeId: 'internal' }
  : { id: 'SF000_test', status, repository: REPOSITORY };

test('all published status variants are explicitly mapped', () => {
  assert.deepEqual(Object.keys(FACTORY_STATUS_VOCABULARIES['sf006-offline']), [
    'queued', 'analyzing', 'planning', 'implementing', 'validating', 'blocked',
    'draft_pr_ready', 'failed', 'cancelled',
  ]);
  assert.deepEqual(Object.keys(FACTORY_STATUS_VOCABULARIES['pr2346-contracts']), [
    'draft', 'specified', 'queued', 'paused', 'running', 'validating',
    'pr_ready', 'failed', 'canceled',
  ]);
  assert.deepEqual(Object.keys(FACTORY_STATUS_VOCABULARIES['sf003-mock']), [
    'draft', 'specified', 'approved_for_sandbox', 'running', 'testing',
    'review_required', 'completed', 'blocked', 'failed', 'cancelled',
  ]);
});

test('all mapped states remain non-authoritative and cannot trigger effects', () => {
  for (const [lineage, states] of Object.entries(FACTORY_STATUS_VOCABULARIES)) {
    for (const status of Object.keys(states)) {
      const result = inspectFactoryStatus(lineage, fixture(lineage, status));
      assert.equal(result.originalStatus, status);
      assert.equal(result.displayPhase, states[status]);
      assert.equal(result.displayOnly, true);
      assert.equal(result.statusAuthenticated, false);
      assert.equal(result.repositoryBindingVerified, false);
      assert.equal(result.evidenceVerified, false);
      assert.equal(result.humanReviewStillRequired, true);
      assert.equal(result.canStartWorker, false);
      assert.equal(result.canCreatePullRequest, false);
      assert.equal(result.canMerge, false);
      assert.equal(result.canDeploy, false);
      assert.equal(Object.isFrozen(result), true);
    }
  }
});

test('mock completed must not be mapped to release success', () => {
  const result = inspectFactoryStatus('sf003-mock', fixture('sf003-mock', 'completed'));
  assert.equal(result.displayPhase, 'terminal_unverified');
  assert.equal(result.canDeploy, false);
});

test('spelling differences do not lose cancelled states', () => {
  assert.equal(inspectFactoryStatus('pr2346-contracts', fixture('pr2346-contracts', 'canceled')).displayPhase, 'cancelled');
  assert.equal(inspectFactoryStatus('sf006-offline', fixture('sf006-offline', 'cancelled')).displayPhase, 'cancelled');
});

test('unknown lineage and unknown status fail closed', () => {
  assert.throws(() => inspectFactoryStatus('unknown', fixture('sf006-offline', 'queued')), /factory_lineage_unknown/);
  assert.throws(() => inspectFactoryStatus('sf006-offline', fixture('sf006-offline', 'approved')), /factory_status_unknown/);
  assert.throws(() => inspectFactoryStatus('pr2346-contracts', fixture('pr2346-contracts', 'completed')), /factory_status_unknown/);
});

test('wrong repository is rejected instead of silently relabelled', () => {
  assert.throws(() => inspectFactoryStatus('sf006-offline', { ...fixture('sf006-offline', 'queued'), repository: 'other/other' }), /factory_repository_unexpected/);
});

test('accessor properties are never evaluated', () => {
  let touched = false;
  const x = fixture('sf006-offline', 'queued');
  Object.defineProperty(x, 'status', { get() { touched = true; throw new Error('malicious'); } });
  assert.throws(() => inspectFactoryStatus('sf006-offline', x), /factory_snapshot_status_missing_or_accessor/);
  assert.equal(touched, false);
});

test('invalid IDs, missing properties and null input fail closed', () => {
  assert.throws(() => inspectFactoryStatus('sf003-mock', fixture('sf003-mock', 'queued')), /factory_status_unknown/);
  assert.throws(() => inspectFactoryStatus('sf003-mock', null), /factory_snapshot_object_required/);
  assert.throws(() => inspectFactoryStatus('sf006-offline', { id: '', status: 'queued', repository: REPOSITORY }), /factory_job_id_invalid/);
  assert.throws(() => inspectFactoryStatus('sf006-offline', { id: 'x', status: 'queued' }), /factory_snapshot_repository_missing_or_accessor/);
});

test('input snapshot is not modified', () => {
  const snapshot = Object.freeze(fixture('pr2346-contracts', 'pr_ready'));
  const result = inspectFactoryStatus('pr2346-contracts', snapshot);
  assert.equal(result.displayPhase, 'human_review');
  assert.equal(snapshot.status, 'pr_ready');
});
