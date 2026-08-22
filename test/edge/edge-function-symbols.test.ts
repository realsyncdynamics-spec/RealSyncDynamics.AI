import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

/**
 * Statischer Schutz gegen abgeschnittene Edge Functions.
 *
 * Anlass: In `gdpr-audit` wurde der komplette Helfer-Block (`runChecks`,
 * `scanSubpages`, `extractFacts`, `scoreReport`, `fetchWithTimeout`, `concat`)
 * versehentlich mit-gelöscht. Der Deploy lief durch, der Preflight antwortete
 * mit 200 — erst zur Laufzeit warf Deno `ReferenceError: runChecks is not
 * defined`. Die Edge-Runtime beantwortet einen ungefangenen Fehler ohne
 * CORS-Header, im Browser kam deshalb nur „Failed to fetch" an. Der freie
 * DSGVO-Audit war damit produktiv tot, ohne dass ein Test angeschlagen hätte.
 *
 * Dieser Test prüft für jede Edge Function, dass jeder im Modul aufgerufene
 * Bezeichner auch dort definiert oder importiert ist. Er ersetzt kein
 * `deno check`, fängt aber genau die Klasse Fehler ab, die hier aufgetreten
 * ist: verlorene Top-Level-Definitionen.
 */

const FUNCTIONS_DIR = join(process.cwd(), 'supabase', 'functions');

/** Globale Bezeichner, die in Deno/V8 ohne Import verfügbar sind. */
const GLOBALS = new Set([
  'Array', 'ArrayBuffer', 'Atomics', 'BigInt', 'Blob', 'Boolean', 'BroadcastChannel',
  'Date', 'Deno', 'Error', 'EvalError', 'Event', 'EventTarget', 'File', 'FormData',
  'Function', 'Headers', 'Infinity', 'Intl', 'JSON', 'Map', 'Math', 'NaN', 'Number',
  'Object', 'Promise', 'Proxy', 'RangeError', 'ReadableStream', 'Reflect', 'RegExp',
  'Request', 'Response', 'Set', 'SharedArrayBuffer', 'String', 'Symbol', 'SyntaxError',
  'TextDecoder', 'TextEncoder', 'TransformStream', 'TypeError', 'URL', 'URLSearchParams',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array', 'DataView',
  'WeakMap', 'WeakRef', 'WeakSet', 'WebSocket', 'WritableStream', 'AbortController',
  'AbortSignal', 'AggregateError', 'CloseEvent', 'CompressionStream', 'Crypto',
  'CryptoKey', 'DecompressionStream', 'DOMException', 'MessageChannel', 'MessageEvent',
  'MessagePort', 'PerformanceEntry', 'ReferenceError', 'TextDecoderStream',
  'TextEncoderStream', 'URIError', 'Worker',
  'atob', 'btoa', 'clearInterval', 'clearTimeout', 'console', 'crypto', 'decodeURI',
  'decodeURIComponent', 'encodeURI', 'encodeURIComponent', 'eval', 'fetch',
  'globalThis', 'isFinite', 'isNaN', 'parseFloat', 'parseInt', 'performance', 'queueMicrotask',
  'setInterval', 'setTimeout', 'structuredClone', 'localStorage', 'sessionStorage',
  'process', 'Buffer', 'require', 'module', 'exports', '__dirname', '__filename',
]);

/** Schlüsselwörter, die syntaktisch wie ein Aufruf aussehen (`if (`, `catch (` …). */
const KEYWORDS = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'instanceof', 'new',
  'await', 'void', 'delete', 'yield', 'do', 'else', 'function', 'in', 'of', 'case',
  'throw', 'super', 'this', 'import', 'export', 'const', 'let', 'var', 'class',
  'try', 'finally', 'default', 'async', 'as', 'from', 'satisfies', 'is', 'infer',
  'keyof', 'readonly', 'declare', 'type', 'interface', 'enum', 'namespace', 'not',
  'and', 'or', 'assert', 'using', 'string', 'number', 'boolean', 'unknown', 'any',
  'never', 'null', 'undefined', 'true', 'false', 'object', 'symbol', 'bigint', 'Deno',
]);

