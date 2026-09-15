import { describe, expect, it } from 'vitest';
import { isLiveLegacySurface, LIVE_SURFACES } from '../src/enterprise-os/pages/PlaceholderPage';

describe('Governance OS legacy route surfaces', () => {
  it('marks every legacy placeholder with a real implementation as live', () => {
    expect(LIVE_SURFACES).toEqual([
      'AI Use Case Registry',
      'Agenten',
      'Audit Reports',
      'Team & Rollen',
      'Billing',
      'Einstellungen',
    ]);
  });

  it('does not treat future placeholders as implemented', () => {
    expect(isLiveLegacySurface('DPIA Registry')).toBe(false);
    expect(isLiveLegacySurface('Future Module')).toBe(false);
  });

  it.each(LIVE_SURFACES)('maps "%s" to a functional surface', (title) => {
    expect(isLiveLegacySurface(title)).toBe(true);
  });
});
