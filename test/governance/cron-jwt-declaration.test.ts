import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * UNDECLARED_NO_JWT — Drift-Guard 2026-09-10.
 *
 * Drei Cron-Functions liefen live mit verify_jwt=false, ohne Stanza in
 * config.toml. Zwei prüfen den Service-Role-Bearer selbst; der
 * Monitoring-Scheduler tat das nicht — bei ausgeschaltetem Gateway-JWT
 * wäre er für jeden im Internet auslösbar.
 *
 * Wer verify_jwt abschaltet, übernimmt die Auth. Der Test hält beides:
 * die Deklaration und den Bearer-Check.
 */

const TOML = readFileSync('supabase/config.toml', 'utf8');

function stanza(slug: string): string {
  const kopf = `[functions.${slug}]`;
  const start = TOML.indexOf(kopf);
  expect(start, `${slug} fehlt in config.toml`).toBeGreaterThanOrEqual(0);
  const rest = TOML.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

function source(slug: string): string {
  return readFileSync(`supabase/functions/${slug}/index.ts`, 'utf8');
}

const CRON_SLUGS = [
  'governance-monitoring-scheduler',
  'scheduler-dispatch',
  'memory-decay-worker',
] as const;

describe('Cron-Functions: verify_jwt=false ist deklariert und selbst geprüft', () => {
  for (const slug of CRON_SLUGS) {
    it(`${slug} steht in config.toml auf verify_jwt = false`, () => {
      expect(stanza(slug)).toMatch(/verify_jwt\s*=\s*false/);
    });

    it(`${slug} weist fremde Bearer mit 401 ab`, () => {
      const src = source(slug);
      expect(src).toMatch(/Authorization/);
      expect(src).toMatch(/401/);
      expect(src).toMatch(/Bearer \$\{SERVICE_(?:KEY|ROLE)\}/);
    });
  }

  it('pre-deploy-lint führt die drei in REQUIRED_PUBLIC_FUNCTIONS', () => {
    const lint = readFileSync('scripts/pre-deploy-lint.mjs', 'utf8');
    for (const slug of CRON_SLUGS) {
      expect(lint).toContain(`'${slug}'`);
    }
  });
});
