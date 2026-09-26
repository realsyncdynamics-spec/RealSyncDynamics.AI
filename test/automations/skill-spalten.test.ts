/**
 * Selektierte Spalten gegen das tatsaechliche Schema.
 *
 * ## Warum es diesen Test gibt
 *
 * `automation-trigger` hat `automation_skills.title` selektiert. Die Spalte
 * heisst `name`. PostgREST antwortet darauf mit 42703, die Function macht
 * daraus `500 INTERNAL` — und zwar bevor sie die Bindung an n8n prueft. Die
 * Automation war damit nicht "noch nicht verdrahtet", sondern tot: kein
 * Aufruf konnte je bis zum `409 NOT_BOUND` kommen, das sie eigentlich
 * liefern sollte.
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
  const quelle = readFileSync(
    resolve(ROOT, 'supabase/functions/automation-trigger/index.ts'),
    'utf8',
  );

  /** Alle `.from('automation_skills').select('…')` der Function. */
  const selects = [
    ...quelle.matchAll(
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
    expect(quelle).toContain('skill_title: skill.name');
    expect(quelle).not.toContain('skill.title');
  });
});
