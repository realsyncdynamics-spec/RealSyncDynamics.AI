/** SF-002: strict, dependency-free job manifest parser. Not authorization. */
export const ALLOWED_STEPS = Object.freeze({
  'worker-self-test': Object.freeze(['--test', 'apps/factory-worker/test/worker.test.mjs']),
  'factory-core-test': Object.freeze(['node_modules/vitest/vitest.mjs', 'run', 'test/factory/state-machine.test.ts']),
  'project-typecheck': Object.freeze(['node_modules/typescript/lib/tsc.js', '--noEmit']),
});

export const LIMITS = Object.freeze({
  maxManifestBytes: 4096,
  minDurationMs: 1000,
  maxDurationMs: 300000,
  maxOutputBytes: 262144,
});

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

export function validateManifest(value) {
  if (!isPlainRecord(value)) throw new Error('manifest must be an object');
  const expected = ['version', 'jobId', 'commitSha', 'step', 'maxDurationMs'];
  if (Object.keys(value).sort().join(',') !== [...expected].sort().join(',')) {
    throw new Error('manifest fields differ from allowlist');
  }
  if (value.version !== 1) throw new Error('unsupported manifest version');
  if (typeof value.jobId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value.jobId)) {
    throw new Error('invalid jobId');
  }
  if (typeof value.commitSha !== 'string' || !/^[0-9a-f]{40}$/.test(value.commitSha)) {
    throw new Error('commitSha must be a lowercase full SHA');
  }
  if (typeof value.step !== 'string' || !Object.hasOwn(ALLOWED_STEPS, value.step)) {
    throw new Error('step is not on the fixed allowlist');
  }
  if (!Number.isSafeInteger(value.maxDurationMs) || value.maxDurationMs < LIMITS.minDurationMs || value.maxDurationMs > LIMITS.maxDurationMs) {
    throw new Error('invalid maxDurationMs');
  }
  return Object.freeze({ ...value });
}

export function parseManifest(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > LIMITS.maxManifestBytes) {
    throw new Error('manifest exceeds size cap');
  }
  return validateManifest(JSON.parse(text));
}

export function assertDetachedHead(headText, expectedSha) {
  if (typeof headText !== 'string' || headText.trim() !== expectedSha) {
    throw new Error('workspace checkout does not match pinned commit SHA');
  }
}
