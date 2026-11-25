/**
 * R1 (Phase 0, 18.11.2026): Jeder Workflow-Job, der in Produktion schreibt,
 * läuft in der GitHub-Environment `production` und wartet dort auf die
 * Freigabe. Neue Deploy-Jobs ohne dieses Gate machen den Test rot.
 *
 * Text-basiert wie `deploy-main-only.test.ts`, ohne YAML-Abhängigkeit.
 * Kommentarzeilen zählen nicht als Aufruf.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

const DIR = '.github/workflows';

/** Befehle mit Prod-Schreibwirkung (Deploy, Migration, Löschen, DNS/API-Schreiben). */
const PROD_WRITE =
  /wrangler (deploy|pages deploy|d1 (migrations apply|execute|create)|r2 bucket create)|command: *(deploy|pages deploy)|supabase (db push|functions (deploy|delete)|migration repair)|docker compose (up|build)|rsync |ssh -i|-X (POST|PATCH|PUT|DELETE)/;

/**
 * Bewusste Ausnahmen mit Begründung. Jede neue Ausnahme braucht eine Freigabe.
 * - drift-alert: nennt `supabase db push` nur im Text eines Issues.
 */
const NOT_PROD_WRITE = new Set(['drift-alert.yml:alert']);

function jobs(yml: string): Array<[string, string]> {
  const start = yml.indexOf('\njobs:\n');
  if (start < 0) return [];
  const body = yml.slice(start + '\njobs:\n'.length);
  const heads = [...body.matchAll(/^ {2}([a-zA-Z0-9_-]+):\s*$/gm)];
  return heads.map((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1]!.index : body.length;
    return [m[1]!, body.slice(m.index, end)];
  });
}

const withoutComments = (text: string) =>
  text
    .split('\n')
    .filter((l) => !l.trim().startsWith('#'))
    .join('\n');

const isGated = (text: string) =>
  /^ {4}environment: production$/m.test(text) || /^ {4}environment:\n {6}name: production$/m.test(text);

const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).sort();
const prodJobs = files.flatMap((file) =>
  jobs(readFileSync(`${DIR}/${file}`, 'utf8'))
    .filter(([name, text]) => !NOT_PROD_WRITE.has(`${file}:${name}`) && PROD_WRITE.test(withoutComments(text)))
    .map(([name, text]) => ({ id: `${file}:${name}`, text })),
);

describe('Production-Gate (R1)', () => {
  it('findet die bekannten Prod-Jobs (sonst prüft der Test nichts)', () => {
    expect(prodJobs.map((j) => j.id)).toEqual(
      expect.arrayContaining([
        'deploy.yml:db-push',
        'deploy.yml:functions-deploy',
        'deploy-cloudflare-pages.yml:deploy',
        'migration-reconciliation.yml:reconcile-and-deploy',
        'delete-edge-function.yml:delete',
      ]),
    );
  });

  it.each(prodJobs.map((j) => [j.id, j.text] as const))('%s läuft in Environment production', (_id, text) => {
    expect(isGated(text)).toBe(true);
  });

  it('Environment-Name ist fest, nicht aus Eingaben wählbar', () => {
    for (const { id, text } of prodJobs) {
      expect(text, id).not.toMatch(/^ {4}environment: \$\{\{/m);
      expect(text, id).not.toMatch(/^ {4}environment:\n {6}name: \$\{\{/m);
    }
  });

  it('Pages-Deploy nach --branch=main nur vom Stand main', () => {
    const job = prodJobs.find((j) => j.id === 'deploy-cloudflare-pages.yml:deploy')!;
    expect(job.text).toMatch(/--branch=main/);
    expect(job.text).toMatch(/^ {4}if: .*github\.ref == 'refs\/heads\/main'/m);
  });
});
