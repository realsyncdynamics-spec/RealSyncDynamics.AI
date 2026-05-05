// SSH wrapper for Kodee server actions.
// Uses npm:ssh2 via Deno's npm specifier (Supabase Edge Runtime supports this).
//
// Defense-in-depth:
// - Per-call timeout (hard kill via AbortController + ssh.end())
// - Output size cap (prevents memory blowup from runaway logs)
// - Optional host-key fingerprint pinning
// - No shell features beyond what we explicitly send; we never pass user input
//   directly into the command string — call sites must use shellQuote().

import { Client as Ssh2Client } from 'npm:ssh2@1.16.0';
import type { VpsConnectionRow } from './types.ts';

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 256 * 1024;

export class SshError extends Error {
  code: string;
  constructor(code: string, message: string, public details?: unknown) {
    super(message);
    this.code = code;
  }
}

export interface SshExecOpts {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

/** POSIX shell single-quote escape. Use for any value going into a remote command. */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Execute a single command over SSH and return stdout/stderr/exit code.
 * The connection is opened, the command runs, then the connection is closed.
 */
export async function sshExec(
  conn: VpsConnectionRow,
  privateKey: string,
  command: string,
  opts: SshExecOpts = {},
): Promise<SshExecResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? MAX_OUTPUT_BYTES;

  return await new Promise<SshExecResult>((resolve, reject) => {
    const client = new Ssh2Client();
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let exitCode: number | null = null;
    let settled = false;

    const finish = (err: SshError | null, result?: SshExecResult) => {
      if (settled) return;
      settled = true;
      try { client.end(); } catch { /* ignore */ }
      if (err) reject(err);
      else resolve(result!);
    };

    const timer = setTimeout(() => {
      finish(new SshError('EXEC_TIMEOUT', `command timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    client.on('ready', () => {
      client.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          return finish(new SshError('EXEC_ERROR', err.message));
        }
        stream
          .on('close', (code: number | null) => {
            clearTimeout(timer);
            finish(null, { stdout, stderr, exitCode: code });
          })
          .on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > maxBytes) {
              clearTimeout(timer);
              finish(new SshError('EXEC_ERROR', `output exceeded ${maxBytes} bytes`));
              return;
            }
            stdout += chunk.toString('utf8');
          })
          .stderr.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > maxBytes) {
              clearTimeout(timer);
              finish(new SshError('EXEC_ERROR', `output exceeded ${maxBytes} bytes`));
              return;
            }
            stderr += chunk.toString('utf8');
          });
      });
    });

    client.on('error', (err: Error & { level?: string }) => {
      clearTimeout(timer);
      const code = err.level === 'client-authentication'
        ? 'AUTH_FAILED'
        : 'CONNECTION_FAILED';
      finish(new SshError(code, err.message));
    });

    const expectedFp = conn.known_host_fingerprint;

    client.connect({
      host: conn.host,
      port: conn.port,
      username: conn.username,
      privateKey,
      readyTimeout: timeoutMs,
      // Pin host key if a fingerprint is configured for this connection.
      hostVerifier: expectedFp
        ? (key: Buffer | string) => {
            const actual = fingerprintSha256(typeof key === 'string' ? Buffer.from(key) : key);
            if (actual !== expectedFp) {
              // Returning false aborts the handshake; ssh2 will emit 'error'.
              return false;
            }
            return true;
          }
        : undefined,
    });
  });
}

function fingerprintSha256(key: Buffer): string {
  // ssh2 gives us the raw host key bytes; we hash to match
  // `ssh-keygen -lf` style "SHA256:base64nopad".
  // Lazy import via Deno's std crypto to avoid pulling node:crypto at module load.
  const hash = crypto.subtle.digestSync
    ? // @ts-ignore - some runtimes expose digestSync
      crypto.subtle.digestSync('SHA-256', key)
    : null;
  if (!hash) {
    // Fallback: synchronous-ish hash via Deno's WebCrypto is async-only,
    // but hostVerifier in ssh2 is sync. Keep this simple by computing eagerly elsewhere
    // when we add automated verification. For v1, the absence of a fingerprint disables pinning.
    return '';
  }
  const b64 = btoa(String.fromCharCode(...new Uint8Array(hash as ArrayBuffer)));
  return `SHA256:${b64.replace(/=+$/, '')}`;
}
