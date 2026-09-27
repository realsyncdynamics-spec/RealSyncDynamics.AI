import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GOVERNANCE_MODULES, canAccessModule } from '../../../../src/components/governance-os/governanceModules';
import { requirementForPath } from '../../../../src/core/access/featureAccess';

describe('Ambient AI governance module', () => {
  const ambient = GOVERNANCE_MODULES.find((module) => module.id === 'ambient-ai');

  it('is registered as a beta Governance OS module', () => {
    expect(ambient).toBeDefined();
    expect(ambient?.route).toBe('/app/ambient-ai');
    expect(ambient?.status).toBe('beta');
  });

  it('uses the existing monitoring product boundary', () => {
    expect(canAccessModule(ambient!, 'free')).toBe(false);
    expect(canAccessModule(ambient!, 'starter')).toBe(true);
    expect(requirementForPath('/app/ambient-ai')?.allOf).toEqual(['monitoring.monthly']);
  });

  it('is delivered inside AppGate and GovernanceBrowserShell', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const route = app
      .split('\n')
      .find((line) => line.includes('path="/app/ambient-ai"'));

    expect(route).toContain('<AppGate>');
    expect(route).toContain('<GovernanceBrowserShell>');
    expect(route).toContain('<AmbientAiGovernanceView />');
  });

  it('does not present connected device telemetry before a source exists', () => {
    const view = readFileSync('src/features/governance/ambient/AmbientAiGovernanceView.tsx', 'utf8');
    expect(view).toContain('keine Device-Telemetrie verbunden');
    expect(view).toContain('keine verbundenen Datenquellen');
    expect(view).toContain('Keine erfundenen Runtime-Daten');
  });
});
