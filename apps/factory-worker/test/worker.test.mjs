import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALLOWED_STEPS, parseManifest, validateManifest, assertDetachedHead } from '../spec.mjs';

const base = {
  version: 1,
  jobId: 'SF-002',
  commitSha: 'a'.repeat(40),
  step: 'worker-self-test',
  maxDurationMs: 10000,
};

test('validates a pinned, fixed-command manifest', () => {
  assert.deepEqual(validateManifest(base), base);
  assert.equal(parseManifest(JSON.stringify(base)).step, 'worker-self-test');
});

test('rejects custom commands and any extra fields', () => {
  assert.throws(() => validateManifest({ ...base, step: 'sh -c whoami' }), /allowlist/);
  assert.throws(() => validateManifest({ ...base, args: ['--eval', 'process.exit(0)'] }), /fields/);
});

test('refuses anything except a full pinned SHA', () => {
  assert.throws(() => validateManifest({ ...base, commitSha: 'main' }), /SHA/);
  assert.throws(() => validateManifest({ ...base, commitSha: 'A'.repeat(40) }), /SHA/);
  assertDetachedHead(`${base.commitSha}\n`, base.commitSha);
  assert.throws(() => assertDetachedHead('ref: refs/heads/main', base.commitSha), /pinned commit/);
  assert.throws(() => assertDetachedHead('b'.repeat(40), base.commitSha), /pinned commit/);
});

test('bounds duration, input size and job identifier', () => {
  assert.throws(() => validateManifest({ ...base, maxDurationMs: 300001 }), /maxDurationMs/);
  assert.throws(() => validateManifest({ ...base, maxDurationMs: 0 }), /maxDurationMs/);
  assert.throws(() => validateManifest({ ...base, jobId: '../outside' }), /jobId/);
  assert.throws(() => parseManifest(' '.repeat(4097)), /size cap/);
  assert.throws(() => parseManifest('not-json'));
});

test('commands are explicit argument arrays without a shell', () => {
  assert.deepEqual(Object.keys(ALLOWED_STEPS).sort(), [
    'factory-core-test', 'project-typecheck', 'worker-self-test',
  ]);
  for (const args of Object.values(ALLOWED_STEPS)) {
    assert.ok(Array.isArray(args));
    assert.ok(args.every((arg) => !/[;&|]/.test(arg)));
  }
});
