import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(__dirname, '../../src/features/app-builder');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name.name)) out.push(p);
  }
  return out;
}

describe('production path — no preview-harness-only core', () => {
  const files = walk(ROOT);
  const joined = files.map((f) => `${f}\n${readFileSync(f, 'utf8')}`).join('\n\n');

  it('does not call xAI / OpenAI / Anthropic from the browser builder', () => {
    expect(joined).not.toMatch(/api\.x\.ai/);
    expect(joined).not.toMatch(/api\.openai\.com/);
    expect(joined).not.toMatch(/api\.anthropic\.com/);
    expect(joined).not.toMatch(/XAI_API_KEY/);
    expect(joined).not.toMatch(/VITE_OPENAI/);
    expect(joined).not.toMatch(/VITE_ANTHROPIC/);
    expect(joined).not.toMatch(/VITE_XAI/);
  });

  it('streams only through RealSync AI Gateway with feature app_builder_code', () => {
    const gateway = readFileSync(join(ROOT, 'gateway.ts'), 'utf8');
    expect(gateway).toMatch(/processAIGatewayStream/);
    expect(gateway).toMatch(/feature:\s*'app_builder_code'/);
    expect(gateway).toMatch(/packBuilderPrompt|packProjectContext/);
    const workbench = readFileSync(join(ROOT, 'BoltWorkbench.tsx'), 'utf8');
    expect(workbench).toMatch(/generateViaRealSyncGatewayStream/);
    expect(workbench).not.toMatch(/generateViaRealSyncGateway[^S]/);
  });

  it('persists through siteos/code-persist, not siteos_blueprints', () => {
    const workbench = readFileSync(join(ROOT, 'BoltWorkbench.tsx'), 'utf8');
    expect(workbench).toMatch(/saveBuilderProject/);
    expect(workbench).toMatch(/listBuilderProjects/);
    expect(workbench).toMatch(/loadBuilderProject/);
    expect(workbench).not.toMatch(/siteos_blueprints/);
    expect(workbench).not.toMatch(/editSite\(/);
  });
});
