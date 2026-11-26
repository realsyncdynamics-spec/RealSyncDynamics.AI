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

/** Befehle mit Prod-Schreibwirkung (Deploy, Migration, Löschen, Secrets, DNS/API-Schreiben, Upload, SSH). */
const PROD_WRITE = new RegExp(
  [
    String.raw`wrangler (deploy|pages deploy|secret put|d1 (migrations apply|execute|create)|r2 (bucket create|object put))`,
    String.raw`command: *(deploy|pages deploy|d1 migrations apply|secret put)`,
    String.raw`supabase (db push|functions (deploy|delete)|migration repair|secrets set|config push)`,
    String.raw`docker[ -]compose (up|build)`,
    String.raw`rsync |\bscp |\bssh [^\n]*-i `,
    String.raw`rclone (copy|sync|move)|aws s3 (cp|sync|mv)`,
    String.raw`-X ?(POST|PATCH|PUT|DELETE)|--request (POST|PATCH|PUT|DELETE)`,
  ].join('|'),
);

/**
 * Jobs mit Prod-Wirkung, die PROD_WRITE nicht am Befehl erkennt.
 * - siteos-production-e2e: Playwright klickt „Live veröffentlichen“ auf der Live-Domain.
 */
const PROD_BY_DECLARATION = new Set(['siteos-production-e2e.yml:publish']);

/**
 * Bewusste Ausnahmen mit Begründung. Jede neue Ausnahme braucht eine Freigabe.
 * - drift-alert: nennt `supabase db push` nur im Text eines Issues.
 */
const NOT_PROD_WRITE = new Set(['drift-alert.yml:alert']);

/**
 * Prod-Wirkung ohne Freigabe-Gate, dafür zwingend nur von main.
 * - vps-backup: täglicher Lauf per Schedule; ein Gate hielte jedes Backup an.
 */
const MAIN_ONLY_NO_GATE = new Set(['vps-backup.yml:backup']);

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

const mainOnly = (text: string) => /^ {4}if: .*github\.ref == 'refs\/heads\/main'/m.test(text);

const files = readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).sort();
const allJobs = files.flatMap((file) =>
  jobs(readFileSync(`${DIR}/${file}`, 'utf8')).map(([name, text]) => ({ id: `${file}:${name}`, text })),
);
const isProd = ({ id, text }: { id: string; text: string }) =>
  !NOT_PROD_WRITE.has(id) && (PROD_BY_DECLARATION.has(id) || PROD_WRITE.test(withoutComments(text)));
const prodJobs = allJobs.filter((j) => isProd(j) && !MAIN_ONLY_NO_GATE.has(j.id));

describe('Production-Gate (R1)', () => {
  it.each(files)('%s: Job-Zerlegung findet Jobs (kein stiller Leerlauf)', (file) => {
    const yml = readFileSync(`${DIR}/${file}`, 'utf8');
    const found = jobs(yml).length;
    expect(found).toBeGreaterThan(0);
    // Jeder Job-Kopf unter `jobs:` muss erkannt sein, sonst verschmilzt er mit dem Vorgänger.
    const heads = (yml.slice(yml.indexOf('\njobs:\n')).match(/^ {2}[^\s#][^\n]*:/gm) ?? []).length;
    expect(found).toBe(heads);
  });

  it('findet die bekannten Prod-Jobs (sonst prüft der Test nichts)', () => {
    expect(prodJobs.map((j) => j.id)).toEqual(
      expect.arrayContaining([
        'deploy.yml:db-push',
        'deploy.yml:functions-deploy',
        'deploy-cloudflare-pages.yml:deploy',
        'migration-reconciliation.yml:reconcile-and-deploy',
        'delete-edge-function.yml:delete',
        'siteos-production-e2e.yml:publish',
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

  it.each([...MAIN_ONLY_NO_GATE])('%s: Ausnahme ohne Gate läuft nur von main', (id) => {
    const job = allJobs.find((j) => j.id === id);
    expect(job).toBeDefined();
    expect(isProd(job!)).toBe(true);
    expect(mainOnly(job!.text)).toBe(true);
  });

  it.each(['deploy-cloudflare-pages.yml:deploy', 'siteos-production-e2e.yml:publish'])(
    '%s läuft zusätzlich nur vom Stand main',
    (id) => {
      expect(mainOnly(prodJobs.find((j) => j.id === id)!.text)).toBe(true);
    },
  );
});
