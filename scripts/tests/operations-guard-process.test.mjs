import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'operations-guard-test-'));
test.after(() => rmSync(scratch, { recursive: true, force: true }));
// Never contact Supabase or a local database. Child processes receive only fake
// credentials, an isolated PATH and a fetch implementation that rejects excess calls.
writeFileSync(join(scratch, 'supabase'), '#!/bin/sh\nif [ "$GUARD_TEST_CLI_FAILURE" = "1" ]; then exit 1; fi\nprintf "%s\\n" "$GUARD_TEST_CLI_OUTPUT"\n', { mode: 0o755 });
writeFileSync(join(scratch, 'psql'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });

function run(script, { replies = [], credentials = true, env = {} } = {}) {
  const preload = `
    const replies = ${JSON.stringify(replies)};
    globalThis.fetch = async () => {
      const reply = replies.shift();
      if (!reply || reply.throw) throw new Error('mock network unavailable');
      return { ok: reply.status >= 200 && reply.status < 300, status: reply.status,
        text: async () => 'mock database unavailable',
        json: async () => { if (reply.invalidJson) throw new Error('mock invalid JSON'); return reply.body; } };
    };
  `;
  const child = spawnSync(process.execPath, [
    '--import', `data:text/javascript,${encodeURIComponent(preload)}`,
    resolve(root, script),
  ], {
    cwd: root,
    env: {
      PATH: scratch,
      ...(credentials ? { SUPABASE_ACCESS_TOKEN: 'test-token', SUPABASE_PROJECT_ID: 'test-project' } : {}),
      ...env,
    },
    encoding: 'utf8', timeout: 10000,
  });
  assert.ifError(child.error);
  assert.equal(child.signal, null, child.stderr);
  return { code: child.status, output: child.stdout + child.stderr };
}

const cron = 'scripts/check-cron-health.mjs';
const migrations = 'scripts/check-migration-drift.mjs';
const acl = 'scripts/check-function-acl-drift.mjs';
const entitlements = 'scripts/check-entitlement-parity.mjs';
const healthyJobs = [{ name: 'hourly', active: true, schedule: '0 * * * *',
  last_status: 'succeeded', last_run: new Date().toISOString(), fehler: 0, erfolge: 1 }];
const responseRows = [{ art: 'dispatch', anzahl: 1 }, { art: 'antwort', status: '200', anzahl: 1 }];
const ok = body => ({ status: 200, body });

for (const script of [cron, migrations, acl, entitlements]) {
  test(`${script}: missing access must not report success`, () => {
    assert.equal(run(script, { credentials: false }).code, 1);
  });
}
for (const [script, mode] of [[cron, 'CRON_HEALTH_MODE'], [migrations, 'MIGRATION_DRIFT_MODE'], [acl, 'FUNCTION_ACL_DRIFT_MODE']]) {
  test(`${script}: explicit PR advisory can skip missing access`, () => {
    assert.equal(run(script, { credentials: false, env: { [mode]: 'advisory' } }).code, 0);
  });
}
for (const script of [cron, acl, entitlements]) {
  for (const reply of [{ status: 400 }, { throw: true }, { status: 200, invalidJson: true }]) {
    test(`${script}: unavailable/invalid API (${JSON.stringify(reply)}) is not recovery`, () => {
      assert.equal(run(script, { replies: [reply] }).code, 1);
    });
  }
}
test('cron: complete successful measurement remains green', () => {
  assert.equal(run(cron, { replies: [ok(healthyJobs), ok(responseRows)] }).code, 0);
});
for (const reply of [{ status: 400 }, ok(null), ok([]), ok([{ art: 'dispatch', anzahl: 0 }])]) {
  test(`cron: missing response evidence (${JSON.stringify(reply)}) prevents recovery`, () => {
    const result = run(cron, { replies: [ok(healthyJobs), reply] });
    assert.equal(result.code, 1, result.output);
    assert.doesNotMatch(result.output, /✅ Jeder aktive Job/);
  });
}
test('cron: failed function response remains a failure', () => {
  assert.equal(run(cron, { replies: [ok(healthyJobs), ok([
    { art: 'dispatch', anzahl: 1 }, { art: 'antwort', status: '401', anzahl: 1 },
  ])] }).code, 1);
});
test('cron: empty job set prevents recovery', () => {
  assert.equal(run(cron, { replies: [ok([]), ok(responseRows)] }).code, 1);
});
test('migration CLI failure prevents recovery', () => {
  assert.equal(run(migrations, { env: { GUARD_TEST_CLI_FAILURE: '1' } }).code, 1);
});
test('migration parser failure prevents recovery', () => {
  assert.equal(run(migrations, { env: { GUARD_TEST_CLI_OUTPUT: 'unrecognized output' } }).code, 1);
});
test('migration complete successful measurement remains green', () => {
  const versions = readdirSync(resolve(root, 'supabase/migrations')).filter(f => f.endsWith('.sql')).map(f => f.split('_')[0].replace(/\.sql$/, ''));
  const result = run(migrations, { env: { GUARD_TEST_CLI_OUTPUT: versions.map(v => `${v} | ${v} | applied`).join('\n') } });
  assert.equal(result.code, 0, result.output);
});
