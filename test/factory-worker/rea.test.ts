import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FactoryJob, TrustedActor } from '../../packages/factory-core/src/contracts';
import { makeReaStaticJsPlan, reaMcpStdioDescriptor } from '../../apps/factory-worker/src/rea-plan';
import { parseReaCliEvidence } from '../../apps/factory-worker/src/rea-evidence';
import { runReaStaticJs } from '../../apps/factory-worker/src/docker-executor';

const worker: TrustedActor = { kind: 'worker', id: 'w-1', isOperator: false, aal: null };
const job = (status: FactoryJob['status'] = 'running'): FactoryJob => ({
  id: 'SF-002-DEMO', repository: 'realsyncdynamics-spec/RealSyncDynamics.AI',
  branch: 'sf-002-demo', status, scopeApproved: true,
  budget: { maxCostEur: 10, spentCostEur: 0, maxAttempts: 3, attempts: 0 },
  version: 1, history: [],
});
const roots: string[] = [];
const IMAGE = `realsync/factory-rea@sha256:${'a'.repeat(64)}`;
function fixture() {
  const approvedRoot = mkdtempSync(join(tmpdir(), 'factorytest-'));
  const inputDirectory = join(approvedRoot, 'input');
  mkdirSync(inputDirectory);
  roots.push(approvedRoot);
  return { job: job(), actor: worker, approvedRoot, inputDirectory, imageDigest: IMAGE, nonce: 'a'.repeat(12) };
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('SF-002 static REA Docker planner', () => {
  it('plans only offline read-only analysis, with a pinned image and no Docker socket', () => {
    const p = makeReaStaticJsPlan(fixture());
    expect(p.executable).toBe('docker');
    expect(p.args).toContain('--network=none');
    expect(p.args).toContain('--read-only');
    expect(p.args).toContain('--cap-drop=ALL');
    expect(p.args).toContain('--pull=never');
    expect(p.args).toContain(IMAGE);
    expect(p.args).toContain('analyze-javascript-application');
    expect(p.args.join(' ')).not.toContain('docker.sock');
    expect(p.args.join(' ')).not.toContain('--privileged');
  });
  it('rejects an unpinned image', () => {
    expect(() => makeReaStaticJsPlan({ ...fixture(), imageDigest: 'rea-agents:latest' }))
      .toThrowError('factory_image_digest_required');
  });
  it('rejects unauthorized jobs and attempts to bypass worker scope', () => {
    expect(() => makeReaStaticJsPlan({ ...fixture(), job: { ...job(), scopeApproved: false } }))
      .toThrowError('factory_worker_job_not_authorized');
    expect(() => makeReaStaticJsPlan({ ...fixture(), job: { ...job(), status: 'paused' } }))
      .toThrowError('factory_worker_job_not_authorized');
  });
  it('rejects input outside the approved root', () => {
    const f = fixture();
    const other = fixture();
    expect(() => makeReaStaticJsPlan({ ...f, inputDirectory: other.inputDirectory }))
      .toThrowError('factory_outside_approved_root');
  });
  it('rejects a symlinked approval root', () => {
    const f = fixture();
    const link = join(f.approvedRoot, 'link');
    symlinkSync(f.approvedRoot, link, 'dir');
    expect(() => makeReaStaticJsPlan({ ...f, approvedRoot: link }))
      .toThrowError('factory_root_symlink_denied');
  });
  it('provides only an MCP stdio descriptor (not a live connection)', () => {
    expect(reaMcpStdioDescriptor()).toEqual({ transport: 'stdio', command: 'rea', args: ['mcp'] });
  });
});

describe('SF-002 receipt parsing', () => {
  it('parses and hashes real JSON, without asserting that it is true', () => {
    const receipt = parseReaCliEvidence('{"modules":[{"name":"demo.js"}]}');
    expect(receipt.origin).toBe('rea-static-js-cli');
    expect(receipt.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.limitations).toHaveLength(3);
  });
  it('rejects corrupt, empty and oversized outputs', () => {
    expect(() => parseReaCliEvidence('')).toThrowError('factory_evidence_size_invalid');
    expect(() => parseReaCliEvidence('not json')).toThrowError('factory_evidence_not_json');
    expect(() => parseReaCliEvidence('[]')).toThrowError('factory_evidence_not_object');
    expect(() => parseReaCliEvidence('x'.repeat(2_097_153))).toThrowError('factory_evidence_size_invalid');
  });
  it('rejects invalid timeouts before starting Docker', async () => {
    const f = fixture();
    await expect(runReaStaticJs(job(), worker, {
      approvedRoot: f.approvedRoot, inputDirectory: f.inputDirectory,
      imageDigest: IMAGE, timeoutMs: 0,
    })).rejects.toThrowError('factory_timeout_invalid');
  });
});
