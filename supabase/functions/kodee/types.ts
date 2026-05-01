// Public API contract for the Kodee VPS server-actions edge function.
// Versioned via the `v` field; bump when breaking changes are introduced.

export const API_VERSION = 1 as const;

export type ActionName =
  | 'vps.status'
  | 'vps.logs.tail'
  | 'vps.disk'
  | 'vps.dns_check'
  | 'vps.tls_check'
  // v2 — write actions, require an explicit confirm token.
  | 'vps.service.restart'
  | 'vps.compose.up'
  | 'vps.compose.restart';

/** Write actions that mutate VPS state. They must include a matching `confirm` token. */
export const WRITE_ACTIONS: readonly ActionName[] = [
  'vps.service.restart',
  'vps.compose.up',
  'vps.compose.restart',
] as const;

export function isWriteAction(a: ActionName): boolean {
  return (WRITE_ACTIONS as readonly string[]).includes(a);
}

export interface KodeeRequest {
  v?: number;
  connection_id: string;
  action: ActionName;
  args?: ActionArgs;
}

export type ActionArgs =
  | StatusArgs
  | LogsTailArgs
  | DiskArgs
  | DnsCheckArgs
  | TlsCheckArgs
  | ServiceRestartArgs
  | ComposeUpArgs
  | ComposeRestartArgs;

export interface ServiceRestartArgs {
  /** systemd unit, e.g. "nginx" or "myapp.service" */
  service: string;
  /** Must match the service name to confirm intent. */
  confirm: string;
}

export interface ComposeUpArgs {
  /** absolute path to the directory holding docker-compose.yml */
  compose_dir: string;
  /** Must equal "UP" to confirm intent. */
  confirm: string;
}

export interface ComposeRestartArgs {
  compose_dir: string;
  /** Optional service name in the compose file; restarts all if omitted. */
  service?: string;
  /** Must equal "RESTART" to confirm intent. */
  confirm: string;
}

export interface StatusArgs {
  /** Optional: list of systemd units whose `is-failed` should be checked. */
  units?: string[];
}

export interface LogsTailArgs {
  /** systemd unit name, e.g. "nginx" or "myapp.service" */
  unit?: string;
  /** Docker container name or ID; mutually exclusive with `unit`. */
  container?: string;
  /** 1..1000 */
  lines?: number;
  /** Optional grep pattern (server-side `grep -E`). */
  grep?: string;
}

export interface DiskArgs {
  /** Show top-N largest directories (du -x). 0 disables. */
  top_dirs?: number;
}

export interface DnsCheckArgs {
  /** FQDN to look up. Required. */
  domain: string;
  /** Record types; defaults to ['A','AAAA']. */
  types?: ('A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT')[];
}

export interface TlsCheckArgs {
  /** FQDN to probe; defaults to connection.host. */
  domain?: string;
  /** TLS port; default 443. */
  port?: number;
}

export type KodeeResponse<T = unknown> = {
  ok: true;
  v: number;
  action: ActionName;
  data: T;
  duration_ms: number;
} | {
  ok: false;
  v: number;
  action?: ActionName;
  error: { code: ErrorCode; message: string; details?: unknown };
  duration_ms: number;
};

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'AUTH_FAILED'
  | 'HOST_KEY_MISMATCH'
  | 'EXEC_TIMEOUT'
  | 'EXEC_ERROR'
  | 'UNKNOWN_ACTION'
  | 'INTERNAL';

// Action-specific response data shapes
export interface StatusData {
  uptime: { days: number; hours: number; minutes: number; load: [number, number, number] };
  memory_mb: { total: number; used: number; free: number };
  failed_units: string[];
}

export interface LogsTailData {
  source: 'journalctl' | 'docker';
  target: string | null;
  lines: string[];
}

export interface DiskData {
  filesystems: Array<{
    source: string;
    size: string;
    used: string;
    avail: string;
    use_pct: string;
    mount: string;
  }>;
  top_dirs?: Array<{ size: string; path: string }>;
}

export interface DnsCheckData {
  domain: string;
  records: Record<string, string[]>;
  matches_vps: boolean | null;
  vps_host: string;
}

export interface TlsCheckData {
  domain: string;
  port: number;
  issuer: string | null;
  subject: string | null;
  valid_from: string | null;
  valid_to: string | null;
  days_remaining: number | null;
  san: string[];
  matches_domain: boolean;
}

export interface WriteActionData {
  command: string;
  exit_code: number | null;
  stdout: string;
  stderr: string;
}

// DB row shape used across modules
export interface VpsConnectionRow {
  id: string;
  owner_id: string;
  tenant_id: string | null;
  label: string;
  host: string;
  port: number;
  username: string;
  known_host_fingerprint: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}
