/**
 * Selektierte Spalten gegen das tatsaechliche Schema.
 *
 * ## Warum es diesen Test gibt
 *
 * `automation-trigger` hat `automation_skills.title` selektiert. Die Spalte
 * heisst `name`. PostgREST antwortet darauf mit 42703, die Function macht
 * daraus `500 INTERNAL` — und zwar bevor sie die Bindung an n8n prueft. Die
 * Automation war damit nicht "noch nicht verdrahtet", sondern tot: kein
 * Aufruf konnte je bis zum klaren `skill_not_linked` kommen.
 *
 * Ein Tippfehler in einem Select-String faellt weder beim Typecheck noch
 * beim Build auf — der String ist fuer TypeScript nur ein String. Gemerkt
 * haette man es erst an einem 500 in Produktion. Deshalb die Pruefung hier:
 * jede selektierte Spalte muss es in der Migration wirklich geben.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');

/** Spaltennamen aus dem CREATE TABLE der Migration. */
function spaltenVon(datei: string, tabelle: string): string[] {
  const sql = readFileSync(resolve(ROOT, datei), 'utf8');
  const start = sql.indexOf(`CREATE TABLE IF NOT EXISTS public.${tabelle} (`);
  expect(start, `${tabelle} nicht in ${datei}`).toBeGreaterThan(-1);
  const rumpf = sql.slice(sql.indexOf('(', start) + 1, sql.indexOf('\n);', start));
  return rumpf
    .split('\n')
    .map((z) => z.replace(/--.*$/, '').trim())
    // Ziffern gehoeren dazu: die Spalte heisst n8n_workflow_id.
    .filter((z) => /^[a-z_][a-z0-9_]*\s/.test(z))
    .map((z) => z.split(/\s/)[0]);
}

const SPALTEN = spaltenVon(
  'supabase/migrations/20260614100000_automation_skills.sql',
  'automation_skills',
);

const TRIGGER = readFileSync(
  resolve(ROOT, 'supabase/functions/automation-trigger/index.ts'),
  'utf8',
);

/** Code ohne Zeilenkommentare — Doku darf alte Codes erwaehnen, Code nicht. */
const code = (src: string) =>
  src
    .split('\n')
    .map((z) => z.replace(/\/\/.*$/, ''))
    .join('\n');

describe('automation_skills: das Schema kennt diese Spalten', () => {
  it('name, nicht title', () => {
    expect(SPALTEN).toContain('name');
    expect(SPALTEN).not.toContain('title');
  });

  it('die Felder, die automation-trigger braucht', () => {
    for (const s of ['id', 'status', 'n8n_workflow_id']) {
      expect(SPALTEN, `${s} fehlt`).toContain(s);
    }
  });
});

describe('automation-trigger: selektiert nur Spalten, die es gibt', () => {
  /** Alle `.from('automation_skills').select('…')` der Function. */
  const selects = [
    ...TRIGGER.matchAll(
      /\.from\(\s*'automation_skills'\s*\)\s*\.select\(\s*'([^']*)'/g,
    ),
  ].map((m) => m[1]);

  it('greift die Tabelle ueberhaupt ab', () => {
    expect(selects.length).toBeGreaterThan(0);
  });

  it('jede selektierte Spalte steht in der Migration', () => {
    for (const liste of selects) {
      for (const spalte of liste.split(',').map((s) => s.trim()).filter(Boolean)) {
        // `*` und Relationen-Syntax sind hier nicht im Einsatz.
        expect(SPALTEN, `unbekannte Spalte "${spalte}" in select('${liste}')`)
          .toContain(spalte);
      }
    }
  });

  it('liest den Anzeigenamen aus name', () => {
    // Der Wire-Key Richtung n8n bleibt `skill_title` — das ist der
    // ausgehende Vertrag, nicht die Spalte.
    expect(TRIGGER).toContain('skill_title: skill.name');
    expect(TRIGGER).not.toContain('skill.title');
  });
});

describe('automation-trigger: ehrliche Fehler statt 500', () => {
  const src = code(TRIGGER);

  it('unlinked skill → 409 skill_not_linked (vor Run-Insert)', () => {
    expect(src).toMatch(/jsonError\(\s*409\s*,\s*'skill_not_linked'/);
    expect(src).toMatch(/!skill\.n8n_workflow_id/);
    // Kein Legacy-Code, der den Zustand verdeckt.
    expect(src).not.toMatch(/'NOT_BOUND'/);
    // Bindungspruefung steht vor dem INSERT in automation_runs.
    const bindPos = src.indexOf('skill_not_linked');
    const insertPos = src.indexOf(".from('automation_runs').insert");
    expect(bindPos).toBeGreaterThan(-1);
    expect(insertPos).toBeGreaterThan(bindPos);
  });

  it('unreachable runtime → 422 runtime_unavailable (kein 500)', () => {
    expect(src).toMatch(/jsonError\(\s*422\s*,\s*'runtime_unavailable'/);
    expect(src).toMatch(/error_code:\s*'runtime_unavailable'/);
    expect(src).not.toMatch(/'N8N_UNREACHABLE'/);
  });

  it('linked skill path: Webhook + Success-Response unveraendert', () => {
    expect(src).toContain('/webhook/${skill.n8n_workflow_id}');
    expect(src).toContain("status: 'running'");
    expect(src).toMatch(
      /jsonResponse\(\{\s*ok:\s*true,\s*run_id:\s*run\.id,\s*n8n_execution_id:\s*n8nExecutionId\s*\}\)/,
    );
    expect(src).toMatch(/jsonError\(\s*502\s*,\s*'N8N_REJECTED'/);
  });
});
