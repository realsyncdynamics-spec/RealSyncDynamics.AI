/**
 * Project-relative path normalisation. Rejects traversal, NUL, absolute
 * paths, and Windows drive letters. The FileStore only ever sees the
 * return value of this function.
 */

const MAX_PATH = 240;
const MAX_SEGMENTS = 16;

export function normalizeProjectPath(input: string): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw || raw.length > MAX_PATH) return null;
  if (raw.includes('\0')) return null;
  if (/^[a-zA-Z]:/.test(raw)) return null;

  const unified = raw.replace(/\\/g, '/');
  if (unified.startsWith('/') || unified.startsWith('//')) return null;

  const parts: string[] = [];
  for (const seg of unified.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') return null;
    if (seg === '~') return null;
    if (seg === '.git' || seg === '.env' || seg.startsWith('.env.')) return null;
    if (seg === 'node_modules') return null;
    parts.push(seg);
  }
  if (parts.length === 0 || parts.length > MAX_SEGMENTS) return null;
  return parts.join('/');
}

export const SECRET_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: 'openai', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { id: 'anthropic', re: /\bsk-ant-[A-Za-z0-9\-_]{20,}\b/ },
  { id: 'xai', re: /\bxai-[A-Za-z0-9]{20,}\b/ },
  { id: 'aws', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { id: 'supabase-service', re: /service[_-]?role/i },
  { id: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

export function findSecretLeak(content: string): string | null {
  for (const p of SECRET_PATTERNS) {
    if (p.re.test(content)) return p.id;
  }
  return null;
}

const PRODUCTION_SHELL = [
  /\bwrangler\s+(deploy|kv|pages\s+deploy)/i,
  /\bvercel\s+(--prod|deploy)\b/i,
  /\bsupabase\s+(db\s+push|functions\s+deploy)/i,
  /\bgit\s+push\b/i,
  /\bdocker\s+push\b/i,
  /\brm\s+-rf\s+\//,
  /\bcurl\s+[^\n]*(api\.realsyncdynamics|realsyncdynamicsai\.de)/i,
];

export function isProductionShell(command: string): boolean {
  return PRODUCTION_SHELL.some((re) => re.test(command));
}
