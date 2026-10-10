/**
 * `/billing` und `/app/settings/billing` dürfen nicht 404 liefern.
 *
 * Kanonische Abrechnung ist `/app/billing` (`BillingView` hinter AppGate +
 * RequireAal2). Die Aliase leiten dorthin um — wie `/assistant` → `/app/dashboard`.
 * Logged-out: AppGate auf dem Ziel → `/welcome?next=/app/billing`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveCustomerDestination } from '../../src/core/journey/resolveCustomerDestination';

const ROOT = resolve(__dirname, '../..');
const app = readFileSync(resolve(ROOT, 'src/App.tsx'), 'utf-8');
const robots = readFileSync(resolve(ROOT, 'public/robots.txt'), 'utf-8');
const redirects = readFileSync(resolve(ROOT, 'public/_redirects'), 'utf-8');
const sitemap = readFileSync(resolve(ROOT, 'public/sitemap.xml'), 'utf-8');

function routeLine(path: string): string {
  const line = app.split('\n').find((text) => text.includes(`path="${path}"`));
  expect(line, `Route ${path} nicht gefunden`).toBeDefined();
  return line ?? '';
}

describe('Billing-Aliase → /app/billing', () => {
  it.each(['/billing', '/app/settings/billing'])(
    '%s leitet auf /app/billing um (kein 404)',
    (path) => {
      expect(routeLine(path)).toContain('Navigate to="/app/billing"');
    },
  );

  it('hält die kanonische Abrechnung hinter AppGate + BillingView', () => {
    expect(routeLine('/app/billing')).toContain('<AppGate>');
    expect(routeLine('/app/billing')).toContain('BillingView');
    expect(routeLine('/app/billing')).toContain('RequireAal2');
  });

  it('lässt /billing/usage als eigene Route stehen', () => {
    expect(routeLine('/billing/usage')).toContain('UsageView');
    expect(routeLine('/billing/usage')).not.toContain('Navigate to="/app/billing"');
  });

  it.each(['/billing', '/app/settings/billing'])(
    'hat einen 301 in _redirects für %s',
    (path) => {
      expect(redirects).toMatch(new RegExp(`^${path}\\s+/app/billing\\s+301`, 'm'));
    },
  );
});

describe('Logged-out Billing landet bei Login mit next=', () => {
  it('leitet unauthentifiziert von /app/billing nach /welcome?next=/app/billing', () => {
    // Aliase (/billing, /app/settings/billing) landen zuerst auf /app/billing;
    // AppGate sieht dann diesen kanonischen Pfad und setzt next= darauf.
    const dest = resolveCustomerDestination({
      authenticated: false,
      intendedPath: '/app/billing',
    });
    expect(dest).toEqual({
      kind: 'redirect',
      to: `/welcome?next=${encodeURIComponent('/app/billing')}`,
      reason: 'unauthenticated',
    });
  });
});

describe('robots/sitemap indexieren Billing-Routen nicht', () => {
  const disallowed = robots
    .split('\n')
    .filter((line) => line.trim().startsWith('Disallow:'))
    .map((line) => line.split(':')[1]?.trim());

  it.each(['/billing', '/app', '/settings/'])('sperrt %s', (path) => {
    expect(disallowed).toContain(path);
  });

  it('hält Billing-URLs aus der Sitemap', () => {
    for (const path of ['/billing', '/app/billing', '/app/settings/billing']) {
      expect(sitemap, `${path} steht in der Sitemap`).not.toContain(`realsyncdynamicsai.de${path}<`);
      expect(sitemap).not.toContain(`realsyncdynamicsai.de${path}"`);
    }
  });
});
