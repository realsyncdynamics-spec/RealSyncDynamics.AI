/**
 * Gate 1 — listOpenFindingsForTenant: ein älterer kritischer Befund darf nicht
 * von 50 jüngeren Niedrig-/Info-Befunden verdrängt werden (sonst meldete das
 * Dashboard „keine kritischen Befunde“).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; severity: string; created_at: string };
let rows: Row[] = [];
let failPriority = false;

vi.mock('../../../../src/lib/supabase', () => ({
  getSupabase: () => ({
    from() {
      let severities: string[] | null = null;
      let limitN = Infinity;
      // deno-lint-ignore no-explicit-any
      const q: any = {
        select: () => q,
        eq: () => q,
        in(col: string, values: string[]) {
          if (col === 'severity') severities = values;
          return q;
        },
        order: () => q,
        limit(n: number) {
          limitN = n;
          if (severities && failPriority) return Promise.resolve({ data: null, error: { message: 'rls' } });
          const data = rows
            .filter((r) => !severities || severities.includes(r.severity))
            .sort((a, b) => b.created_at.localeCompare(a.created_at))
            .slice(0, limitN);
          return Promise.resolve({ data, error: null });
        },
      };
      return q;
    },
  }),
}));

import { listOpenFindingsForTenant } from '../../../../src/features/governance/scans/scansApi';

const at = (i: number) => new Date(Date.UTC(2026, 8, 1) + i * 60_000).toISOString();

beforeEach(() => {
  rows = [];
  failPriority = false;
});

describe('listOpenFindingsForTenant', () => {
  it('älterer kritischer Befund bleibt trotz 50 jüngerer Info-Befunde erhalten', async () => {
    rows = [
      { id: 'crit-old', severity: 'critical', created_at: at(0) },
      ...Array.from({ length: 50 }, (_, i) => ({ id: `info-${i}`, severity: 'info', created_at: at(i + 1) })),
    ];
    const result = await listOpenFindingsForTenant('t1', 50);
    expect(result.some((r) => r.id === 'crit-old')).toBe(true);
    expect(result).toHaveLength(51);
    // Neueste zuerst, keine Doppelten.
    expect(result[0].id).toBe('info-49');
    expect(new Set(result.map((r) => r.id)).size).toBe(result.length);
  });

  it('Fehler der Prioritätsabfrage wirft — nie als „0 Befunde“ gelesen', async () => {
    rows = [{ id: 'a', severity: 'low', created_at: at(1) }];
    failPriority = true;
    await expect(listOpenFindingsForTenant('t1')).rejects.toThrow('rls');
  });
});
