/**
 * Status-Werte von automation_runs gegen den CHECK der Migration.
 *
 * ## Warum es diesen Test gibt
 *
 * `automation-trigger` hat Laeufe mit `status: 'pending'` angelegt. Der CHECK
 * auf `automation_runs.status` kennt nur `queued | running | success | error |
 * timeout | cancelled`. Postgres lehnt den INSERT mit 23514 ab, die Function
 * macht daraus `500 INTERNAL` — fuer jede an n8n gebundene Automation, bevor
 * ueberhaupt ein Webhook rausgeht. `automation-callback` hat spiegelbildlich
 * auf `'pending'` geprueft, einen Zustand, den es in der Tabelle nie geben kann.
 *
 * Ein Status-Literal ist fuer TypeScript nur ein String; weder Typecheck noch
 * Build sehen den Widerspruch zur Migration. Deshalb die Pruefung hier: jeder
 * Status, den die Functions schreiben oder als "noch aktiv" lesen, muss im
 * CHECK stehen.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const lies = (datei: string) => readFileSync(resolve(ROOT, datei), 'utf8');

/** Erlaubte Werte aus `status ... CHECK (status IN (...))` im CREATE TABLE. */
function erlaubteStatus(datei: string, tabelle: string): string[] {
  const sql = lies(datei);
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${tabelle} (`);
  expect(start, `${tabelle} nicht in ${datei}`).toBeGreaterThan(-1);
  const rumpf = sql.slice(start, sql.indexOf('\n);', start));
  const check = rumpf.match(/\bstatus\b[^\n]*CHECK \(status IN \(([^)]*)\)\)/);
  expect(check, `kein CHECK auf ${tabelle}.status`).not.toBeNull();
  return [...check![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

const ERLAUBT = erlaubteStatus(
  'supabase/migrations/20260614100000_automation_skills.sql',
  'automation_runs',
);

const TRIGGER = lies('supabase/functions/automation-trigger/index.ts');
const CALLBACK = lies('supabase/functions/automation-callback/index.ts');

/** Code ohne Zeilenkommentare — Doku darf 'pending' erwaehnen, Code nicht. */
const code = (src: string) =>
  src
    .split('\n')
    .map((z) => z.replace(/\/\/.*$/, ''))
    .join('\n');

describe('automation_runs: der CHECK der Migration', () => {
  it('kennt queued, aber kein pending', () => {
    expect(ERLAUBT).toEqual(['queued', 'running', 'success', 'error', 'timeout', 'cancelled']);
    expect(ERLAUBT).not.toContain('pending');
  });
});

describe('automation-trigger schreibt nur erlaubte Status', () => {
  const geschrieben = [...code(TRIGGER).matchAll(/\bstatus: '([a-z_]+)'/g)].map((m) => m[1]);

  it('legt den Lauf als queued an', () => {
    expect(geschrieben[0]).toBe('queued');
  });

  it('jeder geschriebene Status steht im CHECK', () => {
    expect(geschrieben.length).toBeGreaterThan(0);
    for (const s of geschrieben) expect(ERLAUBT, `status '${s}'`).toContain(s);
  });
});

describe('automation-callback liest und setzt nur erlaubte Status', () => {
  const src = code(CALLBACK);

  it('"noch aktiv" heisst queued oder running', () => {
    const aktiv = [...src.matchAll(/run\.status !== '([a-z_]+)'/g)].map((m) => m[1]);
    expect(aktiv.length).toBeGreaterThan(0);
    expect([...new Set(aktiv)].sort()).toEqual(['queued', 'running']);
  });

  it('jeder terminale Status steht im CHECK', () => {
    const liste = src.match(/const validStatus = \[([^\]]*)\]/);
    expect(liste).not.toBeNull();
    const terminal = [...liste![1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(terminal).toEqual(['success', 'error', 'timeout', 'cancelled']);
    for (const s of terminal) expect(ERLAUBT).toContain(s);
  });

  it('kein pending mehr im Code', () => {
    expect(src).not.toMatch(/'pending'/);
    expect(code(TRIGGER)).not.toMatch(/'pending'/);
  });
});

describe('automation-trigger überschreibt keinen beendeten Lauf', () => {
  it('jedes Update nach dem Insert gilt nur für einen noch queued Lauf', () => {
    const updates = [
      ...code(TRIGGER).matchAll(
        /\.from\('automation_runs'\)\.update\(\{[\s\S]*?\}\)\.eq\('id', run\.id\)(\.eq\('status', 'queued'\))?/g,
      ),
    ];
    expect(updates.length).toBe(3);
    for (const u of updates) expect(u[1], u[0].slice(0, 80)).toBeDefined();
  });
});

describe('automation-callback schreibt Outputs passend zum Schema', () => {
  const sql = lies('supabase/migrations/20260614100000_automation_skills.sql');
  const start = sql.indexOf('CREATE TABLE IF NOT EXISTS public.automation_outputs (');
  const rumpf = sql.slice(start, sql.indexOf('\n);', start));
  const spalten = [...rumpf.matchAll(/^\s{4}([a-z_]+)\s/gm)].map((m) => m[1]);

  const insert = code(CALLBACK).match(
    /from\('automation_outputs'\)\.insert\(\s*outputRefs\.map\(\(o\) => \(\{([\s\S]*?)\}\)\)/,
  );
  const gesetzt = [...(insert?.[1] ?? '').matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);

  it('setzt tenant_id (NOT NULL)', () => {
    expect(spalten).toContain('tenant_id');
    expect(gesetzt).toContain('tenant_id');
  });

  it('schreibt nur Spalten, die es gibt', () => {
    expect(gesetzt.length).toBeGreaterThan(0);
    for (const s of gesetzt) expect(spalten, `Spalte ${s}`).toContain(s);
  });
});
