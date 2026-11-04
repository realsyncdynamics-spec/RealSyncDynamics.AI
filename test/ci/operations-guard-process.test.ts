// @vitest-environment node
import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';

it('Betriebs-Guards melden ohne vollstaendige Messung keine Entwarnung', () => {
  const result = spawnSync(process.execPath, [
    '--test', 'scripts/tests/operations-guard-process.test.mjs',
  ], { encoding: 'utf8', timeout: 30000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 30000);
