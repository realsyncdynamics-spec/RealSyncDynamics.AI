import { describe, it, expect } from 'vitest';
import { evaluateMonitoringSlos } from '../../supabase/functions/_shared/agents/monitoringSlo.ts';

const NOW = new Date('2026-06-28T12:00:00Z');
const at = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * 3_600_000).toISOString();

function src(over: Partial<Parameters<typeof evaluateMonitoringSlos>[0]['sources'][number]>) {
  return {
    id: 'sx', name: 'Source', status: 'active',
    next_scan_at: at(1), scan_frequency: 'daily', last_error: null,
    ...over,
  };
}

describe('evaluateMonitoringSlos', () => {
  it('counts only active/error sources as evaluated (paused/pending excluded)', () => {
    const r = evaluateMonitoringSlos({
      now: NOW,
      sources: [
        src({ id: 'a', status: 'active', next_scan_at: at(2) }),
        src({ id: 'p', status: 'paused' }),
        src({ id: 'q', status: 'pending' }),
        src({ id: 'e', status: 'error', last_error: 'timeout' }),
      ],
    });
    expect(r.evaluated).toBe(2); // a + e
  });

  it('flags an error source as a high breach', () => {
    const r = evaluateMonitoringSlos({ now: NOW, sources: [src({ id: 'e', status: 'error', last_error: 'boom' })] });
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].stage).toBe('error');
    expect(r.findings[0].severity).toBe('high');
    expect(r.findings[0].dedupeKey).toBe('monitoring:e:error');
    expect(r.findings[0].detail).toContain('boom');
  });

  it('does not flag an active source still within its grace window', () => {
    // daily window 24h, grace 6h; 3h overdue → OK
    const r = evaluateMonitoringSlos({ now: NOW, sources: [src({ next_scan_at: at(-3) })] });
    expect(r.findings).toHaveLength(0);
    expect(r.evaluated).toBe(1);
  });

  it('flags an overdue active source (medium), high when badly overdue', () => {
    const medium = evaluateMonitoringSlos({ now: NOW, sources: [src({ id: 'm', next_scan_at: at(-12) })] });
    expect(medium.findings[0].stage).toBe('overdue');
    expect(medium.findings[0].severity).toBe('medium');

    const high = evaluateMonitoringSlos({ now: NOW, sources: [src({ id: 'h', next_scan_at: at(-60) })] });
    expect(high.findings[0].severity).toBe('high'); // > 2×24h overdue
    expect(high.findings[0].dedupeKey).toBe('monitoring:h:overdue');
  });

  it('ignores active sources with no next_scan_at', () => {
    const r = evaluateMonitoringSlos({ now: NOW, sources: [src({ next_scan_at: null })] });
    expect(r.evaluated).toBe(1);
    expect(r.findings).toHaveLength(0);
  });
});