function listFunctionEntrypoints(): { slug: string; path: string }[] {
  return readdirSync(FUNCTIONS_DIR)
    .filter((slug) => !slug.startsWith('_') && !slug.startsWith('.'))
    .filter((slug) => statSync(join(FUNCTIONS_DIR, slug)).isDirectory())
    .map((slug) => ({ slug, path: join(FUNCTIONS_DIR, slug, 'index.ts') }))
    .filter((f) => {
      try { return statSync(f.path).isFile(); } catch { return false; }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/**
 * Entfernt Kommentare, String-/Template-Literale und Regex-Literale, damit
 * Text wie `// runChecks(...)` oder `/nur (a|b)/` keine Treffer erzeugt.
 * Bewusst ein kleiner Scanner statt Regex: verschachtelte Template-Literale
 * (`${x ? `a` : 'b'}`) lassen sich mit Regex nicht zuverlaessig entfernen,
 * und ein falsch entfernter Block wuerde echte Definitionen verschlucken.
 */
export function stripLiterals(src: string): string {
  const out: string[] = [];
  // Stack fuer Template-Literale: pro offenem `${` die Klammertiefe.
  const templateStack: number[] = [];
  let i = 0;
  let lastSignificant = '';

  const keep = (ch: string) => { out.push(ch); if (!/\s/.test(ch)) lastSignificant = ch; };
  const blank = (ch: string) => out.push(ch === '\n' ? '\n' : ' ');

  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];

    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') blank(src[i++]);
      continue;
    }
    if (ch === '/' && next === '*') {
      blank(src[i++]); blank(src[i++]);
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) blank(src[i++]);
      if (i < src.length) { blank(src[i++]); blank(src[i++]); }
      continue;
    }
    if (ch === "'" || ch === '"') {
      keep(ch); i++;
      while (i < src.length && src[i] !== ch) {
        if (src[i] === '\\') { blank(src[i++]); if (i < src.length) blank(src[i++]); continue; }
        if (src[i] === '\n') break;
        blank(src[i++]);
      }
      if (i < src.length && src[i] === ch) keep(src[i++]);
      continue;
    }
    if (ch === '`') {
      keep(ch); i++;
      while (i < src.length) {
        if (src[i] === '\\') { blank(src[i++]); if (i < src.length) blank(src[i++]); continue; }
        if (src[i] === '`') { keep(src[i++]); break; }
        if (src[i] === '$' && src[i + 1] === '{') {
          // Interpolation ist echter Code — normal weiterscannen.
          keep(src[i++]); keep(src[i++]);
          templateStack.push(0);
          break;
        }
        blank(src[i++]);
      }
      continue;
    }
    if (templateStack.length > 0 && (ch === '{' || ch === '}')) {
      const depth = templateStack[templateStack.length - 1];
      if (ch === '{') { templateStack[templateStack.length - 1] = depth + 1; keep(src[i++]); continue; }
      if (depth > 0) { templateStack[templateStack.length - 1] = depth - 1; keep(src[i++]); continue; }
      // Ende der Interpolation → zurueck in den Template-Text.
      templateStack.pop();
      keep(src[i++]);
      while (i < src.length) {
        if (src[i] === '\\') { blank(src[i++]); if (i < src.length) blank(src[i++]); continue; }
        if (src[i] === '`') { keep(src[i++]); break; }
        if (src[i] === '$' && src[i + 1] === '{') {
          keep(src[i++]); keep(src[i++]);
          templateStack.push(0);
          break;
        }
        blank(src[i++]);
      }
      continue;
    }
    if (ch === '/' && !/[\w$)\]]/.test(lastSignificant)) {
      // Regex-Literal (heuristisch: nach Operator/Klammerauf, nicht nach Wert).
      keep(ch); i++;
      let inClass = false;
      while (i < src.length) {
        if (src[i] === '\\') { blank(src[i++]); if (i < src.length) blank(src[i++]); continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { keep(src[i++]); break; }
        else if (src[i] === '\n') break;
        blank(src[i++]);
      }
      while (i < src.length && /[a-z]/.test(src[i])) blank(src[i++]);
      continue;
    }
    keep(ch);
    i++;
  }
  return out.join('');
}

/** Bezeichner, die im Modul deklariert oder importiert werden. */
function declaredNames(src: string): Set<string> {
  const names = new Set<string>();
  const add = (n?: string) => { if (n) names.add(n); };

  for (const m of src.matchAll(/\b(?:function|class)\s*\*?\s*([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  for (const m of src.matchAll(/\b(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) add(m[1]);
  // Destrukturierung: const { a, b: c } = … / Funktionsparameter
  for (const m of src.matchAll(/\{([^{}]*)\}\s*(?:=|:|\)|=>)/g)) {
    for (const part of m[1].split(',')) {
      const key = part.includes(':') ? part.split(':').pop()! : part;
      add(key.replace(/[^\w$]/g, '') || undefined);
    }
  }
  // Import-Bindings (default, namespace, benannt)
  for (const m of src.matchAll(/import\s+([\s\S]*?)\s+from\s+/g)) {
    for (const part of m[1].replace(/[{}]/g, ',').split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.replace(/[^\w$]/g, '');
      add(name || undefined);
    }
  }
  // Methoden-Kurzform und TS-Signaturen (`select(cols: string): X`, `run() {`)
  // sind Definitionen, keine Aufrufe.
  for (const m of src.matchAll(/(?:^|[{;,])\s*(?:readonly\s+|async\s+|static\s+|get\s+|set\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\s*\([^()]*\)\s*[:{]/gm)) {
    if (!KEYWORDS.has(m[1])) add(m[1]);
  }
  // Callback-Parameter mit Funktionstyp: `query: () => Promise<T>`.
  for (const m of src.matchAll(/(?:^|[(,{])\s*([A-Za-z_$][\w$]*)\s*\??\s*:\s*\(/gm)) add(m[1]);
  // Funktionsparameter (grob: alles innerhalb runder Klammern nach einem Namen)
  for (const m of src.matchAll(/\(([^()]*)\)\s*(?:=>|\{|:)/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().replace(/[?:=].*$/s, '').replace(/^\.\.\./, '').trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) add(name);
    }
  }
  return names;
}

/** Aufgerufene Bezeichner: `name(` ohne vorangestellten Punkt/Bezeichner. */
function calledNames(src: string): Set<string> {
  const names = new Set<string>();
  for (const m of src.matchAll(/(^|[^\w$.?])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = m[2];
    if (!KEYWORDS.has(name)) names.add(name);
  }
  return names;
}

describe('Edge Functions — keine undefinierten Top-Level-Aufrufe', () => {
  const entrypoints = listFunctionEntrypoints();

  test('Edge-Function-Verzeichnis wird gefunden', () => {
    expect(entrypoints.length).toBeGreaterThan(50);
  });

  test.each(entrypoints.map((f) => [f.slug, f.path]))('%s', (_slug, path) => {
    const src = stripLiterals(readFileSync(path as string, 'utf-8'));
    const declared = declaredNames(src);
    const missing = [...calledNames(src)]
      .filter((n) => !declared.has(n) && !GLOBALS.has(n))
      .sort();
    expect(missing).toEqual([]);
  });
});
