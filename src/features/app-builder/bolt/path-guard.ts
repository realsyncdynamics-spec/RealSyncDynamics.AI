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

/*
 * Project file validation — adapted from bolt.diy
 * `app/lib/runtime/projectFileValidation.ts` (MIT, stackblitz-labs/bolt.diy).
 * Upstream parses JS/TS with prettier before saving and rejects generated code
 * whose real line breaks were collapsed. RealSync keeps the same intent without
 * adding prettier to the bundle: cheap, synchronous, fail-closed checks that run
 * inside the governance gate *after* path normalisation and secret scan.
 */

export const MAX_FILE_BYTES = 512 * 1024;
const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx|css|html?|json|md|svg)$/i;
const SCRIPT_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/i;

export type FileValidationIssue =
  | 'too-large'
  | 'binary-content'
  | 'collapsed-line-breaks'
  | 'invalid-json'
  | 'unbalanced-brackets';

export function validateProjectFile(filePath: string, content: string): FileValidationIssue | null {
  if (content === '') return null;
  if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) return 'too-large';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u0008\u000E-\u001F]/.test(content)) return 'binary-content';
  if (CODE_FILE.test(filePath)) {
    const lines = content.split('\n');
    const longest = Math.max(...lines.map((l) => l.length));
    // Upstream: "preserve real line breaks". Model emitted literal \n instead of newlines.
    if (lines.length <= 2 && longest > 400 && /\\n/.test(content)) return 'collapsed-line-breaks';
  }
  if (/\.json$/i.test(filePath)) {
    try {
      JSON.parse(content);
    } catch {
      return 'invalid-json';
    }
  }
  if (SCRIPT_FILE.test(filePath) && !bracketsBalanced(content)) return 'unbalanced-brackets';
  return null;
}

/** Bracket balance ignoring strings, template literals and comments. Truncated model output fails here. */
export function bracketsBalanced(src: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') {
      const e = src.indexOf('\n', i);
      i = e === -1 ? src.length : e;
      continue;
    }
    if (c === '/' && n === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e === -1) return false;
      i = e + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < src.length && src[i] !== c) {
        if (src[i] === '\\') i++;
        else if (c !== '`' && src[i] === '\n') break;
        i++;
      }
      i++;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') stack.push(c);
    else if (c === ')' || c === ']' || c === '}') {
      if (stack.pop() !== pairs[c]) return false;
    }
    i++;
  }
  return stack.length === 0;
}
