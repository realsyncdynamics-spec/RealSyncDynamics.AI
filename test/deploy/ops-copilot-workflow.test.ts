// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Bindet den Regressionstest des n8n-Workflows „Operations Copilot“ in
 * `npm test` und damit in die CI ein. Die Testdatei selbst bleibt neben dem
 * Workflow-Export (`node:test`, ohne Abhängigkeiten), damit sie auch ohne
 * Repo-Toolchain direkt neben einer n8n-Instanz laufen kann.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TEST_FILE = join(
  ROOT,
  'deploy',
  'ollama-traefik',
  'n8n-workflows',
  'operations-copilot',
  'test',
  'operations-copilot-workflow.test.cjs',
);

function runNodeTest(): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, ['--test', '--test-reporter=tap', TEST_FILE], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

describe('n8n Operations Copilot (Workflow 06)', () => {
  it('besteht alle node:test-Fälle des Workflow-Exports', () => {
    const { code, out } = runNodeTest();
    expect(code, out).toBe(0);
    expect(out).toMatch(/^# fail 0$/m);
    // Schutz gegen einen Lauf, der still keine Tests findet.
    const total = Number(/^# tests (\d+)$/m.exec(out)?.[1] ?? 0);
    expect(total).toBeGreaterThanOrEqual(17);
  }, 60_000);
});
