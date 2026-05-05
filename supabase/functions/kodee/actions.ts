// Action dispatcher: takes a typed request, returns typed data.
// All command strings here are server-controlled; user input is shell-quoted before
// concatenation. Never inline `args.*` into a command without shellQuote().

import type {
  ActionArgs, ActionName,
  StatusArgs, LogsTailArgs, DiskArgs, DnsCheckArgs, TlsCheckArgs,
  StatusData, LogsTailData, DiskData, DnsCheckData, TlsCheckData,
  ServiceRestartArgs, ComposeUpArgs, ComposeRestartArgs, WriteActionData,
  VpsConnectionRow,
} from './types.ts';
import { sshExec, shellQuote, SshError } from './ssh.ts';
import { dnsCheck, tlsCheck } from './checks.ts';

export interface ActionContext {
  conn: VpsConnectionRow;
  privateKey: string;
}

export async function dispatch(
  action: ActionName,
  args: ActionArgs | undefined,
  ctx: ActionContext,
): Promise<unknown> {
  switch (action) {
    case 'vps.status':     return await statusAction((args ?? {}) as StatusArgs, ctx);
    case 'vps.logs.tail':  return await logsTailAction((args ?? {}) as LogsTailArgs, ctx);
    case 'vps.disk':       return await diskAction((args ?? {}) as DiskArgs, ctx);
    case 'vps.dns_check':  return await dnsCheck(args as DnsCheckArgs, ctx.conn);
    case 'vps.tls_check':  return await tlsCheck((args ?? {}) as TlsCheckArgs, ctx.conn);

    case 'vps.service.restart': return await serviceRestart(args as ServiceRestartArgs, ctx);
    case 'vps.compose.up':      return await composeUp(args as ComposeUpArgs, ctx);
    case 'vps.compose.restart': return await composeRestart(args as ComposeRestartArgs, ctx);

    default:
      throw Object.assign(new SshError('UNKNOWN_ACTION', `unknown action: ${action}`));
  }
}

// ─── write actions ────────────────────────────────────────────────────────────

async function serviceRestart(args: ServiceRestartArgs, ctx: ActionContext): Promise<WriteActionData> {
  if (!args.service || typeof args.service !== 'string') {
    throw new SshError('BAD_REQUEST', 'service is required');
  }
  if (args.confirm !== args.service) {
    throw new SshError('FORBIDDEN', 'confirm must equal the service name');
  }
  if (!/^[a-zA-Z0-9._@-]+$/.test(args.service)) {
    throw new SshError('BAD_REQUEST', 'invalid service name');
  }
  const cmd = `sudo -n systemctl restart ${shellQuote(args.service)} && sudo -n systemctl is-active ${shellQuote(args.service)}`;
  return await runWrite(cmd, ctx);
}

async function composeUp(args: ComposeUpArgs, ctx: ActionContext): Promise<WriteActionData> {
  validateComposeDir(args.compose_dir);
  if (args.confirm !== 'UP') {
    throw new SshError('FORBIDDEN', 'confirm must equal "UP"');
  }
  const cmd = `cd ${shellQuote(args.compose_dir)} && (docker compose up -d 2>&1 || docker-compose up -d 2>&1)`;
  return await runWrite(cmd, ctx, { timeoutMs: 120_000 });
}

async function composeRestart(args: ComposeRestartArgs, ctx: ActionContext): Promise<WriteActionData> {
  validateComposeDir(args.compose_dir);
  if (args.confirm !== 'RESTART') {
    throw new SshError('FORBIDDEN', 'confirm must equal "RESTART"');
  }
  const svc = args.service ? ' ' + shellQuote(args.service) : '';
  const cmd = `cd ${shellQuote(args.compose_dir)} && (docker compose restart${svc} 2>&1 || docker-compose restart${svc} 2>&1)`;
  return await runWrite(cmd, ctx, { timeoutMs: 60_000 });
}

function validateComposeDir(dir: string): void {
  if (!dir || typeof dir !== 'string') throw new SshError('BAD_REQUEST', 'compose_dir is required');
  if (!dir.startsWith('/')) throw new SshError('BAD_REQUEST', 'compose_dir must be an absolute path');
  if (dir.includes('..')) throw new SshError('BAD_REQUEST', 'compose_dir must not contain ".."');
  if (!/^[\w\/.@+-]+$/.test(dir)) throw new SshError('BAD_REQUEST', 'compose_dir contains invalid characters');
}

async function runWrite(
  command: string,
  ctx: ActionContext,
  opts?: { timeoutMs?: number },
): Promise<WriteActionData> {
  const { stdout, stderr, exitCode } = await sshExec(ctx.conn, ctx.privateKey, command, opts);
  return { command, exit_code: exitCode, stdout, stderr };
}

