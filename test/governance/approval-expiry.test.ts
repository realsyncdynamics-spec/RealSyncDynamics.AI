/**
 * Ablauf von governance_approvals: abgelaufene 'pending'-Einträge zählen nicht
 * als offen, erscheinen unter „Abgelaufen“ und lassen sich nicht mehr
 * entscheiden. Es gibt keinen Job, der sie auf 'expired' setzt — die Regel
 * muss deshalb in Zähler, Liste und Entscheidung selbst stecken.
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  expiredApprovalsOrFilter,
  isApprovalExpired as edgeIsExpired,
} from '../../supabase/functions/_shared/approvalExpiry';

const calls = vi.hoisted(() => ({ filters: [] as Array<[string, string, unknown]> }));

vi.mock('../../src/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => {
    const chain = {
      select: () => chain,
      eq: (col: string, val: unknown) => { calls.filters.push(['eq', col, val]); return chain; },
      gt: async (col: string, val: unknown) => {
        calls.filters.push(['gt', col, val]);
        return { count: 2, error: null };
      },
    };
    return { from: () => chain };
  },
}));

import {
  countPendingApprovals,
  isApprovalExpired as frontendIsExpired,
} from '../../src/features/governance/approvalsApi';

const NOW = new Date('2026-10-10T12:00:00.000Z');

beforeEach(() => { calls.filters = []; });

describe('isApprovalExpired — Edge Function und Frontend gleich', () => {
  const cases: Array<[string | null | undefined, boolean]> = [
    ['2026-10-10T11:59:59.000Z', true],
    ['2026-10-10T12:00:00.000Z', true], // Frist erreicht = abgelaufen
    ['2026-10-10T12:00:01.000Z', false],
    [null, false],
    [undefined, false],
    ['kein-datum', false],
  ];
  it.each(cases)('%s → %s', (expiresAt, expected) => {
    expect(edgeIsExpired(expiresAt, NOW)).toBe(expected);
    expect(frontendIsExpired(expiresAt, NOW)).toBe(expected);
  });
});

describe('countPendingApprovals', () => {
  it('zählt nur pending mit noch nicht abgelaufener Frist, auf den Mandanten gefiltert', async () => {
    await expect(countPendingApprovals('t1')).resolves.toBe(2);
    expect(calls.filters).toContainEqual(['eq', 'tenant_id', 't1']);
    expect(calls.filters).toContainEqual(['eq', 'status', 'pending']);
    const gt = calls.filters.find(([op]) => op === 'gt');
    expect(gt?.[1]).toBe('expires_at');
    expect(Number.isNaN(Date.parse(String(gt?.[2])))).toBe(false);
  });
});

describe('expiredApprovalsOrFilter', () => {
  it('umfasst gespeichertes expired und pending mit vergangener Frist', () => {
    expect(expiredApprovalsOrFilter('2026-10-10T12:00:00.000Z')).toBe(
      'status.eq.expired,and(status.eq.pending,expires_at.lte."2026-10-10T12:00:00.000Z")',
    );
  });
});

describe('governance-approvals Edge Function nutzt die Ablaufregel', () => {
  const fn = readFileSync('supabase/functions/governance-approvals/index.ts', 'utf8');

  it('Liste „offen“ filtert auf expires_at > jetzt', () => {
    expect(fn).toMatch(/status === 'pending'[\s\S]*?\.gt\('expires_at', nowIso\)/);
  });

  it('Liste „Abgelaufen“ nutzt den gemeinsamen or-Filter', () => {
    expect(fn).toContain('query.or(expiredApprovalsOrFilter(nowIso))');
  });

  it('Approve/Reject lehnt abgelaufene Freigaben nach der Rollenprüfung ab', () => {
    const resolve = fn.slice(fn.indexOf('async function handleResolve'), fn.indexOf('async function isOwnerOrAdmin'));
    const roleCheck = resolve.indexOf('isOwnerOrAdmin(admin, userId, row.tenant_id)');
    const expiryCheck = resolve.indexOf('isApprovalExpired(row.expires_at)');
    const decisionWrite = resolve.indexOf('status: target');
    expect(roleCheck).toBeGreaterThan(-1);
    expect(expiryCheck).toBeGreaterThan(roleCheck);
    expect(decisionWrite).toBeGreaterThan(expiryCheck);
    expect(resolve).toContain("'approval is expired'");
  });
});
