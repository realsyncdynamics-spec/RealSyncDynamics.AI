/** SF-003: in-memory patch review. No filesystem, subprocess or git writes. */
import { DEMO_SCOPE, handoffDigest, sha256 } from './bridge.mjs';

const SHA256 = /^[0-9a-f]{64}$/;
const MAX_NEW_BYTES = 16384;
const MAX_PATCH_BYTES = 65536;

function validDemoPath(path) {
  if (typeof path !== 'string' || !path.startsWith(DEMO_SCOPE) || path.length > 160 ||
      path.includes('\\') || path.includes('\0')) return false;
  const parts = path.split('/');
  return parts.every((part, index) => (index === parts.length - 1 || part !== '') &&
    part !== '.' && part !== '..' && (part === '' || /^[A-Za-z0-9._-]+$/.test(part))) &&
    parts[parts.length - 1].endsWith('.js');
}
function emitFileDiff(path, before, after) {
  function lines(text) {
    if (text === '') return [];
    const arr = text.split('\n');
    if (arr.at(-1) === '') arr.pop();
    return arr;
  }
  const oldLines = lines(before);
  const newLines = lines(after);
  return [
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -${oldLines.length ? 1 : 0},${oldLines.length} +${newLines.length ? 1 : 0},${newLines.length} @@`,
    ...oldLines.map((line) => `-${line}`),
    ...newLines.map((line) => `+${line}`),
    '',
  ].join('\n');
}

/**
 * Strictly verifies agent's proposed edits against immutable source snapshots.
 * A future trusted host MUST recheck the actual checkout and apply separately.
 */
export function prepareReview(handoff, proposal, sourceSnapshots) {
  if (handoff?.mode !== 'offline-review-only' || handoff?.editablePrefix !== DEMO_SCOPE ||
      handoff?.constraints?.mustReviewBeforeApply !== true ||
      handoff?.constraints?.gitWritesEnabled !== false) throw new Error('factory_untrusted_handoff');
  if (proposal === null || typeof proposal !== 'object' || Array.isArray(proposal) ||
      Object.keys(proposal).sort().join('|') !== 'changes|handoffSha256|jobId|schemaVersion') {
    throw new Error('factory_proposal_shape_invalid');
  }
  if (proposal.schemaVersion !== 1 || proposal.jobId !== handoff.jobId ||
      proposal.handoffSha256 !== handoffDigest(handoff)) throw new Error('factory_proposal_binding_invalid');
  if (!Array.isArray(proposal.changes) || proposal.changes.length < 1 || proposal.changes.length > 3) {
    throw new Error('factory_change_count_invalid');
  }
  if (sourceSnapshots === null || typeof sourceSnapshots !== 'object' || Array.isArray(sourceSnapshots)) {
    throw new Error('factory_snapshots_missing');
  }
  const seen = new Set();
  let patch = '';
  const files = [];
  for (const change of proposal.changes) {
    if (change === null || typeof change !== 'object' || Array.isArray(change) ||
        Object.keys(change).sort().join('|') !== 'baseSha256|newContent|path') throw new Error('factory_change_shape_invalid');
    if (!validDemoPath(change.path) || seen.has(change.path)) throw new Error('factory_change_path_invalid');
    seen.add(change.path);
    if (!Object.hasOwn(sourceSnapshots, change.path) || typeof sourceSnapshots[change.path] !== 'string') {
      throw new Error('factory_snapshot_not_found');
    }
    const oldContent = sourceSnapshots[change.path];
    if (typeof change.baseSha256 !== 'string' || !SHA256.test(change.baseSha256) ||
        sha256(oldContent) !== change.baseSha256) throw new Error('factory_stale_snapshot');
    if (typeof change.newContent !== 'string' || Buffer.byteLength(change.newContent, 'utf8') > MAX_NEW_BYTES ||
        change.newContent.includes('\0') || change.newContent === oldContent) throw new Error('factory_new_content_invalid');
    patch += emitFileDiff(change.path, oldContent, change.newContent);
    files.push(Object.freeze({ path: change.path, beforeSha256: change.baseSha256, afterSha256: sha256(change.newContent) }));
  }
  if (Buffer.byteLength(patch, 'utf8') > MAX_PATCH_BYTES) throw new Error('factory_patch_too_large');
  return Object.freeze({
    status: 'review_required',
    jobId: handoff.jobId,
    baseCommitSha: handoff.baseCommitSha,
    source: 'untrusted_agent_proposal',
    handoffSha256: proposal.handoffSha256,
    patchSha256: sha256(patch),
    fileChanges: files,
    patch,
    testsRun: false,
    filesWritten: false,
    pullRequestCreated: false,
    deploymentPerformed: false,
  });
}
