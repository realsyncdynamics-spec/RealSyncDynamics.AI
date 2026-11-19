/**
 * Optional local launcher on a dedicated trusted worker host, NOT a web API.
 * Rootless isolated Docker and separate server-side authentication are required.
 * Importing this module never executes Docker.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import type { FactoryJob, TrustedActor } from '../../../packages/factory-core/src/contracts';
import { makeReaStaticJsPlan } from './rea-plan';
import { parseReaCliEvidence, type ReaEvidenceReceipt } from './rea-evidence';

export interface LocalWorkerConfig {
  readonly approvedRoot: string;
  readonly inputDirectory: string;
  readonly imageDigest: string;
  readonly timeoutMs: number;
}

function runDocker(args: readonly string[], timeoutMs: number, containerName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { PATH: process.env.PATH || '/usr/bin:/bin' } });
    const stdout: Buffer[] = [];
    let size = 0;
    let failed = false;
    let stderr = '';
    const cleanup = () => {
      // Killing the Docker CLI does not necessarily stop the container.
      const remover = spawn('docker', ['rm', '--force', containerName], {
        stdio: 'ignore', env: { PATH: process.env.PATH || '/usr/bin:/bin' },
      });
      remover.on('error', () => {});
    };
    const timeout = setTimeout(() => { failed = true; child.kill('SIGKILL'); cleanup(); }, timeoutMs);
    child.stdout.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2_097_152) { failed = true; child.kill('SIGKILL'); cleanup(); return; }
      stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-4096); });
    child.on('error', (e) => { failed = true; clearTimeout(timeout); reject(new Error(`factory_docker_launch_failed: ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (failed || code !== 0) { cleanup(); reject(new Error(`factory_docker_failed: code=${code}; output_bytes=${size}; diagnostic=${stderr.slice(-256)}`)); return; }
      resolve(Buffer.concat(stdout).toString('utf8'));
    });
  });
}

/** Caller must already be a separately authenticated, approved worker service. */
export async function runReaStaticJs(
  job: FactoryJob, actor: TrustedActor, config: LocalWorkerConfig,
): Promise<ReaEvidenceReceipt> {
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1000 || config.timeoutMs > 120_000) {
    throw new Error('factory_timeout_invalid');
  }
  const plan = makeReaStaticJsPlan({
    job, actor, ...config, nonce: randomBytes(6).toString('hex'),
  });
  return parseReaCliEvidence(await runDocker(plan.args, config.timeoutMs, plan.containerName));
}
