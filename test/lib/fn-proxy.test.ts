import { describe, expect, it } from 'vitest';
import {
  FN_PROXY_ALLOW,
  edgeFunctionUrl,
  isFnProxyAllowed,
  normalizeFnName,
  shouldUseFnProxy,
} from '../../src/lib/fn-proxy';

describe('fn proxy allowlist', () => {
  it('accepts builder persist and gateway', () => {
    expect(normalizeFnName('ai-gateway')).toBe('ai-gateway');
    expect(normalizeFnName(['siteos', 'code-persist'])).toBe('siteos/code-persist');
    expect(isFnProxyAllowed('siteos/code-persist')).toBe(true);
  });

  it('rejects unknown and traversal', () => {
    expect(normalizeFnName('not-a-fn')).toBeNull();
    expect(normalizeFnName('../ai-gateway')).toBeNull();
    expect(normalizeFnName('ai-gateway/../../admin')).toBeNull();
    expect(normalizeFnName('')).toBeNull();
  });

  it('does not use the proxy on localhost (Vite)', () => {
    expect(shouldUseFnProxy()).toBe(false);
    expect(edgeFunctionUrl('gdpr-audit')).toMatch(/\/functions\/v1\/gdpr-audit$/);
  });

  it('keeps the allowlist explicit', () => {
    expect(FN_PROXY_ALLOW).toContain('ai-gateway');
    expect(FN_PROXY_ALLOW).toContain('siteos/code-persist');
    expect(FN_PROXY_ALLOW).toContain('sales-lead');
  });

  it('builds a direct sales-lead URL on localhost', () => {
    expect(edgeFunctionUrl('sales-lead')).toMatch(/\/functions\/v1\/sales-lead$/);
    expect(edgeFunctionUrl('sales-lead')).not.toContain('/api/fn/');
  });
});
