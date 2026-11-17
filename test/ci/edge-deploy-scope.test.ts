/** P0 regression tests for the production Edge Function deploy planner. */
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { planEdgeDeploy, parseGitNameStatus } from '../../scripts/ops/plan-edge-deploy.mjs';
import { requireExistingActiveFunctions } from '../../scripts/ops/check-live-edge-scope.mjs';

const workspaces: string[] = [];
function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'rsd-edge-plan-'));
  workspaces.push(root);
  return root;
}
function file(root: string, path: string, content: string) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
const touched = (path: string, status = 'M') => [{ path, status }];
const requireWorkflow = () => readFileSync('.github/workflows/deploy.yml', 'utf8');

afterEach(() => {
  for (const root of workspaces.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('P0: bounded Edge Function deployments', () => {
  it('selects only a directly edited function', () => {
    const root = workspace();
    file(root, 'supabase/functions/foo/index.ts', 'export const foo = 1;');
    file(root, 'supabase/functions/bar/index.ts', 'export const bar = 1;');
    expect(planEdgeDeploy({ root, changes: touched('supabase/functions/foo/index.ts') })).toEqual(['foo']);
  });

  it('selects transitive static importers of _shared, not unrelated functions', () => {
    const root = workspace();
    file(root, 'supabase/functions/_shared/auth.ts', 'export const auth = 1;');
    file(root, 'supabase/functions/_shared/other.ts', 'export const other = 1;');
    file(root, 'supabase/functions/foo/index.ts', "import './logic.ts';");
    file(root, 'supabase/functions/foo/logic.ts', "import { auth } from '../_shared/auth.ts';");
    file(root, 'supabase/functions/bar/index.ts', "import { other } from '../_shared/other.ts';");
    expect(planEdgeDeploy({ root, changes: touched('supabase/functions/_shared/auth.ts') })).toEqual(['foo']);
  });

  it('follows re-exported shared modules', () => {
    const root = workspace();
    file(root, 'supabase/functions/_shared/auth.ts', 'export const auth = 1;');
    file(root, 'supabase/functions/_shared/bridge.ts', "export { auth } from './auth.ts';");
    file(root, 'supabase/functions/foo/index.ts', "import { auth } from '../_shared/bridge.ts';");
    expect(planEdgeDeploy({ root, changes: touched('supabase/functions/_shared/auth.ts') })).toEqual(['foo']);
  });

  it('blocks unknown shared impact instead of incorrectly reporting success', () => {
    const root = workspace();
    file(root, 'supabase/functions/_shared/mystery.ts', 'export const v = 1;');
    file(root, 'supabase/functions/foo/index.ts', 'export const foo = 1;');
    expect(() => planEdgeDeploy({ root, changes: touched('supabase/functions/_shared/mystery.ts') }))
      .toThrow(/Cannot determine importers/);
  });

  it('blocks unknown computed imports when a shared helper changes', () => {
    const root = workspace();
    file(root, 'supabase/functions/_shared/auth.ts', 'export const auth = 1;');
    file(root, 'supabase/functions/foo/index.ts', "import '../_shared/auth.ts';");
    file(root, 'supabase/functions/bar/index.ts', "const name = './other.ts'; await import(name);");
    expect(() => planEdgeDeploy({ root, changes: touched('supabase/functions/_shared/auth.ts') }))
      .toThrow(/Dynamic module import/);
  });

  it('deploy workflow delegates to the bounded planner rather than redeploy-all', () => {
    const workflow = requireWorkflow();
    expect(workflow).toContain('node scripts/ops/plan-edge-deploy.mjs HEAD^ HEAD');
    expect(workflow).not.toContain('deploy_all=true');
    expect(workflow).toContain('REQUESTED_FUNCTIONS');
    expect(workflow).toContain('node scripts/ops/check-live-edge-scope.mjs');
    expect(workflow).toContain('supabase functions list --project-ref');
  });

  it('blocks automatic mass redeployment', () => {
    const root = workspace();
    file(root, 'supabase/functions/_shared/auth.ts', 'export const auth = 1;');
    for (let i = 0; i < 15; i++) {
      file(root, 'supabase/functions/consumer-' + i + '/index.ts', "import '../_shared/auth.ts';");
    }
    expect(() => planEdgeDeploy({ root, changes: touched('supabase/functions/_shared/auth.ts') }))
      .toThrow(/Affected scope contains 15 functions, limit 12/);
  });

  it('preflights a previously deployed ACTIVE function without changing live state', () => {
    expect(requireExistingActiveFunctions(['foo', 'bar'], [
      { slug: 'foo', status: 'ACTIVE' },
      { slug: 'bar', status: 'ACTIVE' },
      { slug: 'unused', status: 'ACTIVE' },
    ])).toBe(2);
  });

  it('blocks a new slot that exists only in GitHub (P0 function.max_count)', () => {
    expect(() => requireExistingActiveFunctions(['workspace-approvals'], [
      { slug: 'foo', status: 'ACTIVE' },
    ])).toThrow(/workspace-approvals is NOT_DEPLOYED/);
  });

  it('blocks inactive functions and incomplete live inventory', () => {
    expect(() => requireExistingActiveFunctions(['foo'], [{ slug: 'foo', status: 'FAILED' }]))
      .toThrow(/foo is FAILED/);
    expect(() => requireExistingActiveFunctions(['foo'], [{ slug: 'foo' }]))
      .toThrow(/Incomplete live function inventory/);
    expect(() => requireExistingActiveFunctions(['foo'], {}))
      .toThrow(/Invalid Supabase function-list response/);
  });

  it('blocks a new production function slot without approval', () => {
    const root = workspace();
    file(root, 'supabase/functions/new-function/index.ts', 'export const v = 1;');
    expect(() => planEdgeDeploy({
      root, changes: touched('supabase/functions/new-function/index.ts', 'A'),
    })).toThrow(/approved production slot/);
  });

  it('blocks unreviewed auth and public webhook configuration changes', () => {
    const root = workspace();
    file(root, 'supabase/functions/foo/index.ts', 'export const v = 1;');
    expect(() => planEdgeDeploy({ root, changes: touched('supabase/config.toml') }))
      .toThrow(/individually reviewed deployment plan/);
  });

  it('blocks unplanned removal of a function entrypoint', () => {
    const root = workspace();
    expect(() => planEdgeDeploy({ root, changes: touched('supabase/functions/old/index.ts', 'D') }))
      .toThrow(/manual retire\/dependency review/);
  });

  it('rejects unknown diff statuses rather than silently skipping edits', () => {
    expect(parseGitNameStatus('M\tsupabase/functions/foo/index.ts\n')).toEqual([
      { status: 'M', path: 'supabase/functions/foo/index.ts' },
    ]);
    expect(() => parseGitNameStatus('R100\told.ts\tnew.ts')).toThrow(/Unsupported git change status/);
  });
});
