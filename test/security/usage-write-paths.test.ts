/**
 * Verbrauchserfassung: Schreibpfade auf `usage_events` / `usage_totals`.
 *
 * Folge zu #2444 (`usage-increment` nimmt nur noch positive Deltas an). Der
 * Fix wirkt nur, wenn es keinen zweiten, vom Client erreichbaren Schreibweg
 * gibt. Dieser Vertragstest hält den Ist-Stand im Repo fest:
 *
 * 1. RLS: Auf `usage_events` und `usage_totals` gibt es nur Lese-Policies.
 *    Schreiben läuft ausschließlich über die Service-Role der Edge Functions.
 * 2. Keine Migration gewährt `anon`/`authenticated`/`PUBLIC` Schreibrechte
 *    auf diese Tabellen.
 * 3. Die SECURITY-DEFINER-Funktionen `upsert_usage_total` und
 *    `sync_usage_total_on_event` sind für Clients entzogen und werden nicht
 *    wieder freigegeben.
 * 4. Inventar der Buchungsstellen (`recordUsage` / `consumeUsage`) in den
 *    Edge Functions. Eine neue Buchungsstelle lässt den Test scheitern, damit
 *    jemand prüft, woher das Delta stammt (Server-Messung, nie Request-Body).
 *
 * Grenze: Geprüft wird der Repo-Stand, nicht die Produktionsdatenbank.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, 'supabase/migrations');
const FUNCTIONS_DIR = join(ROOT, 'supabase/functions');

const USAGE_TABLES = ['usage_events', 'usage_totals'] as const;
const USAGE_FUNCTIONS = ['upsert_usage_total', 'sync_usage_total_on_event'] as const;

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

function readMigrations(): Array<{ file: string; sql: string }> {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: stripSqlComments(readFileSync(join(MIGRATIONS_DIR, file), 'utf8')) }));
}

/** Alle Anweisungen bis zum nächsten Semikolon, die mit `prefix` beginnen. */
function statements(sql: string, prefix: RegExp): string[] {
  const out: string[] = [];
  const re = new RegExp(prefix.source, 'gi');
  for (let m = re.exec(sql); m; m = re.exec(sql)) {
    const end = sql.indexOf(';', m.index);
    out.push(sql.slice(m.index, end < 0 ? sql.length : end).replace(/\s+/g, ' ').trim());
  }
  return out;
}

const tableRef = (table: string) => new RegExp(`\\bON\\s+(?:TABLE\\s+)?(?:public\\.)?"?${table}"?(?![\\w])`, 'i');