async function statusAction(args: StatusArgs, ctx: ActionContext): Promise<StatusData> {
  const cmd = [
    'uptime',
    'echo "---MEM---"',
    'free -m | awk \'NR==2 {print $2,$3,$4}\'',
    'echo "---FAILED---"',
    'systemctl --failed --no-legend --plain 2>/dev/null | awk \'{print $1}\' || true',
  ].join(' && ');

  const { stdout } = await sshExec(ctx.conn, ctx.privateKey, cmd);
  const parts = stdout.split(/---(?:MEM|FAILED)---/);
  const uptimeLine = parts[0]?.trim() ?? '';
  const memLine = (parts[1] ?? '').trim();
  const failedBlock = (parts[2] ?? '').trim();

  // Parse `uptime`: "12:34:56 up 3 days, 4:56, 2 users, load average: 0.10, 0.20, 0.30"
  const uptimeMatch = uptimeLine.match(
    /up\s+(?:(\d+)\s+days?,\s*)?(?:(\d+):(\d+)|(\d+)\s+min)/,
  );
  const days = uptimeMatch?.[1] ? parseInt(uptimeMatch[1], 10) : 0;
  const hours = uptimeMatch?.[2] ? parseInt(uptimeMatch[2], 10) : 0;
  const minutes = uptimeMatch?.[3]
    ? parseInt(uptimeMatch[3], 10)
    : uptimeMatch?.[4]
    ? parseInt(uptimeMatch[4], 10)
    : 0;
  const loadMatch = uptimeLine.match(/load average[s]?:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  const load: [number, number, number] = loadMatch
    ? [parseFloat(loadMatch[1]), parseFloat(loadMatch[2]), parseFloat(loadMatch[3])]
    : [0, 0, 0];

  const [totalStr, usedStr, freeStr] = memLine.split(/\s+/);
  const memory_mb = {
    total: parseInt(totalStr ?? '0', 10) || 0,
    used: parseInt(usedStr ?? '0', 10) || 0,
    free: parseInt(freeStr ?? '0', 10) || 0,
  };

  let failed_units = failedBlock ? failedBlock.split('\n').map((s) => s.trim()).filter(Boolean) : [];
  if (args.units?.length) {
    // Intersect with the requested set if caller specified units of interest.
    const requested = new Set(args.units);
    failed_units = failed_units.filter((u) => requested.has(u));
  }

  return { uptime: { days, hours, minutes, load }, memory_mb, failed_units };
}

async function logsTailAction(args: LogsTailArgs, ctx: ActionContext): Promise<LogsTailData> {
  if (args.unit && args.container) {
    throw new SshError('BAD_REQUEST', 'specify either unit or container, not both');
  }
  const lines = clamp(args.lines ?? 100, 1, 1000);

  let cmd: string;
  let source: 'journalctl' | 'docker';
  let target: string | null;

  if (args.container) {
    source = 'docker';
    target = args.container;
    cmd = `docker logs --tail ${lines} ${shellQuote(args.container)} 2>&1`;
  } else if (args.unit) {
    source = 'journalctl';
    target = args.unit;
    cmd = `journalctl -u ${shellQuote(args.unit)} -n ${lines} --no-pager`;
  } else {
    source = 'journalctl';
    target = null;
    cmd = `journalctl -n ${lines} --no-pager`;
  }

  if (args.grep) {
    cmd += ` | grep -E ${shellQuote(args.grep)} || true`;
  }

  const { stdout } = await sshExec(ctx.conn, ctx.privateKey, cmd, { timeoutMs: 20_000 });
  return { source, target, lines: stdout.split('\n').filter(Boolean) };
}

async function diskAction(args: DiskArgs, ctx: ActionContext): Promise<DiskData> {
  const dfCmd =
    `df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs -x squashfs | tail -n +2`;
  const { stdout: dfOut } = await sshExec(ctx.conn, ctx.privateKey, dfCmd);

  const filesystems = dfOut
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [source, size, used, avail, use_pct, mount] = line.trim().split(/\s+/);
      return { source, size, used, avail, use_pct, mount };
    });

  const top = clamp(args.top_dirs ?? 0, 0, 50);
  let top_dirs: DiskData['top_dirs'];
  if (top > 0) {
    const duCmd =
      `du -xh --max-depth=2 / 2>/dev/null | sort -hr | head -n ${top}`;
    const { stdout } = await sshExec(ctx.conn, ctx.privateKey, duCmd, { timeoutMs: 30_000 });
    top_dirs = stdout.split('\n').filter(Boolean).map((l) => {
      const [size, ...rest] = l.trim().split(/\s+/);
      return { size, path: rest.join(' ') };
    });
  }

  return { filesystems, top_dirs };
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.floor(n)));
}
