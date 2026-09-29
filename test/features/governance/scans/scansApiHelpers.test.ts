/**
 * scansApi tests for the new helpers added in the onboarding-and-
 * status-UI PR: domain normalisation, status-transition validation.
 *
 * `updateFindingStatus` goes through the `set_finding_status` RPC (Gate 2).
 *
 * `addWebsiteForTenant` and `triggerTenantAudit` involve Supabase
 * client + fetch and are exercised via integration tests against
 * staging; here we lock the pure surface that doesn't need a network.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls: { method: string; args: unknown[] }[] = [];
let updateResultError: { message: string; code?: string } | null = null;
let rpcRows: unknown[] | null = null;

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    rpc(fn: string, args: { p_finding_id: string; p_status: string }) {
      calls.push({ method: 'rpc', args: [fn, args] });
      if (updateResultError) return Promise.resolve({ data: null, error: updateResultError });
      return Promise.resolve({ data: rpcRows ?? [{ id: args.p_finding_id, status: args.p_status }], error: null });
    },
  }),
}));

import {
  updateFindingStatus,
  __test,
} from '../../../../src/features/governance/scans/scansApi';

const { normaliseDomain, auditTargetUrl } = __test;

beforeEach(() => {
  calls.length = 0;
  updateResultError = null;
  rpcRows = null;
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

describe('auditTargetUrl', () => {
  it('prefixes https when the registry stored only the host', () => {
    expect(auditTargetUrl('realsyncdynamicsai.de')).toBe('https://realsyncdynamicsai.de');
  });
  it('keeps an existing scheme', () => {
    expect(auditTargetUrl('https://realsyncdynamicsai.de')).toBe('https://realsyncdynamicsai.de');
    expect(auditTargetUrl('http://example.com')).toBe('http://example.com');
  });
});

describe('updateFindingStatus', () => {
  it('writes through the set_finding_status RPC, never a direct UPDATE', async () => {
    await updateFindingStatus('f-1', 'open', 'acknowledged');
    expect(calls).toEqual([
      { method: 'rpc', args: ['set_finding_status', { p_finding_id: 'f-1', p_status: 'acknowledged' }] },
    ]);
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
    expect(calls).toEqual([]);
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

  it('maps a missing write permission to a readable error', async () => {
    updateResultError = { message: 'role may not change finding status', code: '42501' };
    await expect(updateFindingStatus('f-1', 'open', 'acknowledged'))
      .rejects.toThrow(/Keine Berechtigung/);
  });

  it('no written row is a failure, not a silent success', async () => {
    rpcRows = [];
    await expect(updateFindingStatus('f-1', 'open', 'acknowledged'))
      .rejects.toThrow(/nicht gespeichert/);
  });

  it('announces the change for the tenant so dashboards reload', async () => {
    const seen: unknown[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener('realsync:tenant-data-changed', on);
    try {
      await updateFindingStatus('f-1', 'open', 'acknowledged', 't-1');
    } finally {
      window.removeEventListener('realsync:tenant-data-changed', on);
    }
    expect(seen).toEqual([{ tenantId: 't-1' }]);
  });
});
