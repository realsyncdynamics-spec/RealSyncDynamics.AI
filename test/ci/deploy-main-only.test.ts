/**
 * deploy.yml schreibt Migrationen und Edge Functions nach Prod. Über
 * workflow_dispatch lief es auch vom Stand eines beliebigen Branches
 * (Feature-Matrix Phase 1, Befund 7). Jeder Job braucht deshalb den
 * main-Wächter.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const yml = readFileSync('.github/workflows/deploy.yml', 'utf8');

/** Job-Blöcke unter `jobs:` (zwei Leerzeichen Einrückung) → Name und Text. */
function jobs(): Array<[string, string]> {
  const body = yml.slice(yml.indexOf('\njobs:\n') + '\njobs:\n'.length);
  const out: Array<[string, string]> = [];
  const re = /^ {2}([a-zA-Z0-9_-]+):\s*$/gm;
  const heads = [...body.matchAll(re)];
  heads.forEach((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1]!.index : body.length;
    out.push([m[1]!, body.slice(m.index, end)]);
  });
  return out;
}

describe('deploy.yml — nur von main', () => {
  it('kennt manuelle Auslösung (sonst wäre der Wächter überflüssig)', () => {
    expect(yml).toMatch(/^ {2}workflow_dispatch:/m);
  });

  it('jeder Job läuft nur auf refs/heads/main', () => {
    const list = jobs();
    expect(list.map(([n]) => n)).toEqual(expect.arrayContaining(['db-push', 'functions-deploy']));
    for (const [name, text] of list) {
      expect(text, name).toMatch(/^ {4}if: github\.ref == 'refs\/heads\/main'$/m);
    }
  });
});
