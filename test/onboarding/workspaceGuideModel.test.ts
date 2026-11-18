import { describe, expect, it } from 'vitest';
import { workspaceGuideSteps, workspaceGuideProgress } from '../../src/features/onboarding/workspaceGuideModel';

describe('RealSync Workspace Guide', () => {
  it('does not offer team invite to users without invite permissions', () => {
    expect(workspaceGuideSteps('governance', false).some((step) => step.id === 'team')).toBe(false);
    expect(workspaceGuideSteps('governance', true).some((step) => step.id === 'team')).toBe(true);
  });
  it('uses real existing routes for selected products', () => {
    const steps = workspaceGuideSteps('voice', true);
    expect(steps.find((step) => step.id === 'first-result')?.href).toBe('/app/voice');
  });
  it('never counts duplicate or hidden completion keys', () => {
    const steps = workspaceGuideSteps('none', false);
    expect(workspaceGuideProgress(steps, ['profile', 'profile', 'team', 'invalid'])).toEqual({
      done: 1, total: 4, percent: 25,
    });
  });
  it('does not invent module readiness without a selection', () => {
    const steps = workspaceGuideSteps('none', true);
    expect(steps.find((step) => step.id === 'first-result')?.href).toBeNull();
  });
});
