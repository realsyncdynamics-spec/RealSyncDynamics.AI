/**
 * SF-002 offline REA static analysis: deterministic container invocation only.
 * This plan is NOT an execution authorization or live MCP connection.
 */
import { lstatSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, sep } from 'node:path';
import { authorizeFactoryAction } from '../../../packages/factory-core/src/policy';
import type { FactoryJob, TrustedActor } from '../../../packages/factory-core/src/contracts';

export interface ReaPlanInput {
  readonly job: FactoryJob;
  readonly actor: TrustedActor;
  readonly approvedRoot: string;
  readonly inputDirectory: string;
  readonly imageDigest: string;
  readonly nonce: string;
}
export interface ReaDockerPlan {
  readonly executable: 'docker';
  readonly args: readonly string[];
  readonly containerName: string;
  readonly inputDirectory: string;
  readonly imageDigest: string;
}
const IMAGE = /^realsync\/factory-rea@sha256:[a-f0-9]{64}$/;
const JOB = /^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/;
const NONCE = /^[a-f0-9]{12}$/;
function fail(code: string): never { throw new Error(`factory_${code}`); }

export function makeReaStaticJsPlan(input: ReaPlanInput): ReaDockerPlan {
  const { job, actor } = input;
  if (!JOB.test(job.id)) fail('invalid_job_id');
  if (!NONCE.test(input.nonce)) fail('invalid_nonce');
  if (!IMAGE.test(input.imageDigest)) fail('image_digest_required');
  const d = authorizeFactoryAction(actor, job, 'sandbox.tests.run');
  if (!d.allow) fail(d.reason);
  if (!isAbsolute(input.approvedRoot) || !isAbsolute(input.inputDirectory)) fail('absolute_paths_required');
  if (lstatSync(input.approvedRoot).isSymbolicLink()) fail('root_symlink_denied');
  if (!lstatSync(input.approvedRoot).isDirectory()) fail('root_not_directory');
  const root = realpathSync(input.approvedRoot);
  const target = realpathSync(input.inputDirectory);
  const rel = relative(root, target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) fail('outside_approved_root');
  if (!lstatSync(target).isDirectory()) fail('input_not_directory');
  if (!/^\/[A-Za-z0-9/_\.\-]+$/.test(target)) fail('mount_path_not_safe');
  const containerName = `rsd-factory-${job.id.toLowerCase()}-${input.nonce}`;
  const args = [
    'run', '--rm', '--pull=never', '--name', containerName,
    '--network=none', '--read-only', '--cap-drop=ALL',
    '--security-opt=no-new-privileges', '--user=65534:65534',
    '--pids-limit=64', '--memory=512m', '--cpus=1', '--ipc=none',
    '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=64m',
    '--env=HOME=/tmp', '--env=XDG_CACHE_HOME=/tmp',
    '--mount', `type=bind,src=${target},dst=/workspace/input,readonly`,
    '--workdir=/workspace', input.imageDigest,
    'rea', 'analyze-javascript-application', '/workspace/input', '--json',
  ] as const;
  return { executable: 'docker', args, containerName, inputDirectory: target, imageDigest: input.imageDigest };
}

/** Static stdio descriptor. Interactive MCP calls are NOT enabled in SF-002. */
export function reaMcpStdioDescriptor() {
  return { transport: 'stdio', command: 'rea', args: ['mcp'] } as const;
}
