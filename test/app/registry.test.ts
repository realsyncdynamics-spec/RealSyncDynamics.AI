import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_AREAS } from '../../src/app/areas';
import { breadcrumbs, isListed, matchRoute, navigationModel } from '../../src/app/registry';
import { APP_ROUTES } from '../../src/app/routes.config';

const app = readFileSync('src/App.tsx', 'utf8');
const appPaths = [...new Set([...app.matchAll(/<Route path="(\/app\/[^"]+)"/g)].map((match) => match[1]))]
  .filter((path) => path !== '/app/preview');

describe('Routenregister', () => {
  it('führt jede bestehende /app-Route aus App.tsx genau einmal', () => {
    expect(app).toContain('path="/app/preview"');
    expect(APP_ROUTES.map((route) => route.path).sort()).toEqual([...appPaths].sort());
  });

  it('erzeugt genau acht Navigationsbereiche in fester Reihenfolge', () => {
    expect(navigationModel().map((item) => item.label)).toEqual([
      'Dashboard',
      'AI Studio',
      'Agent Studio',
      'Website Builder',
      'Automationen',
      'Governance',
      'Abrechnung',
      'Einstellungen',
    ]);
    expect(navigationModel().map((item) => item.path)).toEqual(APP_AREAS.map((area) => area.home));
  });

  it('gibt Seiten einen Lazy-Import und lässt Weiterleitungen ohne', () => {
    for (const route of APP_ROUTES) {
      if (route.kind === 'page') expect(typeof route.load, route.path).toBe('function');
      else expect(route.load, route.path).toBeUndefined();
    }
  });

  it('legt Seiten, die nicht in die acht Bereiche gehören, hinter Flaggen und nicht in die Navigation', () => {
    const flagged = APP_ROUTES.filter((route) => route.flag);
    expect(flagged.length).toBeGreaterThan(0);
    expect(flagged.every((route) => route.nav !== true)).toBe(true);
    expect(isListed(flagged[0]!, {})).toBe(false);
    expect(isListed(flagged[0]!, { [flagged[0]!.flag!]: true })).toBe(true);
  });

  it('trifft die Agentenliste vor der :id-Detailroute', () => {
    expect(matchRoute('/app/ai-systems/agents')?.path).toBe('/app/ai-systems/agents');
    expect(matchRoute('/app/ai-systems/sys-1')?.path).toBe('/app/ai-systems/:id');
  });

  it('baut Breadcrumbs aus Bereich und Seite', () => {
    expect(breadcrumbs('/app/policy-packs').map((crumb) => crumb.label)).toEqual([
      'App',
      'Governance',
      'policy packs',
    ]);
    expect(breadcrumbs('/app/dashboard').map((crumb) => crumb.label)).toEqual(['App', 'Dashboard']);
  });

  it('bündelt SiteOS und Websites im Website Builder', () => {
    expect(matchRoute('/app/siteos')?.area).toBe('website-builder');
    expect(matchRoute('/app/websites')?.area).toBe('website-builder');
    expect(matchRoute('/app/siteos/builder')?.area).toBe('website-builder');
  });

  it('behält /app/leads ohne AppGate im Live-Baum und verlangt im Register trotzdem Auth', () => {
    const leads = matchRoute('/app/leads');
    expect(leads?.liveGuard).toBe('none');
    expect(leads?.guard.steps).toEqual(['auth']);
    expect(leads?.flag).toBe('shell.platform-admin');
  });

  it('vermerkt ProtectedRoute nur dort, wo App.tsx sie wirklich setzt', () => {
    const wrapped = APP_ROUTES.filter((route) => route.liveGuard.includes('protected')).map((route) => route.path);
    expect(wrapped).toEqual(['/app/risk']);
  });
});
