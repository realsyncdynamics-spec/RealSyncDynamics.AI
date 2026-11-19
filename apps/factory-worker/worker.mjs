/** SF-002: read-only verification executor. MUST be started by an isolated container runtime. */
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { ALLOWED_STEPS, LIMITS, assertDetachedHead, parseManifest } from './spec.mjs';

const WORKSPACE = '/workspace';
const MANIFEST = '/input/job.json';

function safeKill(pid, signal) {
  if (!pid) return;
  try { process.kill(-pid, signal); } catch { /* process already exited */ }
}

async function execute(job) {
  const args = ALLOWED_STEPS[job.step];
  const started = performance.now();
  return new Promise((resolve) => {
    let outputBytes = 0;
    let killedBy = null;
    let settled = false;
    const out = createHash('sha256');
    const err = createHash('sha256');
    const child = spawn(process.execPath, args, {
      cwd: WORKSPACE,
      shell: false,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        PATH: '/usr/local/bin:/usr/bin:/bin',
        HOME: '/tmp',
        TMPDIR: '/tmp',
        CI: 'true',
        NO_COLOR: '1',
      },
    });
    const timeout = setTimeout(() => {
      killedBy = 'timeout';
      safeKill(child.pid, 'SIGKILL');
    }, job.maxDurationMs);
    function append(streamHash, chunk) {
      outputBytes += chunk.length;
      streamHash.update(chunk);
      if (outputBytes > LIMITS.maxOutputBytes && killedBy === null) {
        killedBy = 'output-limit';
        safeKill(child.pid, 'SIGKILL');
      }
    }
    child.stdout?.on('data', (chunk) => append(out, chunk));
    child.stderr?.on('data', (chunk) => append(err, chunk));
    child.on('error', () => {
      if (!killedBy) killedBy = 'spawn-error';
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({
        jobId: job.jobId,
        step: job.step,
        commitSha: job.commitSha,
        status: code === 0 && killedBy === null ? 'passed' : 'failed',
        exitCode: code,
        signal,
        terminationReason: killedBy,
        durationMs: Math.round(performance.now() - started),
        outputBytes,
        stdoutSha256: out.digest('hex'),
        stderrSha256: err.digest('hex'),
      });
    });
  });
}

async function main() {
  const meta = await stat(MANIFEST);
  if (!meta.isFile() || meta.size > LIMITS.maxManifestBytes) throw new Error('invalid manifest file');
  const job = parseManifest(await readFile(MANIFEST, 'utf8'));
  const head = await readFile(`${WORKSPACE}/.git/HEAD`, 'utf8');
  assertDetachedHead(head, job.commitSha);
  const result = await execute(job);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.status !== 'passed') process.exitCode = 1;
}

main().catch(() => {
  // No raw exception messages or child logs: they might contain sensitive inputs.
  process.stdout.write(`${JSON.stringify({ status: 'failed', reason: 'invalid-manifest-or-workspace' })}\n`);
  process.exitCode = 1;
});
