import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ORDERED_PLANS, checkoutHrefForPlan } from '../../shared/pricing';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/**
 * Interne Links der Pricing-Oberflächen müssen auf deklarierte Routen zeigen.
 *
 * Anlass: die Developer-Sektion verlinkte zunächst auf `/docs/api` (existiert
 * nicht) und `/governance/docs` (vertauscht — die Route heißt
 * `/docs/governance`). Beides sind tote Links, die weder Typprüfung noch
 * Build bemerken, weil react-router Pfade als Strings entgegennimmt.
 */

const APP_TSX = readFileSync(join(ROOT, 'src', 'App.tsx'), 'utf8');

/** Alle in App.tsx deklarierten Routen-Pfade. */
function declaredRoutes(): string[] {
  const paths: string[] = [];
  const routeRe = /<Route\s+path=(?:"([^"]+)"|\{'([^']+)'\})/g;
  let match: RegExpExecArray | null;
  while ((match = routeRe.exec(APP_TSX)) !== null) {
    const path = match[1] ?? match[2];
    // Der 404-Catch-all ist kein gültiges Linkziel. Ohne diesen Ausschluss
    // würde er jeden Pfad "matchen" und die Prüfung wirkungslos machen.
    if (path === '*' || path === '/*') continue;
    paths.push(path);
  }
  return paths;
}

const ROUTES = declaredRoutes();

/**
 * Passt ein konkreter Pfad auf eine deklarierte Route?
 * Berücksichtigt Parameter (`:slug`) und Wildcards (`*`).
 */
function routeExists(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  return ROUTES.some((route) => {
    const routeSegments = route.split('/').filter(Boolean);
    if (route.endsWith('*')) {
      const prefix = routeSegments.slice(0, -1);
      return prefix.every((seg, i) => seg.startsWith(':') || seg === segments[i]);
    }
    if (routeSegments.length !== segments.length) return false;
    return routeSegments.every((seg, i) => seg.startsWith(':') || seg === segments[i]);
  });
}

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, acc);
    else if (extname(full) === '.tsx') acc.push(full);
  }
  return acc;
}

describe('Interne Links der Pricing-Oberflächen', () => {
  it('findet die Routen-Deklarationen in App.tsx', () => {
    expect(ROUTES.length).toBeGreaterThan(50);
    expect(ROUTES).toContain('/pricing');
  });

  it('jeder `to="/…"` in src/components/pricing zeigt auf eine echte Route', () => {
    const dead: string[] = [];

    for (const file of collectFiles(join(ROOT, 'src', 'components', 'pricing'))) {
      const source = readFileSync(file, 'utf8');
      const linkRe = /\bto="(\/[^"?#]*)/g;
      let match: RegExpExecArray | null;
      while ((match = linkRe.exec(source)) !== null) {
        if (!routeExists(match[1])) {
          dead.push(`${relative(ROOT, file)} → ${match[1]}`);
        }
      }
    }

    expect(dead, `Tote interne Links:\n${dead.join('\n')}`).toEqual([]);
  });

  it('jedes Checkout-Ziel der SSoT zeigt auf eine echte Route', () => {
    const dead: string[] = [];
    for (const plan of ORDERED_PLANS) {
      for (const interval of ['month', 'year'] as const) {
        if (interval === 'year' && plan.yearlyPlanKey === null) continue;
        const href = checkoutHrefForPlan(plan, { interval });
        const pathname = href.split('?')[0];
        if (!routeExists(pathname)) dead.push(`${plan.id}/${interval} → ${pathname}`);
      }
    }
    expect(dead, `Checkout-Ziele ohne Route:\n${dead.join('\n')}`).toEqual([]);
  });
});
