import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * welcome-email und rebuild-website liefen mit verify_jwt=false ohne
 * Eingangsprüfung. Der Anon-Key ist ein gültiges JWT — Gateway-JWT
 * reicht nicht. stripe-webhook schickt bereits den Service-Role-Bearer;
 * /admin/rebuilds schickt das User-JWT eines Super-Admins.
 */

function source(slug: string): string {
  return readFileSync(`supabase/functions/${slug}/index.ts`, 'utf8');
}

function stanza(slug: string): string {
  const toml = readFileSync('supabase/config.toml', 'utf8');
  const kopf = `[functions.${slug}]`;
  const start = toml.indexOf(kopf);
  expect(start, `${slug} fehlt in config.toml`).toBeGreaterThanOrEqual(0);
  const rest = toml.slice(start + kopf.length);
  const next = rest.search(/\n\[/);
  return rest.slice(0, next === -1 ? rest.length : next);
}

describe('welcome-email: Service-Role, nicht Anon', () => {
  it('steht in config.toml auf verify_jwt = false', () => {
    expect(stanza('welcome-email')).toMatch(/verify_jwt\s*=\s*false/);
  });

  it('weist fremde Bearer mit 401 ab', () => {
    const src = source('welcome-email');
    expect(src).toMatch(/Authorization/);
    expect(src).toMatch(/401/);
    expect(src).toMatch(/service role required/);
  });
});

describe('rebuild-website: Service-Role oder Super-Admin', () => {
  it('steht in config.toml auf verify_jwt = false', () => {
    expect(stanza('rebuild-website')).toMatch(/verify_jwt\s*=\s*false/);
  });

  it('lässt den Service-Role-Bearer durch (stripe-webhook)', () => {
    const src = source('rebuild-website');
    expect(src).toMatch(/Authorization/);
    expect(src).toMatch(/Bearer \$\{srk\}/);
  });

  it('lässt Super-Admin-JWT durch (Resume in /admin/rebuilds)', () => {
    const src = source('rebuild-website');
    expect(src).toMatch(/is_super_admin/);
    expect(src).toMatch(/403/);
    expect(src).toMatch(/super_admin required/);
  });

  it('weist Anon und unbekannte Bearer mit 401 ab', () => {
    const src = source('rebuild-website');
    expect(src).toMatch(/401/);
    expect(src).toMatch(/UNAUTHORIZED/);
  });
});
