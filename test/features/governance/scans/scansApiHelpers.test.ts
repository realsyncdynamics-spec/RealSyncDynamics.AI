/**
 * scansApi tests for the new helpers added in the onboarding-and-
 * status-UI PR: domain normalisation, status-transition validation.
 *
 * `addWebsiteForTenant` and `triggerTenantAudit` involve Supabase
 * client + fetch and are exercised via integration tests against
 * staging; here we lock the pure surface that doesn't need a network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: { method: string; args: unknown[] }[] = [];
let updateResultError: { message: string } | null = null;

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    from() {
      return {
        update(patch: unknown) {
          calls.push({ method: 'update', args: [patch] });
          return {
            eq(col: string, val: unknown) {
              calls.push({ method: 'eq', args: [col, val] });
              return Promise.resolve({ error: updateResultError });
            },
          };
        },
      };
    },
  }),
}));

import {
  updateFindingStatus,
  __test,
} from '../../../../src/features/governance/scans/scansApi';

const { normaliseDomain } = __test;

beforeEach(() => {
  calls.length = 0;
  updateResultError = null;
});

describe('normaliseDomain', () => {
  it('strips http(s) scheme and trailing path', () => {
    expect(normaliseDomain('https://example.com')).toBe('example.com');
    expect(normaliseDomain('http://Example.COM/about?ref=1')).toBe('example.com');
    expect(normaliseDomain('https://sub.example.de/')).toBe('sub.example.de');
  });
  it('preserves multi-level subdomains', () => {
    expect(normaliseDomain('shop.kunde-1.example.de')).toBe('shop.kunde-1.example.de');
  });
  it('lowercases and trims whitespace', () => {
    expect(normaliseDomain('  EXAMPLE.de  ')).toBe('example.de');
  });
  it('returns null for invalid input', () => {
    expect(normaliseDomain('')).toBeNull();
    expect(normaliseDomain('not a domain')).toBeNull();
    expect(normaliseDomain('http://')).toBeNull();
    expect(normaliseDomain('only-one-label')).toBeNull();
  });
});

describe('updateFindingStatus', () => {
  it('allows open → acknowledged', async () => {
    await updateFindingStatus('f-1', 'open', 'acknowledged');
    const upd = calls.find((c) => c.method === 'update');
    expect(upd?.args[0]).toEqual({ status: 'acknowledged' });
    const eq = calls.find((c) => c.method === 'eq');
    expect(eq?.args).toEqual(['id', 'f-1']);
  });

  it('allows open → fixed', async () => {
    await expect(updateFindingStatus('f-1', 'open', 'fixed')).resolves.toBeUndefined();
  });

  it('allows fixed → resolved (re-scan confirms)', async () => {
    await expect(updateFindingStatus('f-1', 'fixed', 'resolved')).resolves.toBeUndefined();
  });

  it('allows resolved → open (regression)', async () => {
    await expect(updateFindingStatus('f-1', 'resolved', 'open')).resolves.toBeUndefined();
  });

  it('rejects acknowledged → resolved (must go through fixed)', async () => {
    await expect(updateFindingStatus('f-1', 'acknowledged', 'resolved'))
      .rejects.toThrow(/nicht erlaubt/);
  });

  it('rejects open → resolved (must go through fixed)', async () => {
    await expect(updateFindingStatus('f-1', 'open', 'resolved'))
      .rejects.toThrow(/nicht erlaubt/);
  });

  it('rejects open → open (no self-loop)', async () => {
    await expect(updateFindingStatus('f-1', 'open', 'open'))
      .rejects.toThrow(/nicht erlaubt/);
  });

  it('propagates DB errors', async () => {
    updateResultError = { message: 'rls-blocked' };
    await expect(updateFindingStatus('f-1', 'open', 'acknowledged'))
      .rejects.toThrow(/rls-blocked/);
  });
});
