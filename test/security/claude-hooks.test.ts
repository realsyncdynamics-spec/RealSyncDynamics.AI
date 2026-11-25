import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bindet die Hook-Tests aus `.claude/hooks/` an `npm test` und damit an die CI.
 *
 * Ohne diese Datei liefen die Negativtests der Agenten-Leitplanken nur, wenn
 * jemand `npm run test:hooks` von Hand startet (Senior-Review 25.11.2026, #2416).
 */
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SUITES = ['guard-bash.test.mjs', 'guard-phase3d.test.mjs', 'guard-bypass.test.mjs'];

describe('Claude-Code-Hooks: Negativtests', () => {
  for (const suite of SUITES) {
    it(`${suite} ist grün`, () => {
      const r = spawnSync(process.execPath, [join(ROOT, '.claude', 'hooks', suite)], {
        cwd: ROOT,
        encoding: 'utf8',
        timeout: 60_000,
      });
      const failed = (r.stdout ?? '').split('\n').filter((l) => l.startsWith('FAIL'));
      expect(failed, failed.join('\n')).toEqual([]);
      expect(r.status, r.stderr).toBe(0);
    }, 90_000);
  }
});