describe('usage-Tabellen: nur lesende Policies', () => {
  const migrations = readMigrations();

  it('findet die Migrationen', () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  for (const table of USAGE_TABLES) {
    it(`${table}: jede Policy ist FOR SELECT`, () => {
      const offenders: string[] = [];
      let seen = 0;
      for (const { file, sql } of migrations) {
        for (const stmt of statements(sql, /CREATE\s+POLICY\b/)) {
          if (!tableRef(table).test(stmt)) continue;
          seen += 1;
          if (!/\bFOR\s+SELECT\b/i.test(stmt)) offenders.push(`${file}: ${stmt.slice(0, 160)}`);
        }
      }
      expect(seen, `keine Policy auf ${table} gefunden – Testannahme prüfen`).toBeGreaterThan(0);
      expect(offenders, 'Schreibende Policy auf einer Verbrauchstabelle').toEqual([]);
    });

    it(`${table}: keine Schreibrechte für anon/authenticated/PUBLIC`, () => {
      const offenders: string[] = [];
      for (const { file, sql } of migrations) {
        for (const stmt of statements(sql, /\bGRANT\b/)) {
          if (!tableRef(table).test(stmt)) continue;
          const writes = /\b(INSERT|UPDATE|DELETE|TRUNCATE|ALL)\b/i.test(stmt.split(/\bON\b/i)[0]);
          const toClient = /\bTO\b[\s\S]*\b(anon|authenticated|PUBLIC)\b/i.test(stmt);
          if (writes && toClient) offenders.push(`${file}: ${stmt.slice(0, 160)}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  }
});

describe('usage-Funktionen: für Clients entzogen', () => {
  const migrations = readMigrations();

  for (const fn of USAGE_FUNCTIONS) {
    it(`${fn}: REVOKE für authenticated vorhanden, kein späteres GRANT an Clients`, () => {
      const fnRef = new RegExp(`\\bFUNCTION\\s+(?:public\\.)?${fn}\\s*\\(`, 'i');
      const revokes = migrations.flatMap(({ file, sql }) =>
        statements(sql, /\bREVOKE\b/).filter((s) => fnRef.test(s) && /\bauthenticated\b/i.test(s)).map(() => file));
      expect(revokes.length, `kein REVOKE für ${fn}`).toBeGreaterThan(0);

      const grants = migrations.flatMap(({ file, sql }) =>
        statements(sql, /\bGRANT\b/)
          .filter((s) => fnRef.test(s) && /\bTO\b[\s\S]*\b(anon|authenticated|PUBLIC)\b/i.test(s))
          .map((s) => `${file}: ${s.slice(0, 160)}`));
      expect(grants).toEqual([]);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────
// Inventar der Buchungsstellen
// ─────────────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
}

/** Argumente eines Aufrufs ab der öffnenden Klammer, auf oberster Ebene getrennt. */
function callArgs(src: string, openParen: number): string[] {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = openParen + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') {
      if (depth === 0) { args.push(current.trim()); return args; }
      depth--;
    }
    if (ch === ',' && depth === 0) { args.push(current.trim()); current = ''; continue; }
    current += ch;
  }
  return args;
}

interface CallSite { file: string; fn: string; delta: string | null }

function usageCallSites(): CallSite[] {
  const sites: CallSite[] = [];
  for (const path of walk(FUNCTIONS_DIR)) {
    const file = relative(ROOT, path);
    if (file === 'supabase/functions/_shared/usage.ts') continue;
    const src = stripTsComments(readFileSync(path, 'utf8'));
    const re = /\b(recordUsage|consumeUsage)\s*\(/g;
    for (let m = re.exec(src); m; m = re.exec(src)) {
      // Definitionen (`function recordUsage(`) sind keine Buchungsstellen.
      if (/\bfunction\s*$/.test(src.slice(Math.max(0, m.index - 20), m.index))) continue;
      const args = callArgs(src, m.index + m[0].length - 1);
      sites.push({ file, fn: m[1], delta: args.length >= 4 ? args[3] : null });
    }
  }
  return sites;
}

/**
 * Bekannte Dateien mit Buchungsstellen. Kommt eine neue Datei dazu, prüfen:
 * Stammt das Delta aus einer Server-Messung (Provider-Antwort, signierter
 * Webhook, Konstante)? Erst dann hier eintragen.
 */
const KNOWN_FILES = [
  'supabase/functions/_shared/ai.ts',
  'supabase/functions/ai-gateway/handler.ts',
  'supabase/functions/ai-gateway/index.ts',
  'supabase/functions/ai-invoke/index.ts',
  'supabase/functions/automation-callback/index.ts',
  'supabase/functions/bot-chat/index.ts',
  'supabase/functions/bot-voice-webhook/index.ts',
  'supabase/functions/bulk-scan/index.ts',
  'supabase/functions/enterprise-ai-os-agents-run/index.ts',
  'supabase/functions/governance-router/index.ts',
  'supabase/functions/usage-increment/index.ts',
  'supabase/functions/whatsapp-webhook/index.ts',
  'supabase/functions/workflow-callback/index.ts',
];

describe('Buchungsstellen in den Edge Functions', () => {
  const sites = usageCallSites();

  it('findet Buchungsstellen', () => {
    expect(sites.length).toBeGreaterThan(0);
  });

  it('keine neue Datei mit recordUsage/consumeUsage ohne Prüfung', () => {
    const files = [...new Set(sites.map((s) => s.file))].sort();
    const unknown = files.filter((f) => !KNOWN_FILES.includes(f));
    expect(unknown, 'Neue Buchungsstelle: Herkunft des Deltas prüfen und in KNOWN_FILES eintragen').toEqual([]);
  });

  it('kein Delta direkt aus dem Request', () => {
    const fromRequest = sites.filter((s) => s.delta !== null && /\b(body|payload|params|req|request|input)\b/.test(s.delta));
    expect(fromRequest.map((s) => `${s.file}: ${s.fn}(…, ${s.delta})`)).toEqual([]);
  });

  it('usage-increment bucht nur das geprüfte Delta aus parseDelta', () => {
    const site = sites.find((s) => s.file === 'supabase/functions/usage-increment/index.ts');
    expect(site?.fn).toBe('consumeUsage');
    expect(site?.delta).toBe('delta');
    const src = readFileSync(join(FUNCTIONS_DIR, 'usage-increment/index.ts'), 'utf8');
    expect(src).toMatch(/const delta = parsed\.delta;/);
  });
});
