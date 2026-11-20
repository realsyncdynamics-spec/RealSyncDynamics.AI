import { describe, expect, it } from 'vitest';
import { resolveAutomationRunLimit } from '../../supabase/functions/automation-trigger/logic';

describe('automation-trigger quota response interpretation', () => {
  it('reads valid numeric limits including zero and unlimited', () => {
    expect(resolveAutomationRunLimit([{ key: 'limit.automation_runs_monthly', value: 3 }])).toBe(3);
    expect(resolveAutomationRunLimit([{ key: 'limit.automation_runs_monthly', value: 0 }])).toBe(0);
    expect(resolveAutomationRunLimit([{ key: 'limit.automation_runs_monthly', value: -1 }])).toBe(-1);
  });

  it('fails closed when entitlement configuration is missing or malformed', () => {
    expect(resolveAutomationRunLimit(null)).toBeNull();
    expect(resolveAutomationRunLimit([])).toBeNull();
    expect(resolveAutomationRunLimit([{ key: 'other', value: 3 }])).toBeNull();
    expect(resolveAutomationRunLimit([{ key: 'limit.automation_runs_monthly', value: '10' }])).toBeNull();
    expect(resolveAutomationRunLimit([{ key: 'limit.automation_runs_monthly', value: -5 }])).toBeNull();
    expect(resolveAutomationRunLimit([{ key: 'limit.automation_runs_monthly', value: 2.5 }])).toBeNull();
  });
});
