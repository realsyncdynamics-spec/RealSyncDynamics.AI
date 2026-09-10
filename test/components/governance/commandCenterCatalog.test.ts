import { describe, it, expect } from 'vitest';
import {
  buildCommandCatalog,
  filterCommands,
  isCommandRunnable,
  resolveCommandPath,
} from '../../../src/components/governance-os/commandCenterCatalog';
import { GOVERNANCE_MODULES } from '../../../src/components/governance-os/governanceModules';

describe('commandCenterCatalog', () => {
  const catalog = buildCommandCatalog();

  it('includes every governance module as a command', () => {
    for (const mod of GOVERNANCE_MODULES) {
      expect(catalog.some((c) => c.id === `mod-${mod.id}`)).toBe(true);
    }
  });

  it('maps live modules to runnable navigation paths', () => {
    const evidence = catalog.find((c) => c.id === 'mod-evidence');
    expect(evidence).toBeDefined();
    expect(evidence!.state).toBe('ready');
    expect(isCommandRunnable(evidence!)).toBe(true);
    expect(resolveCommandPath(evidence!)).toBe('/app/evidence');
  });

  it('marks roadmap modules as Coming Soon and not runnable', () => {
    const dpia = catalog.find((c) => c.id === 'mod-dpia');
    expect(dpia).toBeDefined();
    expect(dpia!.state).toBe('coming_soon');
    expect(dpia!.badge).toBe('Coming Soon');
    expect(isCommandRunnable(dpia!)).toBe(false);
    expect(resolveCommandPath(dpia!)).toBeNull();
    expect(dpia!.path).toBeUndefined();
  });

  it('keeps beta modules navigable with Beta badge', () => {
    const risks = catalog.find((c) => c.id === 'mod-risks');
    expect(risks).toBeDefined();
    expect(risks!.state).toBe('ready');
    expect(risks!.badge).toBe('Beta');
    expect(resolveCommandPath(risks!)).toBe('/app/risks');
  });

  it('resolves high-value action destinations to real routes', () => {
    const audit = catalog.find((c) => c.id === 'nav-audit-start');
    const scans = catalog.find((c) => c.id === 'nav-scans');
    const pricing = catalog.find((c) => c.id === 'nav-pricing');
    const team = catalog.find((c) => c.id === 'nav-team-invite');
    const settings = catalog.find((c) => c.id === 'mod-settings');

    expect(resolveCommandPath(audit!)).toBe('/audit');
    expect(resolveCommandPath(scans!)).toBe('/app/scans');
    expect(resolveCommandPath(pricing!)).toBe('/pricing');
    expect(resolveCommandPath(team!)).toBe('/app/team');
    expect(resolveCommandPath(settings!)).toBe('/app/settings');
  });

  it('exposes the assistant as a non-navigation action', () => {
    const assistant = catalog.find((c) => c.id === 'action-assistant');
    expect(assistant).toBeDefined();
    expect(assistant!.actionId).toBe('open-assistant');
    expect(assistant!.path).toBeUndefined();
    expect(isCommandRunnable(assistant!)).toBe(true);
  });

  it('filters by label, path and keywords', () => {
    const byLabel = filterCommands(catalog, 'Evidence');
    expect(byLabel.some((c) => c.id === 'mod-evidence')).toBe(true);

    const byPath = filterCommands(catalog, '/app/policy-packs');
    expect(byPath.some((c) => c.id === 'mod-policy-packs')).toBe(true);

    const byKeyword = filterCommands(catalog, 'einladen');
    expect(byKeyword.some((c) => c.id === 'nav-team-invite')).toBe(true);
  });

  it('returns an empty list for unmatched queries', () => {
    expect(filterCommands(catalog, 'zzzz-not-a-real-command')).toEqual([]);
  });
});
