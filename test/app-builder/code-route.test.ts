import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('builder routes', () => {
  it('registers /builder/:slug/code before /builder/:slug', () => {
    const src = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8');
    const code = src.indexOf('path="/builder/:slug/code"');
    const puck = src.indexOf('path="/builder/:slug"');
    expect(code).toBeGreaterThan(-1);
    expect(puck).toBeGreaterThan(-1);
    expect(code).toBeLessThan(puck);
    expect(src).toMatch(/BoltCodeBuilderPage/);
    expect(src).toMatch(/AppBuilderWorkspacePage/);
  });

  it('code page uses canonical canOpenAppBuilder only — no fail-open OR', () => {
    const src = readFileSync(resolve(__dirname, '../../src/features/app-builder/BoltCodeBuilderPage.tsx'), 'utf8');
    expect(src).not.toMatch(/canOpenAppBuilder\(snapshot\)\s*\|\|/);
    expect(src).toMatch(/canOpenAppBuilder\(snapshot\)/);
  });

  it('takes tenant from TenantProvider, never from the URL slug', () => {
    const src = readFileSync(resolve(__dirname, '../../src/features/app-builder/BoltCodeBuilderPage.tsx'), 'utf8');
    expect(src).toMatch(/useTenant\(\)/);
    expect(src).toMatch(/activeTenantId/);
    expect(src).not.toMatch(/params\.tenant/);
    expect(src).not.toMatch(/searchParams\.get\(['"]tenant/);
    expect(src).toMatch(/useParams<\{ slug: string \}>/);
  });

  it('links back to SiteOS / Puck on the same slug', () => {
    const src = readFileSync(resolve(__dirname, '../../src/features/app-builder/BoltCodeBuilderPage.tsx'), 'utf8');
    expect(src).toMatch(/data-testid="back-to-puck"/);
    expect(src).toMatch(/Zurück zu SiteOS \/ Puck/);
    expect(src).toMatch(/to=\{`\/builder\/\$\{encodeURIComponent\(slug\)\}/);
  });

  it('Puck workspace keeps a Code link to /builder/:slug/code', () => {
    const src = readFileSync(
      resolve(__dirname, '../../src/features/siteos/workspace/AppBuilderWorkspacePage.tsx'),
      'utf8',
    );
    expect(src).toMatch(/data-testid="open-code-builder"/);
    expect(src).toMatch(/\/builder\/\$\{encodeURIComponent\(slug\)\}\/code/);
  });
});
