import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * P0-Ersatzwege: nach dem Anon-REVOKE von platform_stats und audit_share_get
 * müssen die Edge Functions in config.toml mit verify_jwt=false stehen und
 * in REQUIRED_PUBLIC_FUNCTIONS geführt werden, sonst fällt ein gelöschter
 * Stanza im pre-deploy-lint nicht als Fehler auf.
 */

const SLUGS = ['public-platform-stats', 'audit-share-get'] as const;

function stanza(slug: string): string {
  const toml = readFileSync('supabase/config.toml', 'utf8');
  const kopf = `[functions.${slug}]`;
  const start = toml.indexOf(kopf);
  expect(start, `${slug} fehlt in config.toml`).toBeGreaterThanOrEqual(0);
  const rest = toml.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

describe('P0 öffentliche Ersatzwege: Deklaration und Lint-Set', () => {
  for (const slug of SLUGS) {
    it(`${slug} steht in config.toml auf verify_jwt = false`, () => {
      expect(stanza(slug)).toMatch(/verify_jwt\s*=\s*false/);
    });
  }

  it('pre-deploy-lint führt beide Slugs in REQUIRED_PUBLIC_FUNCTIONS', () => {
    const lint = readFileSync('scripts/pre-deploy-lint.mjs', 'utf8');
    for (const slug of SLUGS) {
      expect(lint).toContain(`'${slug}'`);
    }
  });
});
