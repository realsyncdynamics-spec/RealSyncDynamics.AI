import { describe, it, expect } from 'vitest';
import { isGovernedRoutingEnabled } from '../../../src/core/ai-gateway/featureFlags';

describe('isGovernedRoutingEnabled', () => {
  it('defaults to OFF for unset / empty input', () => {
    expect(isGovernedRoutingEnabled(undefined)).toBe(false);
    expect(isGovernedRoutingEnabled(null)).toBe(false);
    expect(isGovernedRoutingEnabled('')).toBe(false);
  });

  it('recognises the accepted on-values case-insensitively', () => {
    for (const v of ['on', 'ON', '1', 'true', 'TRUE', 'enabled', ' On ']) {
      expect(isGovernedRoutingEnabled(v)).toBe(true);
    }
  });

  it('treats anything else as OFF', () => {
    for (const v of ['off', '0', 'false', 'no', 'yes-please', 'disabled']) {
      expect(isGovernedRoutingEnabled(v)).toBe(false);
    }
  });
});
